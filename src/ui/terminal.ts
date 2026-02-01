/**
 * Comprehensive Terminal UI System for Kaldi CLI
 *
 * Named after Kaldi - the Ethiopian goatherd who discovered coffee
 * when he noticed his goats dancing after eating coffee berries.
 *
 * This module provides:
 * - Multi-line input with visual highlight
 * - Markdown rendering with syntax highlighting
 * - Context window visualization
 * - Theme system with multiple color schemes
 * - Progress bar for long operations
 * - Interactive diff viewer
 */

import chalk, { type ChalkInstance } from "chalk";
import * as readline from "readline";
import * as Diff from "diff";

// ============================================================================
// THEME SYSTEM
// ============================================================================

/**
 * Color palette for a theme
 */
export interface ThemePalette {
  // Primary colors
  primary: string;
  secondary: string;
  accent: string;

  // Text colors
  text: string;
  textDim: string;
  textMuted: string;

  // Backgrounds
  background: string;
  backgroundHighlight: string;
  backgroundInput: string;

  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Diff colors
  diffAdd: string;
  diffRemove: string;
  diffContext: string;

  // Context window colors
  contextUsed: string;
  contextFree: string;
  contextWarning: string;
  contextCritical: string;

  // Code highlighting
  codeKeyword: string;
  codeString: string;
  codeComment: string;
  codeNumber: string;
  codeFunction: string;
  codeVariable: string;
  codeOperator: string;
}

/**
 * Predefined themes
 */
export const themes: Record<string, ThemePalette> = {
  // Default coffee/warm theme - named after Kaldi's discovery
  default: {
    primary: "#D4A574",      // Warm coffee brown
    secondary: "#8B6914",    // Dark roast
    accent: "#C4956A",       // Latte foam

    text: "#E8DCC4",         // Cream
    textDim: "#9C8E7C",      // Aged paper
    textMuted: "#6B5F52",    // Coffee grounds

    background: "#1A1410",   // Dark roast background
    backgroundHighlight: "#2D2318", // Espresso
    backgroundInput: "#2D4F67",     // Cool accent for input

    success: "#7CB342",      // Fresh leaves (like coffee plant)
    warning: "#FFB300",      // Golden honey
    error: "#E57373",        // Dried cherry
    info: "#64B5F6",         // Morning sky

    diffAdd: "#4CAF50",
    diffRemove: "#F44336",
    diffContext: "#9C8E7C",

    contextUsed: "#D4A574",
    contextFree: "#3D3228",
    contextWarning: "#FFB300",
    contextCritical: "#E57373",

    codeKeyword: "#C792EA",
    codeString: "#C3E88D",
    codeComment: "#6B5F52",
    codeNumber: "#F78C6C",
    codeFunction: "#82AAFF",
    codeVariable: "#FFCB6B",
    codeOperator: "#89DDFF",
  },

  // Dark theme - "Midnight Roast"
  dark: {
    primary: "#BB86FC",
    secondary: "#03DAC6",
    accent: "#CF6679",

    text: "#E1E1E1",
    textDim: "#888888",
    textMuted: "#555555",

    background: "#121212",
    backgroundHighlight: "#1E1E1E",
    backgroundInput: "#252525",

    success: "#00E676",
    warning: "#FFD600",
    error: "#FF5252",
    info: "#448AFF",

    diffAdd: "#00E676",
    diffRemove: "#FF5252",
    diffContext: "#888888",

    contextUsed: "#BB86FC",
    contextFree: "#333333",
    contextWarning: "#FFD600",
    contextCritical: "#FF5252",

    codeKeyword: "#BB86FC",
    codeString: "#03DAC6",
    codeComment: "#555555",
    codeNumber: "#FF7043",
    codeFunction: "#82B1FF",
    codeVariable: "#FFCC80",
    codeOperator: "#89DDFF",
  },

  // Light theme - "Morning Brew"
  light: {
    primary: "#6F4E37",      // Coffee
    secondary: "#8B4513",    // Saddle brown
    accent: "#D2691E",       // Chocolate

    text: "#2D2D2D",
    textDim: "#666666",
    textMuted: "#999999",

    background: "#FAFAFA",
    backgroundHighlight: "#F0F0F0",
    backgroundInput: "#E3F2FD",

    success: "#2E7D32",
    warning: "#F57F17",
    error: "#C62828",
    info: "#1565C0",

    diffAdd: "#2E7D32",
    diffRemove: "#C62828",
    diffContext: "#666666",

    contextUsed: "#6F4E37",
    contextFree: "#E0E0E0",
    contextWarning: "#F57F17",
    contextCritical: "#C62828",

    codeKeyword: "#7B1FA2",
    codeString: "#2E7D32",
    codeComment: "#999999",
    codeNumber: "#E65100",
    codeFunction: "#1565C0",
    codeVariable: "#6F4E37",
    codeOperator: "#37474F",
  },

  // High contrast theme - "Bold Espresso"
  highContrast: {
    primary: "#FFFF00",
    secondary: "#00FFFF",
    accent: "#FF00FF",

    text: "#FFFFFF",
    textDim: "#CCCCCC",
    textMuted: "#888888",

    background: "#000000",
    backgroundHighlight: "#1A1A1A",
    backgroundInput: "#000033",

    success: "#00FF00",
    warning: "#FFFF00",
    error: "#FF0000",
    info: "#00FFFF",

    diffAdd: "#00FF00",
    diffRemove: "#FF0000",
    diffContext: "#CCCCCC",

    contextUsed: "#FFFF00",
    contextFree: "#333333",
    contextWarning: "#FFFF00",
    contextCritical: "#FF0000",

    codeKeyword: "#FF00FF",
    codeString: "#00FF00",
    codeComment: "#888888",
    codeNumber: "#FFFF00",
    codeFunction: "#00FFFF",
    codeVariable: "#FFFFFF",
    codeOperator: "#00FFFF",
  },
};

