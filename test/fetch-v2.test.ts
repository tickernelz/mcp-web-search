import assert from "node:assert/strict";
import test from "node:test";
import { fetchAndExtract } from "../src/extract.js";
import { fetchCache } from "../src/utils/cache.js";

function testTransport(handler: (url: URL) => Response | Promise<Response>) {
  return async (url: URL) => handler(url);
}

function clearFetchCache() {
  fetchCache.clear();
}

test("fetchAndExtract returns Fetch v2 content envelope for text with pagination metadata", async () => {
  const transport = testTransport(
    () =>
      new Response("0123456789abcdefghijklmnopqrstuvwxyz", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Content-Length": "36" }
      })
  );

  try {
    const result = await fetchAndExtract(
      "https://example.com/readme.txt",
      {
        format: "text",
        max_length: 10,
        start_index: 5
      },
      transport
    );

    assert.equal(result.url, "https://example.com/readme.txt");
    assert.equal(result.final_url, "https://example.com/readme.txt");
    assert.equal(result.resource_type, "text");
    assert.equal(result.format, "text");
    assert.equal(result.content, "56789abcde");
    assert.equal(result.truncated, true);
    assert.equal(result.original_length, 36);
    assert.equal(result.start_index, 5);
    assert.equal(result.next_start_index, 15);
    assert.equal(result.metadata.status, 200);
    assert.match(result.metadata.content_type ?? "", /text\/plain/);
    assert.equal(result.metadata.extractor, "text");
  } finally {
    clearFetchCache();
  }
});

test("fetchAndExtract extracts HTML into content and optional links/media", async () => {
  const transport = testTransport(
    () =>
      new Response(
        `<!doctype html><html><head><title>Example Article</title><meta name="description" content="Short desc"><link rel="canonical" href="https://example.com/canonical"></head><body><main><h1>Hello</h1><p>Useful body text for agents.</p><a href="/next">Next</a><img src="/hero.png" alt="Hero"></main></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
  );

  try {
    const result = await fetchAndExtract(
      "https://example.com/article",
      {
        include_links: true,
        include_media: true
      },
      transport
    );

    assert.equal(result.title, "Example Article");
    assert.equal(result.resource_type, "html");
    assert.equal(result.format, "markdown");
    assert.match(result.content, /Hello/);
    assert.match(result.content, /Useful body text/);
    assert.equal(result.metadata.description, "Short desc");
    assert.equal(result.metadata.canonical_url, "https://example.com/canonical");
    assert.equal(result.links?.[0].url, "https://example.com/next");
    assert.equal(result.media?.images?.[0].url, "https://example.com/hero.png");
    assert.equal(result.media?.images?.[0].alt, "Hero");
  } finally {
    clearFetchCache();
  }
});

test("fetchAndExtract uses Reddit JSON site adapter for Reddit thread URLs", async () => {
  const requests: string[] = [];
  const transport = testTransport(url => {
    requests.push(url.toString());
    const body = JSON.stringify([
      {
        data: {
          children: [
            {
              data: {
                title: "GPT-5.5 is so good",
                selftext: "Post body about Codex.",
                subreddit_name_prefixed: "r/codex",
                score: 120,
                num_comments: 2,
                permalink: "/r/codex/comments/abc123/gpt55_is_so_good/"
              }
            }
          ]
        }
      },
      {
        data: {
          children: [
            {
              kind: "t1",
              data: {
                body: "Top comment is useful.",
                score: 50,
                depth: 0,
                permalink: "/r/codex/comments/abc123/comment1/"
              }
            },
            {
              kind: "t1",
              data: {
                body: "[deleted]",
                score: 1,
                depth: 0,
                permalink: "/r/codex/comments/abc123/comment2/"
              }
            }
          ]
        }
      }
    ]);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Length": String(body.length) }
    });
  });

  try {
    const result = await fetchAndExtract(
      "https://www.reddit.com/r/codex/comments/abc123/gpt55_is_so_good/",
      {
        include_comments: true,
        comment_limit: 10
      },
      transport
    );

    assert.equal(result.resource_type, "site");
    assert.equal(result.metadata.extractor, "reddit-thread");
    assert.equal(result.title, "GPT-5.5 is so good");
    assert.match(result.content, /Post body about Codex/);
    assert.match(result.content, /Top comment is useful/);
    assert.doesNotMatch(result.content, /\[deleted\]/);
    assert.equal(result.metadata.subreddit, "r/codex");
    assert.equal(
      requests[0],
      "https://www.reddit.com/comments/abc123.json?raw_json=1&sort=top&limit=10"
    );
  } finally {
    clearFetchCache();
  }
});

test("fetchAndExtract rejects localhost before network fetch", async () => {
  const transport = testTransport(() => {
    throw new Error("network should not be called");
  });

  try {
    await assert.rejects(
      () => fetchAndExtract("http://localhost:8080/private", {}, transport),
      /Blocked localhost\/private URL/
    );
  } finally {
    clearFetchCache();
  }
});

test("fetchAndExtract rejects unsafe redirects before following them", async () => {
  const requests: string[] = [];
  const transport = testTransport(url => {
    requests.push(url.toString());
    return new Response(null, {
      status: 302,
      headers: { Location: "http://localhost:8080/private" }
    });
  });

  try {
    await assert.rejects(
      () => fetchAndExtract("https://example.com/redirect", {}, transport),
      /Blocked localhost\/private URL/
    );
    assert.deepEqual(requests, ["https://example.com/redirect"]);
  } finally {
    clearFetchCache();
  }
});

test("fetchAndExtract keeps zero-valued options distinct in cache keys", async () => {
  let fetchCount = 0;
  const transport = testTransport(() => {
    fetchCount += 1;
    return new Response("abcdef", {
      status: 200,
      headers: { "Content-Type": "text/plain", "Content-Length": "6" }
    });
  });

  try {
    const empty = await fetchAndExtract(
      "https://example.com/cache.txt",
      {
        format: "text",
        max_length: 0
      },
      transport
    );
    const full = await fetchAndExtract(
      "https://example.com/cache.txt",
      { format: "text" },
      transport
    );

    assert.equal(empty.content, "");
    assert.equal(empty.next_start_index, null);
    assert.equal(full.content, "abcdef");
    assert.equal(fetchCount, 2);
  } finally {
    clearFetchCache();
  }
});
