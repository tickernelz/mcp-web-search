import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchAndExtract } from "../src/extract.js";
import { fetchCache } from "../src/utils/cache.js";

function testTransport(handler: (url: URL) => Response | Promise<Response>) {
  return async (url: URL) => handler(url);
}

async function tempDir() {
  return await mkdtemp(join(tmpdir(), "mcp-web-search-test-"));
}

test("fetchAndExtract downloads binary resources only when explicitly requested", async () => {
  const dir = await tempDir();
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const transport = testTransport(
    () =>
      new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": 'attachment; filename="../../evil.png"'
        }
      })
  );

  try {
    const metadataOnly = await fetchAndExtract(
      "https://example.com/assets/logo.png",
      { format: "metadata", fresh: true },
      transport
    );
    assert.equal(metadataOnly.attachments, undefined);

    const downloaded = await fetchAndExtract(
      "https://example.com/assets/logo.png",
      {
        format: "metadata",
        download: true,
        download_dir: dir,
        download_ttl_seconds: 3600,
        fresh: true
      },
      transport
    );

    assert.equal(downloaded.resource_type, "image");
    assert.equal(downloaded.attachments?.length, 1);
    const attachment = downloaded.attachments?.[0];
    assert.equal(attachment?.kind, "download");
    assert.equal(attachment?.content_type, "image/png");
    assert.equal(attachment?.byte_length, bytes.byteLength);
    assert.equal(attachment?.resource_type, "image");
    assert.match(String(attachment?.sha256), /^[a-f0-9]{64}$/);
    assert.ok(String(attachment?.path).startsWith(dir));
    assert.doesNotMatch(String(attachment?.filename), /\.\./);
    assert.deepEqual(await readFile(String(attachment?.path)), bytes);

    const mode = (await stat(String(attachment?.path))).mode & 0o777;
    assert.equal(mode, 0o600);
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract rejects downloads that exceed max_download_bytes", async () => {
  const dir = await tempDir();
  const bytes = Buffer.from("0123456789");
  const transport = testTransport(
    () =>
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
  );

  try {
    await assert.rejects(
      () =>
        fetchAndExtract(
          "https://example.com/file.bin",
          {
            download: true,
            download_dir: dir,
            max_download_bytes: 4,
            fresh: true
          },
          transport
        ),
      /Content too large|Download too large/
    );
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract cleanup does not delete unrelated files in download_dir", async () => {
  const dir = await tempDir();
  const unrelated = join(dir, "keep-me.txt");
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const transport = testTransport(
    () =>
      new Response(Buffer.from("ok"), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
  );

  try {
    await writeFile(unrelated, "do not delete");
    await utimes(unrelated, old, old);

    await fetchAndExtract(
      "https://example.com/file.bin",
      {
        download: true,
        download_dir: dir,
        download_ttl_seconds: 60,
        fresh: true
      },
      transport
    );

    assert.equal(await readFile(unrelated, "utf8"), "do not delete");
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract ignores malformed content-disposition filenames", async () => {
  const dir = await tempDir();
  const transport = testTransport(
    () =>
      new Response(Buffer.from("ok"), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": "attachment; filename*=UTF-8''%E0%A4%A"
        }
      })
  );

  try {
    const result = await fetchAndExtract(
      "https://example.com/file.bin",
      {
        download: true,
        download_dir: dir,
        fresh: true
      },
      transport
    );
    assert.equal(result.attachments?.length, 1);
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract ignores expired sidecars pointing outside download_dir", async () => {
  const dir = await tempDir();
  const outside = join(tmpdir(), `mcp-web-search-outside-${Date.now()}.txt`);
  const transport = testTransport(
    () =>
      new Response(Buffer.from("ok"), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
  );

  try {
    await writeFile(outside, "do not delete");
    await writeFile(
      join(dir, "mcp-fetch-evil.json"),
      JSON.stringify({ path: outside, expires_at: "2000-01-01T00:00:00.000Z" })
    );

    await fetchAndExtract(
      "https://example.com/file.bin",
      {
        download: true,
        download_dir: dir,
        fresh: true
      },
      transport
    );

    assert.equal(await readFile(outside, "utf8"), "do not delete");
  } finally {
    fetchCache.clear();
    await rm(outside, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract cleans expired JSON downloads without sidecar collisions", async () => {
  const dir = await tempDir();
  const jsonBody = Buffer.from(
    JSON.stringify({ path: "not-sidecar", expires_at: "2000-01-01T00:00:00.000Z" })
  );
  const transport = testTransport(
    () =>
      new Response(jsonBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="data.json"'
        }
      })
  );

  try {
    const first = await fetchAndExtract(
      "https://example.com/data.json",
      {
        download: true,
        download_dir: dir,
        download_ttl_seconds: 60,
        fresh: true
      },
      transport
    );
    const firstPath = String(first.attachments?.[0]?.path);
    const firstSidecar = `${firstPath}.meta.json`;
    const sidecar = JSON.parse(await readFile(firstSidecar, "utf8"));
    await assert.doesNotReject(() => readFile(firstPath));
    await assert.doesNotReject(() => readFile(firstSidecar));

    await writeFile(
      firstSidecar,
      JSON.stringify({ ...sidecar, expires_at: "2000-01-01T00:00:00.000Z" })
    );

    await fetchAndExtract(
      "https://example.com/data.json",
      {
        download: true,
        download_dir: dir,
        download_ttl_seconds: 60,
        fresh: true
      },
      transport
    );

    await assert.rejects(() => readFile(firstPath), /ENOENT/);
    await assert.rejects(() => readFile(firstSidecar), /ENOENT/);
    const names = await readdir(dir);
    assert.ok(names.some(name => name.endsWith("data.json")));
    assert.ok(names.some(name => name.endsWith("data.json.meta.json")));
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract ignores downloaded .meta.json artifacts during cleanup", async () => {
  const dir = await tempDir();
  const jsonBody = Buffer.from(
    JSON.stringify({ path: "not-sidecar", expires_at: "2000-01-01T00:00:00.000Z" })
  );
  const transport = testTransport(
    () =>
      new Response(jsonBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="payload.meta.json"'
        }
      })
  );

  try {
    const first = await fetchAndExtract(
      "https://example.com/payload.meta.json",
      {
        download: true,
        download_dir: dir,
        download_ttl_seconds: 60,
        fresh: true
      },
      transport
    );
    const firstPath = String(first.attachments?.[0]?.path);
    await assert.doesNotReject(() => readFile(firstPath));

    await fetchAndExtract(
      "https://example.com/payload.meta.json",
      {
        download: true,
        download_dir: dir,
        download_ttl_seconds: 60,
        fresh: true
      },
      transport
    );

    await assert.doesNotReject(() => readFile(firstPath));
  } finally {
    fetchCache.clear();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetchAndExtract rejects oversized custom transport responses before extraction", async () => {
  const bytes = Buffer.alloc(10, 1);
  const transport = testTransport(
    () =>
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
  );

  try {
    await assert.rejects(
      () =>
        fetchAndExtract(
          "https://example.com/file.bin",
          {
            max_download_bytes: 4,
            fresh: true
          },
          transport
        ),
      /Content too large/
    );
  } finally {
    fetchCache.clear();
  }
});
