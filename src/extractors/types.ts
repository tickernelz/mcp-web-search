export type FetchFormat = "markdown" | "text" | "html" | "json" | "raw" | "metadata";
export type FetchEngine = "auto" | "http" | "browser";
export type ResourceType =
  | "html"
  | "pdf"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "json"
  | "xml"
  | "csv"
  | "archive"
  | "site"
  | "unknown";

export interface FetchOptions {
  format?: FetchFormat;
  max_length?: number;
  start_index?: number;
  engine?: FetchEngine;
  include_links?: boolean;
  include_media?: boolean;
  include_metadata?: boolean;
  include_comments?: boolean;
  comment_limit?: number;
  comment_sort?: "top" | "best" | "new" | "controversial";
  max_depth?: number;
  timeout_ms?: number;
  fresh?: boolean;
}

export interface FetchMetadata {
  status?: number;
  content_type?: string;
  byte_length?: number;
  fetched_at: string;
  extractor: string;
  description?: string;
  canonical_url?: string;
  site_name?: string;
  language?: string;
  [key: string]: unknown;
}

export interface FetchLink {
  url: string;
  text?: string;
  title?: string;
  rel?: string;
  internal?: boolean;
}

export interface FetchImage {
  url: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface FetchMedia {
  images?: FetchImage[];
  videos?: FetchLink[];
  audio?: FetchLink[];
}

export interface FetchResult {
  url: string;
  final_url: string;
  title?: string;
  content_type?: string;
  resource_type: ResourceType;
  format: FetchFormat;
  content: string;
  metadata: FetchMetadata;
  links?: FetchLink[];
  media?: FetchMedia;
  attachments?: Array<Record<string, unknown>>;
  truncated: boolean;
  original_length: number;
  start_index: number;
  next_start_index: number | null;
  warnings: string[];
}

export interface ExtractResult {
  title: string;
  textContent: string;
  content: string;
  length: number;
}

export interface ExtractConfig {
  ignoreClasses: RegExp;
  minTextLength: number;
  columnMinText: number;
  columnThreshold: number;
  tagBoosts: Record<string, number>;
}

export const DEFAULT_CONFIG: ExtractConfig = {
  ignoreClasses: /nav|sidebar|ads|advertisement|footer|header|menu|comment/i,
  minTextLength: 50,
  columnMinText: 30,
  columnThreshold: 0.25,
  tagBoosts: { article: 1.7, main: 1.5, section: 1.3 }
};

export interface ContentChunk {
  content: string;
  type: "heading" | "paragraph" | "list" | "code" | "text";
  position: number;
  score: number;
  length: number;
}
