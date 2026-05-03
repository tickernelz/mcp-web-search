import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateAddress } from "../src/fetch/security.js";

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
