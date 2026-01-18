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
