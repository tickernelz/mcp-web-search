import type { FetchFormat } from "./types.js";

const DEFAULT_MAX_LENGTH = 25000;

export interface PaginationResult {
  content: string;
  truncated: boolean;
  original_length: number;
  final_length: number;
  start_index: number;
  next_start_index: number | null;
}

export function paginateContent(
  content: string,
  options?: { max_length?: number; start_index?: number; format?: FetchFormat }
): PaginationResult {
  const startIndex = Math.max(0, Math.floor(options?.start_index ?? 0));
  const maxLength = Math.max(0, Math.floor(options?.max_length ?? DEFAULT_MAX_LENGTH));
  const originalLength = content.length;

  if (maxLength === 0) {
    return {
      content: "",
      truncated: startIndex < originalLength,
      original_length: originalLength,
      final_length: 0,
      start_index: startIndex,
      next_start_index: null
    };
  }

  if (startIndex >= originalLength) {
    return {
      content: "",
      truncated: false,
      original_length: originalLength,
      final_length: 0,
      start_index: startIndex,
      next_start_index: null
    };
  }

  const endIndex = Math.min(startIndex + maxLength, originalLength);
  const slice = content.slice(startIndex, endIndex);
  return {
    content: slice,
    truncated: endIndex < originalLength,
    original_length: originalLength,
    final_length: slice.length,
    start_index: startIndex,
    next_start_index: endIndex < originalLength ? endIndex : null
  };
}
