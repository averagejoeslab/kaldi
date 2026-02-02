/**
 * Syntax Highlighting
 *
 * Simple syntax highlighting for common languages.
 */

import { c, palette } from "../theme/colors.js";
import chalk from "chalk";

// Language patterns
const patterns = {
  keyword: /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|in|of|default|case|switch|break|continue)\b/g,
  string: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
  number: /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi,
  comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  type: /\b(string|number|boolean|void|null|undefined|any|never|unknown|object|Array|Object|Function|Promise|Map|Set)\b/g,
  function: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
  operator: /[+\-*/%=<>!&|^~?:]+/g,
};

// Colors for syntax elements
const syntaxColors = {
  keyword: chalk.hex(palette.coral),
  string: chalk.hex(palette.sage),
  number: chalk.hex(palette.honey),
  comment: chalk.hex(palette.dim),
  type: chalk.hex(palette.sky),
  function: chalk.hex(palette.caramel),
  operator: chalk.hex(palette.muted),
};

/**
 * Highlight code with syntax coloring
 */
export function highlight(code: string, language?: string): string {
  // Skip highlighting for very long code
  if (code.length > 10000) {
    return code;
  }

  let result = code;

  // Apply patterns in order (later patterns override earlier ones)
  // This is a simple approach - real highlighting would use a proper parser

  // Comments first (so they override everything)
  const comments: Array<{ start: number; end: number; text: string }> = [];
  result.replace(patterns.comment, (match, offset) => {
    comments.push({
      start: offset,
      end: offset + match.length,
      text: syntaxColors.comment(match),
    });
    return match;
  });

  // Strings next
  result = result.replace(patterns.string, (match) =>
    syntaxColors.string(match)
  );

  // Keywords
  result = result.replace(patterns.keyword, (match) =>
    syntaxColors.keyword(match)
  );

  // Types
  result = result.replace(patterns.type, (match) => syntaxColors.type(match));

  // Numbers
  result = result.replace(patterns.number, (match) =>
    syntaxColors.number(match)
  );

  return result;
}

/**
 * Detect language from filename or content
 */
export function detectLanguage(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase();

  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
  };

  return ext ? langMap[ext] : undefined;
}

/**
 * Format code block with optional highlighting
 */
export function formatCodeBlock(
  code: string,
  language?: string,
  showLineNumbers = false
): string {
  const lines = code.split("\n");
  const highlighted = highlight(code, language);
  const highlightedLines = highlighted.split("\n");

  if (!showLineNumbers) {
    return highlightedLines.join("\n");
  }

  const padding = String(lines.length).length;
  return highlightedLines
    .map((line, i) => {
      const lineNum = String(i + 1).padStart(padding);
      return `${c.dim(lineNum)} ${line}`;
    })
    .join("\n");
}
