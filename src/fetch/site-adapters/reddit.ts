import { MAX_BYTES } from "../../constants.js";
import type { FetchFormat, FetchOptions, FetchResult } from "../../extractors/types.js";
import { fetchResource, type FetchTransport } from "../http.js";
import { buildFetchResult } from "../result.js";
import type { SiteAdapter } from "./types.js";

const REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "m.reddit.com"]);

interface RedditListingChild {
  kind?: string;
  data?: any;
}

function threadIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/comments\/([A-Za-z0-9_]+)/);
  return match?.[1] || null;
}

function normalizeBody(body: string | undefined): string {
  if (!body) return "";
  const trimmed = body.trim();
  if (!trimmed || trimmed === "[deleted]" || trimmed === "[removed]") return "";
  return trimmed.replace(/\r\n/g, "\n");
}

function renderComments(
  children: RedditListingChild[],
  maxDepth: number,
  remaining: { count: number }
): string[] {
  const rendered: string[] = [];
  for (const child of children) {
    if (remaining.count <= 0) break;
    if (child.kind !== "t1") continue;
    const data = child.data || {};
    const depth = Number(data.depth || 0);
    if (depth > maxDepth) continue;
    const body = normalizeBody(data.body);
    if (!body) continue;

    remaining.count -= 1;
    rendered.push(
      `### Comment ${rendered.length + 1} — ${data.score ?? 0} points\n\n${body.slice(0, 1500)}`
    );

    const replies = data.replies?.data?.children;
    if (Array.isArray(replies) && remaining.count > 0) {
      rendered.push(...renderComments(replies, maxDepth, remaining));
    }
  }
  return rendered;
}

export class RedditThreadAdapter implements SiteAdapter {
  name = "reddit-thread";

  canHandle(url: URL): boolean {
    return REDDIT_HOSTS.has(url.hostname.toLowerCase()) && Boolean(threadIdFromUrl(url));
  }

  async extract(
    url: URL,
    options?: FetchOptions,
    transport?: FetchTransport
  ): Promise<FetchResult> {
    const threadId = threadIdFromUrl(url);
    if (!threadId) throw new Error("Unsupported Reddit URL");

    const commentLimit = Math.min(Math.max(0, options?.comment_limit ?? 30), 100);
    const commentSort = options?.comment_sort || "top";
    const maxDepth = Math.min(Math.max(0, options?.max_depth ?? 2), 8);
    const jsonUrl = new URL(`https://www.reddit.com/comments/${threadId}.json`);
    jsonUrl.searchParams.set("raw_json", "1");
    jsonUrl.searchParams.set("sort", commentSort);
    jsonUrl.searchParams.set("limit", String(commentLimit));

    const resource = await fetchResource(jsonUrl, options?.timeout_ms, transport);
    const response = resource.response;
    if (resource.byteLength > MAX_BYTES) throw new Error("Content too large (downloaded)");

    const payload = JSON.parse(resource.buffer.toString("utf8"));
    const post = payload?.[0]?.data?.children?.[0]?.data;
    if (!post) throw new Error("Reddit response did not include a post");

    const postBody = normalizeBody(post.selftext);
    const parts = [
      `# ${post.title || "Reddit thread"}`,
      `Subreddit: ${post.subreddit_name_prefixed || (post.subreddit ? `r/${post.subreddit}` : "unknown")}`,
      `Score: ${post.score ?? 0}`,
      `Comments: ${post.num_comments ?? 0}`,
      `URL: ${new URL(post.permalink || url.pathname, "https://www.reddit.com").toString()}`
    ];

    if (postBody) {
      parts.push("## Post", postBody);
    }

    const shouldIncludeComments = options?.include_comments !== false;
    if (shouldIncludeComments && commentLimit > 0) {
      const comments = renderComments(payload?.[1]?.data?.children || [], maxDepth, {
        count: commentLimit
      });
      if (comments.length > 0) parts.push("## Top comments", ...comments);
    }

    const markdown = parts.join("\n\n");
    const format: FetchFormat =
      options?.format === "json" || options?.format === "metadata"
        ? "json"
        : options?.format === "text"
          ? "text"
          : "markdown";
    const content =
      format === "json"
        ? JSON.stringify(
            {
              title: post.title || "Reddit thread",
              subreddit:
                post.subreddit_name_prefixed ||
                (post.subreddit ? `r/${post.subreddit}` : undefined),
              score: post.score,
              comments: post.num_comments,
              content: markdown
            },
            null,
            2
          )
        : markdown;
    return buildFetchResult({
      url: url.toString(),
      final_url: url.toString(),
      title: post.title || undefined,
      content_type: "application/json",
      resource_type: "site",
      format,
      content,
      metadata: {
        status: response.status,
        content_type: "application/json",
        byte_length: resource.byteLength,
        extractor: this.name,
        subreddit:
          post.subreddit_name_prefixed || (post.subreddit ? `r/${post.subreddit}` : undefined),
        score: post.score,
        comments: post.num_comments,
        json_url: jsonUrl.toString()
      },
      options
    });
  }
}
