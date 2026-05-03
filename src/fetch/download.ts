import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type { FetchAttachment, FetchOptions, ResourceType } from "./types.js";

const DEFAULT_DOWNLOAD_TTL_SECONDS = 24 * 60 * 60;
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_DOWNLOAD_DIR = join(tmpdir(), "mcp-web-search", "downloads");
const ARTIFACT_PREFIX = "mcp-fetch-";
const SIDECAR_SUFFIX = ".meta.json";

function now() {
  return Date.now();
}

function safeName(value: string | undefined): string {
  const fallback = `download-${randomUUID()}`;
  const base = basename((value || fallback).split("?")[0].split("#")[0]) || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 120) || fallback;
}

function filenameFromDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8.replace(/^"|"$/g, ""));
    } catch {
      return undefined;
    }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1];
}

function extensionFor(contentType: string, finalUrl: string): string {
  const fromUrl = extname(new URL(finalUrl).pathname);
  if (fromUrl && fromUrl.length <= 12) return fromUrl;

  const lower = contentType.toLowerCase().split(";", 1)[0];
  const known: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "video/mp4": ".mp4",
    "application/octet-stream": ".bin"
  };
  return known[lower] || ".bin";
}

function resolvedChildPath(parent: string, child: string): string {
  const parentResolved = resolve(parent);
  const childResolved = resolve(parentResolved, child);
  if (childResolved !== parentResolved && !childResolved.startsWith(parentResolved + sep)) {
    throw new Error("download_dir escapes allowed directory");
  }
  return childResolved;
}

async function cleanupExpiredDownloads(root: string): Promise<void> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootResolved = resolve(root);
  const entries = await readdir(rootResolved, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter(
        entry =>
          entry.isFile() &&
          entry.name.startsWith(ARTIFACT_PREFIX) &&
          entry.name.endsWith(SIDECAR_SUFFIX)
      )
      .map(async entry => {
        const metadataPath = resolvedChildPath(rootResolved, entry.name);
        const expectedArtifactPath = metadataPath.slice(0, -SIDECAR_SUFFIX.length);
        const expectedArtifactName = basename(expectedArtifactPath);
        const metadata = await readFile(metadataPath, "utf8")
          .then(
            value =>
              JSON.parse(value) as {
                kind?: string;
                path?: string;
                filename?: string;
                expires_at?: string;
              }
          )
          .catch(() => null);

        const targetPath = metadata?.path ? resolve(metadata.path) : "";
        const validSidecar =
          metadata?.kind === "download" &&
          !!metadata.expires_at &&
          targetPath === expectedArtifactPath &&
          metadata.filename === expectedArtifactName &&
          targetPath.startsWith(rootResolved + sep) &&
          expectedArtifactName.startsWith(ARTIFACT_PREFIX);
        if (!validSidecar || !metadata?.expires_at || Date.parse(metadata.expires_at) > now())
          return;

        await rm(targetPath, { force: true });
        await rm(metadataPath, { force: true });
      })
  );
}

export async function saveDownloadedResource(args: {
  buffer: Buffer;
  finalUrl: string;
  contentType: string;
  contentDisposition?: string | null;
  resourceType: ResourceType;
  options?: FetchOptions;
}): Promise<FetchAttachment | undefined> {
  if (!args.options?.download) return undefined;

  const maxBytes = Math.min(
    args.options.max_download_bytes ?? MAX_DOWNLOAD_BYTES,
    MAX_DOWNLOAD_BYTES
  );
  if (args.buffer.byteLength > maxBytes) {
    throw new Error(`Download too large: ${args.buffer.byteLength} bytes`);
  }

  const ttlSeconds = Math.max(
    60,
    args.options.download_ttl_seconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS
  );
  const root = resolve(args.options.download_dir || DEFAULT_DOWNLOAD_DIR);
  await cleanupExpiredDownloads(root);

  const dispositionName = filenameFromDisposition(args.contentDisposition || null);
  const urlName = basename(new URL(args.finalUrl).pathname);
  let originalFilename = safeName(dispositionName || urlName);
  if (!extname(originalFilename)) originalFilename += extensionFor(args.contentType, args.finalUrl);

  const id = `${ARTIFACT_PREFIX}${randomUUID()}`;
  const storedFilename = `${id}-${originalFilename}`;
  const path = resolvedChildPath(root, storedFilename);
  await writeFile(path, args.buffer, { mode: 0o600, flag: "wx" });

  const sha256 = createHash("sha256").update(args.buffer).digest("hex");
  const expiresAt = new Date(now() + ttlSeconds * 1000).toISOString();
  const attachment: FetchAttachment = {
    kind: "download",
    path,
    filename: storedFilename,
    original_filename: originalFilename,
    content_type: args.contentType,
    resource_type: args.resourceType,
    byte_length: args.buffer.byteLength,
    sha256,
    expires_at: expiresAt
  };
  await writeFile(`${path}.meta.json`, JSON.stringify(attachment, null, 2), {
    mode: 0o600,
    flag: "wx"
  });
  return attachment;
}
