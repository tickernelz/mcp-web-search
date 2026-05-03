import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined"
});

turndownService.addRule("removeEmptyElements", {
  filter: (node: HTMLElement) => {
    return node.textContent?.trim() === "" && !["IMG", "BR", "HR"].includes(node.nodeName);
  },
  replacement: () => ""
});

turndownService.addRule("preserveCodeBlocks", {
  filter: ["pre", "code"],
  replacement: (content: string, node: HTMLElement) => {
    if (node.nodeName === "PRE") {
      const code = node.querySelector("code");
      const lang = code?.className.match(/language-(\w+)/)?.[1] || "";
      return `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
    }
    return `\`${content}\``;
  }
});

export function htmlToMarkdown(html: string): string | null {
  try {
    if (!html || html.trim().length === 0) return null;
    const markdown = turndownService.turndown(html);
    if (!markdown || markdown.trim().length === 0) return null;
    return markdown.trim();
  } catch (error) {
    console.error("Markdown conversion failed:", error);
    return null;
  }
}