/**
 * Current active theme
 */
let currentTheme: ThemePalette = themes.default;

/**
 * Set the active theme
 */
export function setTheme(themeName: keyof typeof themes | ThemePalette): void {
  if (typeof themeName === "string") {
    currentTheme = themes[themeName] || themes.default;
  } else {
    currentTheme = themeName;
  }
}

/**
 * Get the current theme
 */
export function getTheme(): ThemePalette {
  return currentTheme;
}

/**
 * Create chalk instances for current theme
 */
export function getThemeChalk(): {
  primary: ChalkInstance;
  secondary: ChalkInstance;
  accent: ChalkInstance;
  text: ChalkInstance;
  dim: ChalkInstance;
  muted: ChalkInstance;
  success: ChalkInstance;
  warning: ChalkInstance;
  error: ChalkInstance;
  info: ChalkInstance;
  bgHighlight: ChalkInstance;
  bgInput: ChalkInstance;
} {
  const t = currentTheme;
  return {
    primary: chalk.hex(t.primary),
    secondary: chalk.hex(t.secondary),
    accent: chalk.hex(t.accent),
    text: chalk.hex(t.text),
    dim: chalk.hex(t.textDim),
    muted: chalk.hex(t.textMuted),
    success: chalk.hex(t.success),
    warning: chalk.hex(t.warning),
    error: chalk.hex(t.error),
    info: chalk.hex(t.info),
    bgHighlight: chalk.bgHex(t.backgroundHighlight),
    bgInput: chalk.bgHex(t.backgroundInput),
  };
}

// ============================================================================
// MULTI-LINE INPUT
// ============================================================================

export interface MultiLineInputOptions {
  prompt?: string;
  placeholder?: string;
  initialValue?: string;
  lineNumbers?: boolean;
  highlightBackground?: boolean;
  maxLines?: number;
}

export interface MultiLineInputResult {
  text: string;
  cancelled: boolean;
  lineCount: number;
}

/**
 * Multi-line input handler with visual highlighting
 * Supports: Shift+Enter, Option+Enter, Ctrl+J for newlines
 */
export class MultiLineInput {
  private lines: string[] = [""];
  private cursorLine: number = 0;
  private cursorCol: number = 0;
  private options: Required<MultiLineInputOptions>;
  private isActive: boolean = false;
  private scrollOffset: number = 0;
  private maxVisibleLines: number = 10;

  constructor(options: MultiLineInputOptions = {}) {
    this.options = {
      prompt: options.prompt ?? ">>> ",
      placeholder: options.placeholder ?? "",
      initialValue: options.initialValue ?? "",
      lineNumbers: options.lineNumbers ?? true,
      highlightBackground: options.highlightBackground ?? true,
      maxLines: options.maxLines ?? 100,
    };

    if (this.options.initialValue) {
      this.lines = this.options.initialValue.split("\n");
      this.cursorLine = this.lines.length - 1;
      this.cursorCol = this.lines[this.cursorLine].length;
    }
  }

