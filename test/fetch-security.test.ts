import assert from "node:assert/strict";
import test from "node:test";
import {
  isBlockedHostname,
  isBlockedResolvedAddress,
  isConfiguredFakeIpAddress,
  isPrivateAddress
} from "../src/fetch/security.js";

test("isPrivateAddress blocks IPv4-mapped IPv6 private addresses", () => {
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateAddress("::ffff:7f00:1"), true);
  assert.equal(isPrivateAddress("::ffff:192.168.1.1"), true);
});

test("isPrivateAddress blocks full IPv6 link-local and multicast ranges", () => {
  assert.equal(isPrivateAddress("fe80::1"), true);
  assert.equal(isPrivateAddress("fe90::1"), true);
  assert.equal(isPrivateAddress("febf::1"), true);
  assert.equal(isPrivateAddress("ff02::1"), true);
});

test("isPrivateAddress allows ordinary public IPv6 addresses", () => {
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

test("configured fake-IP CIDRs can be allowed for resolved public hostnames", () => {
  const previous = process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS;
  process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS = "198.18.0.0/15";

  try {
    assert.equal(isPrivateAddress("198.18.0.130"), true);
    assert.equal(isConfiguredFakeIpAddress("198.18.0.130"), true);
    assert.equal(isBlockedResolvedAddress("198.18.0.130"), false);
  } finally {
    if (previous === undefined) {
      delete process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS;
    } else {
      process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS = previous;
    }
  }
});

test("direct fake-IP URLs remain blocked even when resolved fake IPs are allowed", () => {
  const previous = process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS;
  process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS = "198.18.0.0/15";

  try {
    assert.equal(isBlockedHostname("198.18.0.130"), true);
  } finally {
    if (previous === undefined) {
      delete process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS;
    } else {
      process.env.FETCH_URL_ALLOWED_FAKE_IP_CIDRS = previous;
    }
  }
});
