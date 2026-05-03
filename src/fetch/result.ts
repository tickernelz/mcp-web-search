import type {
  FetchFormat,
  FetchMetadata,
  FetchOptions,
  FetchResult,
  ResourceType
} from "./types.js";
import { paginateContent } from "./truncation.js";

export interface BuildResultInput {
  url: string;
  final_url?: string;
  title?: string;
  content_type?: string;
  resource_type: ResourceType;
  format: FetchFormat;
  content: string;
  metadata: Omit<FetchMetadata, "fetched_at" | "extractor"> & {
    extractor: string;
    fetched_at?: string;
  };
  links?: FetchResult["links"];
  media?: FetchResult["media"];
  attachments?: FetchResult["attachments"];
  warnings?: string[];
  options?: FetchOptions;
}

export function buildFetchResult(input: BuildResultInput): FetchResult {
  const pagination = paginateContent(input.content, {
    max_length: input.options?.max_length,
    start_index: input.options?.start_index,
    format: input.format
  });

  return {
    url: input.url,
    final_url: input.final_url || input.url,
    title: input.title,
    content_type: input.content_type,
    resource_type: input.resource_type,
    format: input.format,
    content: pagination.content,
    metadata: {
      ...input.metadata,
      fetched_at: input.metadata.fetched_at || new Date().toISOString()
    },
    links: input.links,
    media: input.media,
    attachments: input.attachments,
    truncated: pagination.truncated,
    original_length: pagination.original_length,
    start_index: pagination.start_index,
    next_start_index: pagination.next_start_index,
    warnings: input.warnings || []
  };
}
