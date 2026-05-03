import http from "node:http";
import https from "node:https";
import { HTTP_TIMEOUT, MAX_BYTES } from "../constants.js";
import type { FetchOptions } from "./types.js";
import { getRandomHeaders } from "../utils/user-agent.js";
import { assertSafeUrl, resolveSafeAddresses } from "./security.js";

export interface FetchedResource {
  response: Response;
  finalUrl: string;
  contentType: string;
  buffer: Buffer;
  byteLength: number;
}

function headerRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function nodeResponseToFetchResponse(args: {
  status: number;
  statusText: string;
  headers: Headers;
  body: Buffer;
  url: string;
}): Response {
  const response = new Response(new Uint8Array(args.body), {
    status: args.status,
    statusText: args.statusText,
    headers: args.headers
  });
  Object.defineProperty(response, "url", { value: args.url });
  return response;
}

export type FetchTransport = (url: URL, timeoutMs: number) => Promise<Response>;

async function fetchViaVettedAddress(url: URL, timeoutMs: number): Promise<Response> {
  const safeAddresses = await resolveSafeAddresses(url.hostname);
  const targetAddress = safeAddresses[0];
  if (!targetAddress) throw new Error("Blocked localhost/private URL");

  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;
  const headers = new Headers(getRandomHeaders());
  headers.set("Host", url.host);

  return await new Promise<Response>((resolve, reject) => {
    const request = client.request(
      {
        protocol: url.protocol,
        host: targetAddress,
        hostname: targetAddress,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: headerRecord(headers),
        servername: isHttps ? url.hostname : undefined,
        timeout: timeoutMs
      },
      response => {
        const contentLength = Number(response.headers["content-length"] || "0");
        if (contentLength > MAX_BYTES) {
          response.destroy();
          reject(new Error(`Content too large: ${contentLength} bytes`));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.byteLength;
          if (total > MAX_BYTES) {
            response.destroy();
            reject(new Error("Content too large (downloaded)"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) headers.append(key, item);
            } else if (value !== undefined) {
              headers.set(key, String(value));
            }
          }

          resolve(
            nodeResponseToFetchResponse({
              status: response.statusCode || 0,
              statusText: response.statusMessage || "",
              headers,
              body: Buffer.concat(chunks),
              url: url.toString()
            })
          );
        });
        response.on("error", reject);
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function fetchResource(
  url: URL,
  timeoutMs = HTTP_TIMEOUT,
  transport: FetchTransport = fetchViaVettedAddress,
  options?: FetchOptions
): Promise<FetchedResource> {
  await assertSafeUrl(url);

  let currentUrl = new URL(url);
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    await assertSafeUrl(currentUrl);
    response = await transport(currentUrl, timeoutMs);

    if (![301, 302, 303, 307, 308].includes(response.status)) break;

    const location = response.headers.get("location");
    if (!location) break;

    currentUrl = new URL(location, currentUrl);
    await assertSafeUrl(currentUrl);
  }

  if (!response) throw new Error(`Fetch failed for ${url.toString()}`);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error(`Too many redirects for ${url.toString()}`);
  }

  const finalUrl = currentUrl.toString();
  const finalParsed = new URL(finalUrl);
  await assertSafeUrl(finalParsed);

  if (!response.ok) throw new Error(`Fetch ${response.status} for ${url.toString()}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const maxResponseBytes = Math.min(options?.max_download_bytes ?? MAX_BYTES, MAX_BYTES);
  if (buffer.byteLength > maxResponseBytes) throw new Error("Content too large (downloaded)");
  return {
    response,
    finalUrl,
    contentType: response.headers.get("content-type") || "",
    buffer,
    byteLength: buffer.byteLength
  };
}
