import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);
const FAKE_IP_CIDRS_ENV = "FETCH_URL_ALLOWED_FAKE_IP_CIDRS";

type IPv4Cidr = { base: number; mask: number };

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function ipv4ToNumber(address: string): number | null {
  const parts = parseIPv4(address);
  if (!parts) return null;
  return parts.reduce((value, part) => (value << 8) + part, 0) >>> 0;
}

function parseIPv4Cidr(cidr: string): IPv4Cidr | null {
  const [address, prefixText] = cidr.trim().split("/");
  if (!address || prefixText === undefined) return null;

  const base = ipv4ToNumber(address);
  const prefix = Number(prefixText);
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { base: base & mask, mask };
}

function configuredFakeIpCidrs(): IPv4Cidr[] {
  return (process.env[FAKE_IP_CIDRS_ENV] || "")
    .split(",")
    .map(item => parseIPv4Cidr(item))
    .filter((item): item is IPv4Cidr => item !== null);
}

function isIPv4InCidr(address: string, cidr: IPv4Cidr): boolean {
  const value = ipv4ToNumber(address);
  if (value === null) return false;
  return (value & cidr.mask) === cidr.base;
}

function isIPv4Private(address: string): boolean {
  const parts = parseIPv4(address);
  if (!parts) return false;

  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function mappedIPv4(address: string): string | null {
  const normalized = address.toLowerCase();
  const dotted = normalized.match(/(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (dotted && net.isIP(dotted) === 4) return dotted;

  const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;

  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function firstIPv6Segment(address: string): number | null {
  const segment = address.toLowerCase().split(":", 1)[0];
  if (!segment) return null;
  const value = Number.parseInt(segment, 16);
  return Number.isFinite(value) ? value : null;
}

function isIPv6Private(address: string): boolean {
  const normalized = address.toLowerCase();
  const ipv4 = mappedIPv4(normalized);
  if (ipv4) return isIPv4Private(ipv4);

  const first = firstIPv6Segment(normalized);
  if (normalized === "::1" || normalized === "::") return true;
  if (first === null) return false;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isIPv4Private(address);
  if (family === 6) return isIPv6Private(address);
  return false;
}

export function isConfiguredFakeIpAddress(address: string): boolean {
  const ipv4 = mappedIPv4(address) || address;
  return configuredFakeIpCidrs().some(cidr => isIPv4InCidr(ipv4, cidr));
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  if (isPrivateAddress(lower)) return true;
  return false;
}

export function isBlockedResolvedAddress(address: string): boolean {
  return isPrivateAddress(address) && !isConfiguredFakeIpAddress(address);
}

export async function resolveSafeAddresses(hostname: string): Promise<string[]> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked localhost/private URL");
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    const addresses = records.map(record => record.address);
    if (addresses.length === 0 || addresses.some(isBlockedResolvedAddress)) {
      throw new Error("Blocked localhost/private URL");
    }
    return addresses;
  } catch (error) {
    if (error instanceof Error && error.message === "Blocked localhost/private URL") throw error;
    throw new Error(`DNS lookup failed for ${hostname}`);
  }
}

export async function assertSafeUrl(url: URL): Promise<void> {
  if (!/^(https?):$/.test(url.protocol)) {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }

  await resolveSafeAddresses(url.hostname);
}
