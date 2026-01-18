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

export type TruncationMode = "compact" | "standard" | "full";

export interface ExtractionOptions {
  mode?: TruncationMode;
  max_length?: number;
}

export interface ContentChunk {
  content: string;
  type: "heading" | "paragraph" | "list" | "code" | "text";
  position: number;
  score: number;
  length: number;
}

export interface TruncationResult {
  content: string;
  truncated: boolean;
  original_length: number;
  final_length: number;
  chunks_selected?: number;
  chunks_total?: number;
}