  /**
   * Start the multi-line input
   */
  async start(): Promise<MultiLineInputResult> {
    return new Promise((resolve) => {
      this.isActive = true;

      // Enable raw mode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      this.render();

      const handleKeypress = (chunk: Buffer) => {
        if (!this.isActive) return;

        const key = chunk.toString();
        const ctrl = chunk[0] === 0x1b || (chunk.length === 1 && chunk[0] < 32);

        // Handle escape sequences
        if (chunk[0] === 0x1b && chunk.length > 1) {
          const seq = chunk.toString();

          // Arrow keys
          if (seq === "\x1b[A") { // Up
            this.moveCursor(0, -1);
          } else if (seq === "\x1b[B") { // Down
            this.moveCursor(0, 1);
          } else if (seq === "\x1b[C") { // Right
            this.moveCursor(1, 0);
          } else if (seq === "\x1b[D") { // Left
            this.moveCursor(-1, 0);
          } else if (seq === "\x1b[H") { // Home
            this.cursorCol = 0;
          } else if (seq === "\x1b[F") { // End
            this.cursorCol = this.lines[this.cursorLine].length;
          } else if (seq === "\x1b\r" || seq === "\x1b\n") { // Option+Enter (Mac)
            this.insertNewline();
          }

          this.render();
          return;
        }

        // Ctrl+C - cancel
        if (key === "\x03") {
          this.cleanup();
          resolve({
            text: "",
            cancelled: true,
            lineCount: 0,
          });
          return;
        }

        // Ctrl+D or Ctrl+Enter - submit
        if (key === "\x04" || (ctrl && key === "\r")) {
          this.cleanup();
          resolve({
            text: this.lines.join("\n"),
            cancelled: false,
            lineCount: this.lines.length,
          });
          return;
        }

        // Enter without modifier - submit (single line) or newline based on context
        if (key === "\r" || key === "\n") {
          // If it's a single line and Enter is pressed, submit
          if (this.lines.length === 1 && this.lines[0].trim()) {
            this.cleanup();
            resolve({
              text: this.lines.join("\n"),
              cancelled: false,
              lineCount: this.lines.length,
            });
            return;
          }
          // Otherwise, check if current line is empty (double-enter to submit)
          if (this.lines[this.cursorLine] === "" && this.cursorLine > 0) {
            this.cleanup();
            resolve({
              text: this.lines.slice(0, -1).join("\n"),
              cancelled: false,
              lineCount: this.lines.length - 1,
            });
            return;
          }
          this.insertNewline();
          this.render();
          return;
        }

        // Ctrl+J - newline
        if (key === "\x0a") {
          this.insertNewline();
          this.render();
          return;
        }

        // Backspace
        if (key === "\x7f" || key === "\b") {
          this.handleBackspace();
          this.render();
          return;
        }

        // Delete
        if (key === "\x1b[3~") {
          this.handleDelete();
          this.render();
          return;
        }

        // Regular character
        if (key.length === 1 && key >= " ") {
          this.insertChar(key);
          this.render();
        }
      };

      process.stdin.on("data", handleKeypress);
    });
  }

  private insertNewline(): void {
    if (this.lines.length >= this.options.maxLines) return;

    const currentLine = this.lines[this.cursorLine];
    const before = currentLine.slice(0, this.cursorCol);
    const after = currentLine.slice(this.cursorCol);

    this.lines[this.cursorLine] = before;
    this.lines.splice(this.cursorLine + 1, 0, after);
    this.cursorLine++;
    this.cursorCol = 0;

    this.adjustScroll();
  }

  private insertChar(char: string): void {
    const line = this.lines[this.cursorLine];
    this.lines[this.cursorLine] = line.slice(0, this.cursorCol) + char + line.slice(this.cursorCol);
    this.cursorCol++;
  }

  private handleBackspace(): void {
    if (this.cursorCol > 0) {
      const line = this.lines[this.cursorLine];
      this.lines[this.cursorLine] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol--;
    } else if (this.cursorLine > 0) {
      const currentLine = this.lines[this.cursorLine];
      const prevLine = this.lines[this.cursorLine - 1];
      this.cursorCol = prevLine.length;
      this.lines[this.cursorLine - 1] = prevLine + currentLine;
      this.lines.splice(this.cursorLine, 1);
      this.cursorLine--;
      this.adjustScroll();
    }
  }

  private handleDelete(): void {
    const line = this.lines[this.cursorLine];
    if (this.cursorCol < line.length) {
      this.lines[this.cursorLine] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
    } else if (this.cursorLine < this.lines.length - 1) {
      this.lines[this.cursorLine] = line + this.lines[this.cursorLine + 1];
      this.lines.splice(this.cursorLine + 1, 1);
    }
  }

