/**
 * Multi-line Input Support
 *
 * Allows entering multi-line messages with Shift+Enter.
 * Provides a simple multi-line editor experience.
 */

import chalk from "chalk";
import * as readline from "readline";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

export interface MultilineConfig {
  /** Key combo to insert newline (default: shift+enter) */
  newlineKey?: { shift?: boolean; ctrl?: boolean; name: string };
  /** Key to submit (default: enter) */
  submitKey?: string;
  /** Maximum lines allowed */
  maxLines?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Prompt for each line */
  prompt?: string;
  /** Continuation prompt for lines after first */
  continuationPrompt?: string;
}

export interface MultilineState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  isActive: boolean;
}

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  prompt: chalk.hex("#C9A66B"),
  lineNumber: chalk.hex("#6B5B4F"),
  cursor: chalk.inverse,
  dim: chalk.hex("#888888"),
  text: chalk.hex("#E8DCC8"),
};

// ============================================================================
// MULTILINE INPUT
// ============================================================================

export class MultilineInput extends EventEmitter {
  private config: Required<MultilineConfig>;
  private state: MultilineState;
  private rl: readline.Interface | null = null;

  constructor(config: MultilineConfig = {}) {
    super();
    this.config = {
      newlineKey: config.newlineKey ?? { shift: true, name: "return" },
      submitKey: config.submitKey ?? "return",
      maxLines: config.maxLines ?? 50,
      showLineNumbers: config.showLineNumbers ?? false,
      prompt: config.prompt ?? "❯ ",
      continuationPrompt: config.continuationPrompt ?? "· ",
    };

    this.state = {
      lines: [""],
      cursorLine: 0,
      cursorCol: 0,
      isActive: false,
    };
  }

  /**
   * Start multiline input mode
   */
  start(initialValue: string = ""): void {
    this.state = {
      lines: initialValue ? initialValue.split("\n") : [""],
      cursorLine: 0,
      cursorCol: initialValue.length,
      isActive: true,
    };

    this.emit("start", this.state);
    this.render();
  }

  /**
   * Handle a keypress event
   */
  handleKey(key: readline.Key): boolean {
    if (!this.state.isActive) return false;

    // Check for newline key (Shift+Enter)
    if (this.isNewlineKey(key)) {
      this.insertNewline();
      return true;
    }

    // Check for submit key (Enter without Shift)
    if (this.isSubmitKey(key)) {
      this.submit();
      return true;
    }

    // Handle other keys
    if (key.name === "backspace") {
      this.handleBackspace();
      return true;
    }

    if (key.name === "delete") {
      this.handleDelete();
      return true;
    }

    if (key.name === "up") {
      this.moveCursorUp();
      return true;
    }

    if (key.name === "down") {
      this.moveCursorDown();
      return true;
    }

    if (key.name === "left") {
      this.moveCursorLeft();
      return true;
    }

    if (key.name === "right") {
      this.moveCursorRight();
      return true;
    }

    if (key.name === "home" || (key.ctrl && key.name === "a")) {
      this.moveCursorToLineStart();
      return true;
    }

    if (key.name === "end" || (key.ctrl && key.name === "e")) {
      this.moveCursorToLineEnd();
      return true;
    }

    // Escape to cancel multiline mode
    if (key.name === "escape") {
      this.cancel();
      return true;
    }

    // Ctrl+C to cancel
    if (key.ctrl && key.name === "c") {
      this.cancel();
      return true;
    }

    return false;
  }

  /**
   * Insert a character at cursor position
   */
  insertChar(char: string): void {
    if (!this.state.isActive) return;

    const line = this.state.lines[this.state.cursorLine];
    this.state.lines[this.state.cursorLine] =
      line.slice(0, this.state.cursorCol) + char + line.slice(this.state.cursorCol);
    this.state.cursorCol += char.length;

    this.emit("change", this.getValue());
    this.render();
  }

  /**
   * Insert a newline at cursor position
   */
  private insertNewline(): void {
    if (this.state.lines.length >= this.config.maxLines) {
      return; // Max lines reached
    }

    const line = this.state.lines[this.state.cursorLine];
    const before = line.slice(0, this.state.cursorCol);
    const after = line.slice(this.state.cursorCol);

    this.state.lines[this.state.cursorLine] = before;
    this.state.lines.splice(this.state.cursorLine + 1, 0, after);
    this.state.cursorLine++;
    this.state.cursorCol = 0;

    this.emit("change", this.getValue());
    this.render();
  }

  /**
   * Handle backspace
   */
  private handleBackspace(): void {
    if (this.state.cursorCol > 0) {
      // Delete character before cursor
      const line = this.state.lines[this.state.cursorLine];
      this.state.lines[this.state.cursorLine] =
        line.slice(0, this.state.cursorCol - 1) + line.slice(this.state.cursorCol);
      this.state.cursorCol--;
    } else if (this.state.cursorLine > 0) {
      // Merge with previous line
      const currentLine = this.state.lines[this.state.cursorLine];
      const prevLine = this.state.lines[this.state.cursorLine - 1];
      this.state.lines[this.state.cursorLine - 1] = prevLine + currentLine;
      this.state.lines.splice(this.state.cursorLine, 1);
      this.state.cursorLine--;
      this.state.cursorCol = prevLine.length;
    }

    this.emit("change", this.getValue());
    this.render();
  }

