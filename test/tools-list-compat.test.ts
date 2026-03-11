import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

const REPO_ROOT = "/Users/zhafron/Projects/mcp-web-search";

class JsonRpcStream {
  private buffer = Buffer.alloc(0);
  private queue: unknown[] = [];
  private resolvers: Array<(value: unknown) => void> = [];

  push(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const lineEnd = this.buffer.indexOf("\n");
      if (lineEnd === -1) {
        return;
      }

      const line = this.buffer.subarray(0, lineEnd).toString("utf8").replace(/\r$/, "");
      this.buffer = this.buffer.subarray(lineEnd + 1);

      if (!line) {
        continue;
      }

      this.enqueue(JSON.parse(line));
    }
  }

  async next() {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }

    return await new Promise(resolve => {
      this.resolvers.push(resolve);
    });
  }

  private enqueue(message: unknown) {
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(message);
      return;
    }

    this.queue.push(message);
  }
}

function encodeMessage(message: unknown) {
  return `${JSON.stringify(message)}\n`;
}

function hasArrayNode(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value).some(hasArrayNode);
}

async function listTools(env: NodeJS.ProcessEnv = {}) {
  const child = spawn("node", ["--import", "tsx", "src/server.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  const stderrChunks: Buffer[] = [];
  const stream = new JsonRpcStream();

  child.stdout.on("data", chunk => {
    stream.push(chunk as Buffer);
  });

  child.stderr.on("data", chunk => {
    stderrChunks.push(chunk as Buffer);
  });

  const send = (message: unknown) => {
    child.stdin.write(encodeMessage(message));
  };

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "compat-test", version: "1.0.0" }
    }
  });

  const initializeResponse = (await stream.next()) as { result?: unknown; error?: unknown };
  assert.ok(initializeResponse.result, `initialize failed: ${JSON.stringify(initializeResponse.error)}`);

  send({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  });

  send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });

  const toolsResponse = (await stream.next()) as {
    result?: { tools: Array<{ name: string; inputSchema?: unknown }> };
    error?: unknown;
  };

  return {
    tools: toolsResponse.result?.tools ?? [],
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
    async dispose() {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  };
}

test("default discovery schema still contains array nodes", async () => {
  const server = await listTools();

  try {
    assert.ok(server.tools.length > 0, `no tools returned; stderr: ${server.stderr}`);
    assert.equal(server.tools.some(tool => hasArrayNode(tool.inputSchema)), true);
  } finally {
    await server.dispose();
  }
});

test("legacy compat mode removes array nodes from tool schemas", async () => {
  const server = await listTools({ MCP_COMPAT_MODE: "legacy" });

  try {
    assert.ok(server.tools.length > 0, `no tools returned; stderr: ${server.stderr}`);
    for (const tool of server.tools) {
      assert.equal(
        hasArrayNode(tool.inputSchema),
        false,
        `${tool.name} still exposes array-valued schema nodes in compat mode`
      );
    }
  } finally {
    await server.dispose();
  }
});