  private moveCursor(dx: number, dy: number): void {
    if (dy !== 0) {
      const newLine = Math.max(0, Math.min(this.lines.length - 1, this.cursorLine + dy));
      if (newLine !== this.cursorLine) {
        this.cursorLine = newLine;
        this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorLine].length);
        this.adjustScroll();
      }
    }

    if (dx !== 0) {
      const line = this.lines[this.cursorLine];
      this.cursorCol = Math.max(0, Math.min(line.length, this.cursorCol + dx));
    }
  }

  private adjustScroll(): void {
    if (this.cursorLine < this.scrollOffset) {
      this.scrollOffset = this.cursorLine;
    } else if (this.cursorLine >= this.scrollOffset + this.maxVisibleLines) {
      this.scrollOffset = this.cursorLine - this.maxVisibleLines + 1;
    }
  }

  private render(): void {
    const tc = getThemeChalk();
    const t = currentTheme;

    // Clear previous render
    const linesToClear = Math.min(this.lines.length, this.maxVisibleLines) + 1;
    process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);

    // Render header
    process.stdout.write(tc.dim(`${this.options.prompt}`) + tc.muted("(Enter to send, Shift+Enter for newline, Ctrl+D to submit multi-line)\n"));

    // Render lines
    const visibleLines = this.lines.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleLines);

    for (let i = 0; i < visibleLines.length; i++) {
      const lineNum = this.scrollOffset + i;
      const line = visibleLines[i];
      const isCurrentLine = lineNum === this.cursorLine;

      // Line number
      let output = "";
      if (this.options.lineNumbers) {
        const numStr = String(lineNum + 1).padStart(3, " ");
        output += tc.muted(numStr + " ");
      }

      // Line content with optional background highlight
      if (this.options.highlightBackground) {
        const bgChalk = chalk.bgHex(t.backgroundInput);
        const paddedLine = line.padEnd(process.stdout.columns - 6 || 74, " ");
        output += bgChalk(tc.text(paddedLine));
      } else {
        output += tc.text(line);
      }

      process.stdout.write(output + "\n");
    }

    // Position cursor
    const cursorY = this.cursorLine - this.scrollOffset;
    const cursorX = this.cursorCol + (this.options.lineNumbers ? 4 : 0);
    process.stdout.write(`\x1b[${visibleLines.length - cursorY}A\x1b[${cursorX + 1}G`);
  }

  private cleanup(): void {
    this.isActive = false;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdout.write("\n");
  }
}

/**
 * Simple function to get multi-line input
 */
export async function getMultiLineInput(options?: MultiLineInputOptions): Promise<MultiLineInputResult> {
  const input = new MultiLineInput(options);
  return input.start();
}

// ============================================================================
// MARKDOWN RENDERING
// ============================================================================

/**
 * Simple syntax highlighting for code
 */
function highlightCode(code: string, language: string): string {
  const t = currentTheme;

  // Language-specific keyword sets
  const keywords: Record<string, string[]> = {
    javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "typeof", "instanceof"],
    typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "typeof", "instanceof", "interface", "type", "enum", "implements", "private", "public", "protected", "readonly"],
    python: ["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "try", "except", "finally", "raise", "with", "lambda", "yield", "async", "await", "True", "False", "None", "and", "or", "not", "in", "is"],
    rust: ["fn", "let", "mut", "const", "struct", "enum", "impl", "trait", "pub", "mod", "use", "if", "else", "match", "loop", "while", "for", "return", "async", "await", "move", "self", "Self", "true", "false"],
    go: ["func", "var", "const", "type", "struct", "interface", "map", "chan", "go", "defer", "if", "else", "for", "range", "switch", "case", "return", "package", "import", "true", "false", "nil"],
    bash: ["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "function", "return", "export", "local", "echo", "exit"],
    sh: ["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "function", "return", "export", "local", "echo", "exit"],
  };

  const langKeywords = keywords[language.toLowerCase()] || keywords.javascript || [];
  let highlighted = code;

  // Highlight strings (simple approach)
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
    return chalk.hex(t.codeString)(match);
  });

  // Highlight comments (// and #)
  highlighted = highlighted.replace(/(\/\/.*$|#.*$)/gm, (match) => {
    return chalk.hex(t.codeComment)(match);
  });

  // Highlight numbers
  highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, (match) => {
    return chalk.hex(t.codeNumber)(match);
  });

  // Highlight keywords
  for (const keyword of langKeywords) {
    const regex = new RegExp(`\\b(${keyword})\\b`, "g");
    highlighted = highlighted.replace(regex, chalk.hex(t.codeKeyword)("$1"));
  }

  return highlighted;
}

/**
 * Render markdown to terminal-formatted string
 */