  /**
   * Handle delete key
   */
  private handleDelete(): void {
    const line = this.state.lines[this.state.cursorLine];

    if (this.state.cursorCol < line.length) {
      // Delete character at cursor
      this.state.lines[this.state.cursorLine] =
        line.slice(0, this.state.cursorCol) + line.slice(this.state.cursorCol + 1);
    } else if (this.state.cursorLine < this.state.lines.length - 1) {
      // Merge with next line
      const nextLine = this.state.lines[this.state.cursorLine + 1];
      this.state.lines[this.state.cursorLine] = line + nextLine;
      this.state.lines.splice(this.state.cursorLine + 1, 1);
    }

    this.emit("change", this.getValue());
    this.render();
  }

  /**
   * Move cursor up
   */
  private moveCursorUp(): void {
    if (this.state.cursorLine > 0) {
      this.state.cursorLine--;
      this.state.cursorCol = Math.min(
        this.state.cursorCol,
        this.state.lines[this.state.cursorLine].length
      );
      this.render();
    }
  }

  /**
   * Move cursor down
   */
  private moveCursorDown(): void {
    if (this.state.cursorLine < this.state.lines.length - 1) {
      this.state.cursorLine++;
      this.state.cursorCol = Math.min(
        this.state.cursorCol,
        this.state.lines[this.state.cursorLine].length
      );
      this.render();
    }
  }

  /**
   * Move cursor left
   */
  private moveCursorLeft(): void {
    if (this.state.cursorCol > 0) {
      this.state.cursorCol--;
    } else if (this.state.cursorLine > 0) {
      this.state.cursorLine--;
      this.state.cursorCol = this.state.lines[this.state.cursorLine].length;
    }
    this.render();
  }

  /**
   * Move cursor right
   */
  private moveCursorRight(): void {
    const lineLength = this.state.lines[this.state.cursorLine].length;

    if (this.state.cursorCol < lineLength) {
      this.state.cursorCol++;
    } else if (this.state.cursorLine < this.state.lines.length - 1) {
      this.state.cursorLine++;
      this.state.cursorCol = 0;
    }
    this.render();
  }

  /**
   * Move cursor to line start
   */
  private moveCursorToLineStart(): void {
    this.state.cursorCol = 0;
    this.render();
  }

  /**
   * Move cursor to line end
   */
  private moveCursorToLineEnd(): void {
    this.state.cursorCol = this.state.lines[this.state.cursorLine].length;
    this.render();
  }

  /**
   * Submit the input
   */
  private submit(): void {
    const value = this.getValue();
    this.state.isActive = false;
    this.emit("submit", value);
  }

  /**
   * Cancel multiline input
   */
  private cancel(): void {
    this.state.isActive = false;
    this.emit("cancel");
  }

  /**
   * Get the current value
   */
  getValue(): string {
    return this.state.lines.join("\n");
  }

  /**
   * Set the value
   */
  setValue(value: string): void {
    this.state.lines = value.split("\n");
    this.state.cursorLine = this.state.lines.length - 1;
    this.state.cursorCol = this.state.lines[this.state.cursorLine].length;
    this.render();
  }

  /**
   * Check if we're in multiline mode (more than one line)
   */
  isMultiline(): boolean {
    return this.state.lines.length > 1;
  }

  /**
   * Check if input is active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Get current state
   */
  getState(): MultilineState {
    return { ...this.state };
  }

  /**
   * Render the input
   */
  private render(): void {
    // Clear previous lines
    const linesToClear = this.state.lines.length + 1;
    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write("\x1b[2K"); // Clear line
      if (i < linesToClear - 1) {
        process.stdout.write("\x1b[1A"); // Move up
      }
    }
    process.stdout.write("\r"); // Move to start

    // Render each line
    for (let i = 0; i < this.state.lines.length; i++) {
      const isFirstLine = i === 0;
      const prompt = isFirstLine ? this.config.prompt : this.config.continuationPrompt;
      const lineNum = this.config.showLineNumbers
        ? colors.lineNumber((i + 1).toString().padStart(2) + " ")
        : "";

      let line = this.state.lines[i];

      // Highlight cursor position on current line
      if (i === this.state.cursorLine) {
        const before = line.slice(0, this.state.cursorCol);
        const cursor = line[this.state.cursorCol] || " ";
        const after = line.slice(this.state.cursorCol + 1);
        line = colors.text(before) + colors.cursor(cursor) + colors.text(after);
      } else {
        line = colors.text(line);
      }

      process.stdout.write(`${lineNum}${colors.prompt(prompt)}${line}`);

      if (i < this.state.lines.length - 1) {
        process.stdout.write("\n");
      }
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private isNewlineKey(key: readline.Key): boolean {
    const config = this.config.newlineKey;
    if (config.shift && !key.shift) return false;
    if (config.ctrl && !key.ctrl) return false;
    return key.name === config.name;
  }

  private isSubmitKey(key: readline.Key): boolean {
    // Submit if Enter without Shift
    return key.name === this.config.submitKey && !key.shift;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let multilineInstance: MultilineInput | null = null;

export function getMultilineInput(config?: MultilineConfig): MultilineInput {
  if (!multilineInstance) {
    multilineInstance = new MultilineInput(config);
  }
  return multilineInstance;
}

export function resetMultilineInput(): void {
  multilineInstance = null;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format multiline mode hint
 */
export function formatMultilineHint(): string {
  return colors.dim("shift+enter for new line · enter to submit");
}

/**
 * Check if a string contains multiple lines
 */
export function isMultilineString(str: string): boolean {
  return str.includes("\n");
}

/**
 * Format a multiline string for display
 */
export function formatMultilineDisplay(str: string, indent: string = "  "): string {
  return str.split("\n").map((line, i) => {
    const lineNum = colors.lineNumber((i + 1).toString().padStart(2));
    return `${indent}${lineNum} ${colors.text(line)}`;
  }).join("\n");
}