export function renderMarkdown(markdown: string): string {
  const tc = getThemeChalk();
  const t = currentTheme;
  const lines: string[] = [];
  const input = markdown.split("\n");

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];

  for (let i = 0; i < input.length; i++) {
    const line = input[i];

    // Code block handling
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // End code block - render it
        const code = codeBlockContent.join("\n");
        const highlighted = highlightCode(code, codeBlockLang);
        const langLabel = codeBlockLang ? tc.muted(` ${codeBlockLang} `) : "";

        lines.push(chalk.bgHex(t.backgroundHighlight)(tc.muted("  " + "─".repeat(58)) + langLabel));

        for (const codeLine of highlighted.split("\n")) {
          const paddedLine = "  " + codeLine.padEnd(60, " ");
          lines.push(chalk.bgHex(t.backgroundHighlight)(paddedLine));
        }

        lines.push(chalk.bgHex(t.backgroundHighlight)(tc.muted("  " + "─".repeat(60))));

        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      lines.push("");
      lines.push(tc.primary.bold(line.slice(2)));
      lines.push(tc.primary("═".repeat(Math.min(line.length - 2, 60))));
      continue;
    }

    if (line.startsWith("## ")) {
      lines.push("");
      lines.push(tc.secondary.bold(line.slice(3)));
      lines.push(tc.secondary("─".repeat(Math.min(line.length - 3, 50))));
      continue;
    }

    if (line.startsWith("### ")) {
      lines.push("");
      lines.push(tc.accent.bold(line.slice(4)));
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      lines.push(tc.muted("│ ") + tc.dim.italic(line.slice(2)));
      continue;
    }

    // Unordered lists
    if (line.match(/^[\s]*[-*+] /)) {
      const indent = line.match(/^[\s]*/)?.[0] || "";
      const content = line.replace(/^[\s]*[-*+] /, "");
      lines.push(indent + tc.accent("• ") + formatInlineMarkdown(content));
      continue;
    }

    // Ordered lists
    if (line.match(/^[\s]*\d+\. /)) {
      const match = line.match(/^([\s]*)(\d+)\. (.*)$/);
      if (match) {
        const [, indent, num, content] = match;
        lines.push(indent + tc.accent(`${num}. `) + formatInlineMarkdown(content));
      }
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      lines.push(tc.muted("─".repeat(60)));
      continue;
    }

    // Regular paragraph
    lines.push(formatInlineMarkdown(line));
  }

  return lines.join("\n");
}

/**
 * Format inline markdown (bold, italic, code, links)
 */
function formatInlineMarkdown(text: string): string {
  const tc = getThemeChalk();
  const t = currentTheme;

  // Inline code
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    return chalk.bgHex(t.backgroundHighlight)(tc.accent(` ${code} `));
  });

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return tc.text.bold(content);
  });

  // Italic
  text = text.replace(/\*([^*]+)\*/g, (_, content) => {
    return tc.text.italic(content);
  });

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    return tc.info.underline(label) + tc.muted(` (${url})`);
  });

  return text;
}

// ============================================================================
// CONTEXT WINDOW VISUALIZATION
// ============================================================================

export interface ContextWindowOptions {
  used: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  showNumbers?: boolean;
  label?: string;
}

/**
 * Create a visual representation of context window usage
 * Uses a colored grid to show token usage
 */
export function renderContextWindow(options: ContextWindowOptions): string {
  const { used, total, width = 40, showPercentage = true, showNumbers = true, label = "Context" } = options;
  const tc = getThemeChalk();
  const t = currentTheme;

  const percentage = Math.min(100, (used / total) * 100);
  const filledBlocks = Math.round((percentage / 100) * width);

  // Determine color based on usage
  let usedColor: string;
  if (percentage < 50) {
    usedColor = t.contextUsed;
  } else if (percentage < 75) {
    usedColor = t.contextWarning;
  } else {
    usedColor = t.contextCritical;
  }

  // Build the bar
  const filled = chalk.bgHex(usedColor)(" ".repeat(filledBlocks));
  const empty = chalk.bgHex(t.contextFree)(" ".repeat(width - filledBlocks));
  const bar = filled + empty;

  // Build info string
  const parts: string[] = [];

  if (label) {
    parts.push(tc.dim(label + ": "));
  }

  parts.push(bar);

  if (showPercentage) {
    parts.push(tc.dim(` ${percentage.toFixed(1)}%`));
  }

  if (showNumbers) {
    const usedStr = formatTokenCount(used);
    const totalStr = formatTokenCount(total);
    parts.push(tc.muted(` (${usedStr}/${totalStr})`));
  }

  return parts.join("");
}

/**
 * Format token count for display (e.g., 10k, 128k)
 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(0) + "k";
  }
  return String(count);
}

/**
 * Create a detailed context grid visualization
 */
export function renderContextGrid(options: ContextWindowOptions & { rows?: number }): string {
  const { used, total, rows = 4, width = 50 } = options;
  const tc = getThemeChalk();
  const t = currentTheme;

  const cellsPerRow = width;
  const totalCells = cellsPerRow * rows;
  const filledCells = Math.round((used / total) * totalCells);

  const percentage = (used / total) * 100;

  // Determine colors for different fill levels
  const getColor = (cellIndex: number): string => {
    if (cellIndex >= filledCells) return t.contextFree;
    const cellPercentage = (cellIndex / totalCells) * 100;
    if (cellPercentage < 50) return t.contextUsed;
    if (cellPercentage < 75) return t.contextWarning;
    return t.contextCritical;
  };

  const lines: string[] = [];

  // Header
  lines.push(tc.primary("Context Window Usage"));
  lines.push(tc.muted("─".repeat(width + 4)));

  // Grid
  for (let row = 0; row < rows; row++) {
    let rowStr = "  ";
    for (let col = 0; col < cellsPerRow; col++) {
      const cellIndex = row * cellsPerRow + col;
      const color = getColor(cellIndex);
      rowStr += chalk.bgHex(color)(" ");
    }
    rowStr += "  ";
    lines.push(rowStr);
  }

  // Footer
  lines.push(tc.muted("─".repeat(width + 4)));
  lines.push(
    tc.dim(`  Used: ${formatTokenCount(used)} / ${formatTokenCount(total)}`) +
    tc.muted(` (${percentage.toFixed(1)}%)`)
  );

  // Legend
  lines.push("");
  lines.push(
    chalk.bgHex(t.contextUsed)("  ") + tc.dim(" < 50%  ") +
    chalk.bgHex(t.contextWarning)("  ") + tc.dim(" 50-75%  ") +
    chalk.bgHex(t.contextCritical)("  ") + tc.dim(" > 75%  ") +
    chalk.bgHex(t.contextFree)("  ") + tc.dim(" Free")
  );

  return lines.join("\n");
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

export interface ProgressBarOptions {
  total: number;
  width?: number;
  label?: string;
  showPercentage?: boolean;
  showETA?: boolean;
  style?: "bar" | "blocks" | "dots" | "coffee";
}

/**
 * Progress bar for long operations
 */
export class ProgressBar {
  private current: number = 0;
  private total: number;
  private width: number;
  private label: string;
  private showPercentage: boolean;
  private showETA: boolean;
  private style: "bar" | "blocks" | "dots" | "coffee";
  private startTime: number = Date.now();
  private lastRender: number = 0;
  private isComplete: boolean = false;

  constructor(options: ProgressBarOptions) {
    this.total = options.total;
    this.width = options.width ?? 30;
    this.label = options.label ?? "";
    this.showPercentage = options.showPercentage ?? true;
    this.showETA = options.showETA ?? true;
    this.style = options.style ?? "bar";
    this.startTime = Date.now();
  }

  /**
   * Update progress
   */
  update(current: number, label?: string): void {
    this.current = Math.min(current, this.total);
    if (label) this.label = label;
    this.render();
  }

  /**
   * Increment progress by amount
   */
  increment(amount: number = 1, label?: string): void {
    this.update(this.current + amount, label);
  }

  /**
   * Complete the progress bar
   */
  complete(label?: string): void {
    this.current = this.total;
    this.isComplete = true;
    if (label) this.label = label;
    this.render();
    process.stdout.write("\n");
  }

  /**
   * Fail the progress bar
   */
  fail(label?: string): void {
    this.isComplete = true;
    if (label) this.label = label;

    const tc = getThemeChalk();
    process.stdout.write("\r\x1b[K");
    process.stdout.write(tc.error(`✗ ${this.label}`));
    process.stdout.write("\n");
  }

  private render(): void {
    const now = Date.now();
    // Throttle renders to every 50ms
    if (!this.isComplete && now - this.lastRender < 50) return;
    this.lastRender = now;

    const tc = getThemeChalk();
    const t = currentTheme;
    const percentage = (this.current / this.total) * 100;
    const filled = Math.round((percentage / 100) * this.width);

    let bar: string;

    switch (this.style) {
      case "blocks":
        bar = "█".repeat(filled) + "░".repeat(this.width - filled);
        break;
      case "dots":
        bar = "●".repeat(filled) + "○".repeat(this.width - filled);
        break;
      case "coffee":
        // Coffee beans filling up
        bar = "☕".repeat(Math.floor(filled / 2)) +
              "🫘".repeat(Math.floor((this.width - filled) / 2));
        break;
      default:
        bar = chalk.bgHex(t.primary)(" ".repeat(filled)) +
              chalk.bgHex(t.contextFree)(" ".repeat(this.width - filled));
    }

    // Build the line
    let line = "\r\x1b[K";

    if (this.label) {
      line += tc.dim(this.label + " ");
    }

    line += bar;

    if (this.showPercentage) {
      line += tc.dim(` ${percentage.toFixed(0)}%`);
    }

    if (this.showETA && !this.isComplete && this.current > 0) {
      const elapsed = now - this.startTime;
      const rate = this.current / elapsed;
      const remaining = (this.total - this.current) / rate;

      if (remaining > 0 && remaining < Infinity) {
        const eta = formatDuration(remaining);
        line += tc.muted(` ETA: ${eta}`);
      }
    }

    if (this.isComplete) {
      line += tc.success(" ✓");
    }

    process.stdout.write(line);
  }
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Create and return a progress bar
 */
export function createProgressBar(options: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options);
}

// ============================================================================
// INTERACTIVE DIFF VIEWER
// ============================================================================

export interface DiffViewerOptions {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
  context?: number;
  sideBySide?: boolean;
}

/**
 * Interactive diff viewer with navigation
 */
export class DiffViewer {
  private hunks: Diff.Hunk[] = [];
  private currentHunk: number = 0;
  private scrollOffset: number = 0;
  private maxVisibleLines: number = 20;
  private isActive: boolean = false;
  private options: Required<DiffViewerOptions>;

  constructor(options: DiffViewerOptions) {
    this.options = {
      oldContent: options.oldContent,
      newContent: options.newContent,
      oldLabel: options.oldLabel ?? "original",
      newLabel: options.newLabel ?? "modified",
      context: options.context ?? 3,
      sideBySide: options.sideBySide ?? false,
    };

    const patch = Diff.structuredPatch(
      this.options.oldLabel,
      this.options.newLabel,
      this.options.oldContent,
      this.options.newContent,
      "original",
      "modified",
      { context: this.options.context }
    );

    this.hunks = patch.hunks;
  }

  /**
   * Display the diff interactively
   */
  async show(): Promise<void> {
    if (this.hunks.length === 0) {
      const tc = getThemeChalk();
      console.log(tc.success("No differences found."));
      return;
    }

    return new Promise((resolve) => {
      this.isActive = true;

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      this.render();

      const handleKeypress = (chunk: Buffer) => {
        if (!this.isActive) return;

        const key = chunk.toString();

        // q or Escape to quit
        if (key === "q" || key === "\x1b" || key === "\x03") {
          this.cleanup();
          resolve();
          return;
        }

        // Arrow keys and navigation
        if (chunk[0] === 0x1b && chunk.length > 1) {
          const seq = chunk.toString();

          if (seq === "\x1b[A" || key === "k") { // Up
            this.scroll(-1);
          } else if (seq === "\x1b[B" || key === "j") { // Down
            this.scroll(1);
          } else if (seq === "\x1b[5~") { // Page Up
            this.scroll(-this.maxVisibleLines);
          } else if (seq === "\x1b[6~") { // Page Down
            this.scroll(this.maxVisibleLines);
          }
        }

        // n/p for next/prev hunk
        if (key === "n") {
          this.nextHunk();
        } else if (key === "p") {
          this.prevHunk();
        }

        // Home/End
        if (key === "g") {
          this.scrollOffset = 0;
        } else if (key === "G") {
          this.scrollToEnd();
        }

        this.render();
      };

      process.stdin.on("data", handleKeypress);
    });
  }

  private scroll(delta: number): void {
    const totalLines = this.getTotalLines();
    this.scrollOffset = Math.max(0, Math.min(totalLines - this.maxVisibleLines, this.scrollOffset + delta));
  }

  private scrollToEnd(): void {
    const totalLines = this.getTotalLines();
    this.scrollOffset = Math.max(0, totalLines - this.maxVisibleLines);
  }

  private nextHunk(): void {
    if (this.currentHunk < this.hunks.length - 1) {
      this.currentHunk++;
      this.scrollToHunk(this.currentHunk);
    }
  }

  private prevHunk(): void {
    if (this.currentHunk > 0) {
      this.currentHunk--;
      this.scrollToHunk(this.currentHunk);
    }
  }

  private scrollToHunk(index: number): void {
    let lineCount = 0;
    for (let i = 0; i < index; i++) {
      lineCount += this.hunks[i].lines.length + 2; // +2 for header and spacing
    }
    this.scrollOffset = lineCount;
  }

  private getTotalLines(): number {
    let total = 0;
    for (const hunk of this.hunks) {
      total += hunk.lines.length + 2;
    }
    return total;
  }

  private render(): void {
    const tc = getThemeChalk();
    const t = currentTheme;

    // Clear screen
    process.stdout.write("\x1b[2J\x1b[H");

    // Header
    console.log(tc.primary.bold("Diff Viewer"));
    console.log(tc.muted(`${this.options.oldLabel} → ${this.options.newLabel}`));
    console.log(tc.muted("─".repeat(60)));

    // Render hunks
    const allLines: { text: string; type: "add" | "remove" | "context" | "header" }[] = [];

    for (let i = 0; i < this.hunks.length; i++) {
      const hunk = this.hunks[i];

      allLines.push({
        text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        type: "header",
      });

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          allLines.push({ text: line, type: "add" });
        } else if (line.startsWith("-")) {
          allLines.push({ text: line, type: "remove" });
        } else {
          allLines.push({ text: line, type: "context" });
        }
      }

      allLines.push({ text: "", type: "context" });
    }

    // Display visible portion
    const visibleLines = allLines.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleLines);

    for (const line of visibleLines) {
      switch (line.type) {
        case "header":
          console.log(chalk.hex(t.info)(line.text));
          break;
        case "add":
          console.log(chalk.bgHex(t.diffAdd).hex("#000000")(line.text.padEnd(60)));
          break;
        case "remove":
          console.log(chalk.bgHex(t.diffRemove).hex("#FFFFFF")(line.text.padEnd(60)));
          break;
        default:
          console.log(tc.dim(line.text));
      }
    }

    // Footer
    console.log(tc.muted("─".repeat(60)));
    console.log(
      tc.dim("Navigation: ") +
      tc.muted("↑/↓ or j/k scroll, n/p next/prev hunk, g/G start/end, q quit")
    );
    console.log(
      tc.dim(`Hunk ${this.currentHunk + 1}/${this.hunks.length} | `) +
      tc.dim(`Line ${this.scrollOffset + 1}/${this.getTotalLines()}`)
    );
  }

  private cleanup(): void {
    this.isActive = false;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    // Clear the diff view
    process.stdout.write("\x1b[2J\x1b[H");
  }

  /**
   * Get static diff output (non-interactive)
   */
  getStaticOutput(): string {
    const tc = getThemeChalk();
    const t = currentTheme;
    const lines: string[] = [];

    lines.push(tc.primary.bold("Diff: ") + tc.muted(`${this.options.oldLabel} → ${this.options.newLabel}`));
    lines.push(tc.muted("─".repeat(60)));

    for (const hunk of this.hunks) {
      lines.push(chalk.hex(t.info)(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`));

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          lines.push(chalk.hex(t.diffAdd)(line));
        } else if (line.startsWith("-")) {
          lines.push(chalk.hex(t.diffRemove)(line));
        } else {
          lines.push(tc.dim(line));
        }
      }

      lines.push("");
    }

    lines.push(tc.muted("─".repeat(60)));

    return lines.join("\n");
  }
}

/**
 * Create and optionally show a diff viewer
 */
export function createDiffViewer(options: DiffViewerOptions): DiffViewer {
  return new DiffViewer(options);
}

/**
 * Show diff interactively
 */
export async function showDiff(options: DiffViewerOptions): Promise<void> {
  const viewer = new DiffViewer(options);
  await viewer.show();
}

/**
 * Get static diff output
 */
export function formatDiffOutput(options: DiffViewerOptions): string {
  const viewer = new DiffViewer(options);
  return viewer.getStaticOutput();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear the terminal screen
 */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Print a styled banner
 */
export function printBanner(text: string, style: "box" | "line" | "simple" = "box"): void {
  const tc = getThemeChalk();
  const t = currentTheme;
  const width = Math.max(text.length + 4, 40);

  switch (style) {
    case "box":
      console.log(tc.primary("╔" + "═".repeat(width - 2) + "╗"));
      console.log(tc.primary("║") + " ".repeat(Math.floor((width - 2 - text.length) / 2)) +
                  tc.text.bold(text) +
                  " ".repeat(Math.ceil((width - 2 - text.length) / 2)) + tc.primary("║"));
      console.log(tc.primary("╚" + "═".repeat(width - 2) + "╝"));
      break;
    case "line":
      console.log(tc.primary("─".repeat(width)));
      console.log(tc.text.bold(text));
      console.log(tc.primary("─".repeat(width)));
      break;
    case "simple":
      console.log(tc.primary.bold(text));
      break;
  }
}

/**
 * Print a styled divider
 */
export function printDivider(style: "single" | "double" | "dotted" = "single", width: number = 60): void {
  const tc = getThemeChalk();

  switch (style) {
    case "double":
      console.log(tc.muted("═".repeat(width)));
      break;
    case "dotted":
      console.log(tc.muted("·".repeat(width)));
      break;
    default:
      console.log(tc.muted("─".repeat(width)));
  }
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string, keyWidth: number = 20): void {
  const tc = getThemeChalk();
  const paddedKey = key.padEnd(keyWidth);
  console.log(tc.dim(paddedKey) + tc.text(value));
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  const tc = getThemeChalk();
  console.log(tc.success("✓ ") + tc.text(message));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  const tc = getThemeChalk();
  console.log(tc.error("✗ ") + tc.text(message));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  const tc = getThemeChalk();
  console.log(tc.warning("⚠ ") + tc.text(message));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  const tc = getThemeChalk();
  console.log(tc.info("ℹ ") + tc.text(message));
}

/**
 * Coffee-themed ASCII art for Kaldi
 */
export function printKaldiArt(): void {
  const tc = getThemeChalk();

  const art = `
    ${tc.primary("    ∩_∩")}
    ${tc.primary("   (• ᴥ •)")}  ${tc.accent.bold("Kaldi")}
    ${tc.primary("   /|    |\\") + tc.dim("  Your loyal coding companion")}
    ${tc.primary("  (_|    |_)")}
  `;

  console.log(art);
}

/**
 * Print a coffee cup decoration
 */
export function printCoffeeCup(): void {
  const tc = getThemeChalk();

  console.log(tc.muted("     ) )"));
  console.log(tc.muted("    ( ("));
  console.log(tc.primary("   .-'-."));
  console.log(tc.primary("  |     |") + tc.accent("]"));
  console.log(tc.primary("  `-----'"));
}
