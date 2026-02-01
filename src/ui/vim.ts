/**
 * Vim Mode for Kaldi CLI
 *
 * Provides Vim-style editing capabilities:
 * - Normal mode (Esc to enter)
 * - Insert mode (i, I, a, A, o, O)
 * - Visual mode (v, V)
 * - Navigation: hjkl, w, b, e, 0, $, gg, G
 * - Editing: x, dd, yy, p, P, u
 * - Text objects: iw, aw, i", a", i(, a(
 * - Command mode: :w, :q, :wq
 * - Repeat with .
 */

import * as readline from "readline";
import chalk from "chalk";
import { KeyEvent, parseRawKeypress } from "./keyboard.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vim editing modes
 */
export type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

/**
 * Direction for movement commands
 */
export type Direction = "left" | "right" | "up" | "down";

/**
 * Text object types
 */
export type TextObjectType = "word" | "WORD" | "quote" | "double-quote" | "paren" | "bracket" | "brace";

/**
 * Text object scope
 */
export type TextObjectScope = "inner" | "around";

/**
 * Vim register contents
 */
export interface Register {
  text: string;
  type: "char" | "line" | "block";
}

/**
 * Undo state
 */
export interface UndoState {
  content: string;
  cursor: number;
}

/**
 * Vim command result
 */
export interface CommandResult {
  quit?: boolean;
  save?: boolean;
  error?: string;
  message?: string;
}

/**
 * Vim buffer state
 */
export interface VimBuffer {
  content: string;
  cursor: number;
  mode: VimMode;
  visualStart?: number;
  commandBuffer: string;
  lastCommand: string;
  registers: Map<string, Register>;
  undoStack: UndoState[];
  redoStack: UndoState[];
}

/**
 * Events emitted by VimEditor
 */
export interface VimEvents {
  onModeChange?: (mode: VimMode) => void;
  onContentChange?: (content: string) => void;
  onCommand?: (result: CommandResult) => void;
  onStatusUpdate?: (status: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_UNDO_HISTORY = 100;

const c = {
  dim: chalk.gray,
  mode: chalk.hex("#D4A574").bold,
  command: chalk.hex("#8B6914"),
  error: chalk.red,
  success: chalk.green,
  cursor: chalk.bgHex("#2D4F67"),
  visual: chalk.bgHex("#3D4F57"),
};

// ============================================================================
// VIM EDITOR
// ============================================================================

/**
 * Vim-style editor for single-line and multi-line input
 */
export class VimEditor {
  private buffer: VimBuffer;
  private events: VimEvents;
  private pendingOperator: string = "";
  private pendingCount: number = 0;
  private countBuffer: string = "";

  constructor(initialContent: string = "", events: VimEvents = {}) {
    this.buffer = {
      content: initialContent,
      cursor: 0,
      mode: "insert", // Start in insert mode for CLI friendliness
      commandBuffer: "",
      lastCommand: "",
      registers: new Map([["", { text: "", type: "char" }]]),
      undoStack: [],
      redoStack: [],
    };
    this.events = events;

    // Save initial state for undo
    this.saveUndoState();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Get current mode
   */
  getMode(): VimMode {
    return this.buffer.mode;
  }

  /**
   * Get current content
   */
  getContent(): string {
    return this.buffer.content;
  }

  /**
   * Get cursor position
   */
  getCursor(): number {
    return this.buffer.cursor;
  }

  /**
   * Set content
   */
  setContent(content: string): void {
    this.buffer.content = content;
    this.buffer.cursor = Math.min(this.buffer.cursor, content.length);
    this.events.onContentChange?.(content);
  }

  /**
   * Set cursor position
   */
  setCursor(pos: number): void {
    this.buffer.cursor = Math.max(0, Math.min(pos, this.buffer.content.length));
  }

  /**
   * Switch to a mode
   */
  setMode(mode: VimMode): void {
    const prevMode = this.buffer.mode;
    this.buffer.mode = mode;

    if (mode === "normal" && prevMode !== "normal") {
      // Adjust cursor when leaving insert mode
      if (this.buffer.cursor > 0 && this.buffer.cursor >= this.buffer.content.length) {
        this.buffer.cursor = Math.max(0, this.buffer.content.length - 1);
      }
    }

    if (mode === "visual" || mode === "visual-line") {
      this.buffer.visualStart = this.buffer.cursor;
    } else {
      this.buffer.visualStart = undefined;
    }

    if (mode === "command") {
      this.buffer.commandBuffer = ":";
    }

    this.events.onModeChange?.(mode);
    this.updateStatus();
  }

  /**
   * Process a key event
   * Returns true if the key was handled
   */
  processKey(event: KeyEvent): boolean {
    const key = event.name || event.sequence;

    switch (this.buffer.mode) {
      case "normal":
        return this.handleNormalMode(key, event);
      case "insert":
        return this.handleInsertMode(key, event);
      case "visual":
      case "visual-line":
        return this.handleVisualMode(key, event);
      case "command":
        return this.handleCommandMode(key, event);
      default:
        return false;
    }
  }

  /**
   * Process raw keypress
   */
  processRawKey(chunk: Buffer, key?: readline.Key): boolean {
    const event = parseRawKeypress(chunk, key);
    return this.processKey(event);
  }

  /**
   * Get rendered content with cursor indicator
   */
  render(): string {
    const { content, cursor, mode, visualStart } = this.buffer;

    if (content.length === 0) {
      return c.cursor(" ");
    }

    let result = "";

    if (mode === "visual" || mode === "visual-line") {
      const start = Math.min(cursor, visualStart ?? cursor);
      const end = Math.max(cursor, visualStart ?? cursor);

      if (mode === "visual-line") {
        // Highlight entire lines
        const lines = content.split("\n");
        let charIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          const lineStart = charIndex;
          const lineEnd = charIndex + lines[i].length;

          if (lineStart <= end && lineEnd >= start) {
            result += c.visual(lines[i]);
          } else {
            result += lines[i];
          }

          if (i < lines.length - 1) {
            result += "\n";
            charIndex = lineEnd + 1;
          } else {
            charIndex = lineEnd;
          }
        }
      } else {
        // Character-wise visual
        for (let i = 0; i < content.length; i++) {
          if (i >= start && i <= end) {
            result += c.visual(content[i]);
          } else if (i === cursor) {
            result += c.cursor(content[i]);
          } else {
            result += content[i];
          }
        }
      }
    } else {
      // Normal or insert mode
      for (let i = 0; i < content.length; i++) {
        if (i === cursor) {
          result += c.cursor(content[i]);
        } else {
          result += content[i];
        }
      }

      // Show cursor at end if at end of content
      if (cursor >= content.length) {
        result += c.cursor(" ");
      }
    }

    return result;
  }

  /**
   * Get status line
   */
  getStatus(): string {
    const { mode, commandBuffer } = this.buffer;

    if (mode === "command") {
      return c.command(commandBuffer);
    }

    const modeStr = mode.toUpperCase();
    const pos = `${this.buffer.cursor}/${this.buffer.content.length}`;

    let pending = "";
    if (this.countBuffer) {
      pending = this.countBuffer;
    }
    if (this.pendingOperator) {
      pending += this.pendingOperator;
    }

    return c.mode(`-- ${modeStr} --`) + c.dim(` ${pos}`) + (pending ? c.command(` ${pending}`) : "");
  }

  // ==========================================================================
  // MODE HANDLERS
  // ==========================================================================

  private handleNormalMode(key: string, event: KeyEvent): boolean {
    // Handle count prefix
    if (/^[1-9]$/.test(key) || (this.countBuffer && /^[0-9]$/.test(key))) {
      this.countBuffer += key;
      this.updateStatus();
      return true;
    }

    const count = this.countBuffer ? parseInt(this.countBuffer, 10) : 1;

    // Check for pending operator
    if (this.pendingOperator) {
      return this.handleOperatorPending(key, event, count);
    }

    // Mode switching
    switch (key) {
      case "i":
        this.setMode("insert");
        this.clearPending();
        return true;

      case "I":
        this.moveTo(this.getLineStart());
        this.setMode("insert");
        this.clearPending();
        return true;

      case "a":
        if (this.buffer.content.length > 0) {
          this.buffer.cursor = Math.min(this.buffer.cursor + 1, this.buffer.content.length);
        }
        this.setMode("insert");
        this.clearPending();
        return true;

      case "A":
        this.moveTo(this.getLineEnd());
        this.buffer.cursor++;
        this.setMode("insert");
        this.clearPending();
        return true;

      case "o":
        this.moveTo(this.getLineEnd());
        this.insertText("\n");
        this.setMode("insert");
        this.clearPending();
        return true;

      case "O":
        this.moveTo(this.getLineStart());
        this.insertText("\n");
        this.buffer.cursor--;
        this.moveTo(this.getLineStart());
        this.setMode("insert");
        this.clearPending();
        return true;

      case "v":
        this.setMode("visual");
        this.clearPending();
        return true;

      case "V":
        this.setMode("visual-line");
        this.clearPending();
        return true;

      case ":":
        this.setMode("command");
        this.clearPending();
        return true;
    }

    // Navigation
    if (this.handleNavigation(key, count)) {
      this.clearPending();
      return true;
    }

    // Operators
    switch (key) {
      case "d":
      case "c":
      case "y":
        this.pendingOperator = key;
        this.updateStatus();
        return true;
    }

    // Immediate commands
    switch (key) {
      case "x":
        for (let i = 0; i < count; i++) {
          this.deleteChar();
        }
        this.saveCommand("x");
        this.clearPending();
        return true;

      case "X":
        for (let i = 0; i < count; i++) {
          if (this.buffer.cursor > 0) {
            this.buffer.cursor--;
            this.deleteChar();
          }
        }
        this.saveCommand("X");
        this.clearPending();
        return true;

      case "p":
        for (let i = 0; i < count; i++) {
          this.paste(false);
        }
        this.saveCommand("p");
        this.clearPending();
        return true;

      case "P":
        for (let i = 0; i < count; i++) {
          this.paste(true);
        }
        this.saveCommand("P");
        this.clearPending();
        return true;

      case "u":
        this.undo();
        this.clearPending();
        return true;

      case "r":
        if (event.ctrl) {
          this.redo();
          this.clearPending();
          return true;
        }
        break;

      case ".":
        this.repeatLastCommand();
        this.clearPending();
        return true;
    }

    // Line operations (doubled operator)
    if (key === "d" && this.pendingOperator === "d") {
      this.deleteLine(count);
      this.saveCommand("dd");
      this.clearPending();
      return true;
    }

    if (key === "y" && this.pendingOperator === "y") {
      this.yankLine(count);
      this.saveCommand("yy");
      this.clearPending();
      return true;
    }

    if (key === "c" && this.pendingOperator === "c") {
      this.deleteLine(count);
      this.setMode("insert");
      this.saveCommand("cc");
      this.clearPending();
      return true;
    }

    // gg
    if (key === "g" && !this.pendingOperator) {
      this.pendingOperator = "g";
      this.updateStatus();
      return true;
    }

    if (key === "g" && this.pendingOperator === "g") {
      this.moveTo(0);
      this.clearPending();
      return true;
    }

    // G
    if (key === "G") {
      this.moveTo(this.buffer.content.length - 1);
      this.clearPending();
      return true;
    }

    this.clearPending();
    return false;
  }

  private handleOperatorPending(key: string, _event: KeyEvent, count: number): boolean {
    const operator = this.pendingOperator;

    // Text objects
    const textObjectMatch = key.match(/^([ia])([wW"'()\[\]{}])$/);
    if (textObjectMatch || (key === "i" || key === "a")) {
      // Need another key for text object
      if (key === "i" || key === "a") {
        this.pendingOperator = operator + key;
        this.updateStatus();
        return true;
      }
    }

    // Check for text object completion
    if (operator.length === 2 && (operator[1] === "i" || operator[1] === "a")) {
      const scope: TextObjectScope = operator[1] === "i" ? "inner" : "around";
      const range = this.getTextObjectRange(key, scope);

      if (range) {
        this.applyOperator(operator[0], range.start, range.end, count);
        this.saveCommand(operator + key);
        this.clearPending();
        return true;
      }
    }

    // Motion as operator target
    const startPos = this.buffer.cursor;
    if (this.handleNavigation(key, count)) {
      const endPos = this.buffer.cursor;
      this.buffer.cursor = startPos;

      const start = Math.min(startPos, endPos);
      const end = Math.max(startPos, endPos);

      this.applyOperator(operator, start, end + 1, 1);
      this.saveCommand(operator + key);
      this.clearPending();
      return true;
    }

    this.clearPending();
    return false;
  }

  private handleInsertMode(key: string, event: KeyEvent): boolean {
    // Escape to normal mode
    if (key === "escape" || (event.ctrl && key === "c") || (event.ctrl && key === "[")) {
      this.setMode("normal");
      return true;
    }

    // Backspace
    if (key === "backspace") {
      if (this.buffer.cursor > 0) {
        this.buffer.cursor--;
        this.deleteChar();
      }
      return true;
    }

    // Delete
    if (key === "delete") {
      this.deleteChar();
      return true;
    }

    // Enter
    if (key === "return") {
      this.insertText("\n");
      return true;
    }

    // Tab
    if (key === "tab") {
      this.insertText("  ");
      return true;
    }

    // Arrow keys
    if (key === "left") {
      this.moveLeft(1);
      return true;
    }
    if (key === "right") {
      this.moveRight(1);
      return true;
    }
    if (key === "up") {
      this.moveUp(1);
      return true;
    }
    if (key === "down") {
      this.moveDown(1);
      return true;
    }

    // Ctrl shortcuts in insert mode
    if (event.ctrl) {
      switch (key) {
        case "w":
          this.deleteWordBackward();
          return true;
        case "u":
          this.deleteToLineStart();
          return true;
        case "h":
          if (this.buffer.cursor > 0) {
            this.buffer.cursor--;
            this.deleteChar();
          }
          return true;
      }
    }

    // Regular character
    if (key.length === 1 && !event.ctrl && !event.meta) {
      this.insertText(key);
      return true;
    }

    return false;
  }

  private handleVisualMode(key: string, event: KeyEvent): boolean {
    // Escape to normal mode
    if (key === "escape" || (event.ctrl && key === "c")) {
      this.setMode("normal");
      return true;
    }

    // Navigation extends selection
    if (this.handleNavigation(key, 1)) {
      return true;
    }

    // Mode switching
    if (key === "v") {
      if (this.buffer.mode === "visual") {
        this.setMode("normal");
      } else {
        this.setMode("visual");
      }
      return true;
    }

    if (key === "V") {
      if (this.buffer.mode === "visual-line") {
        this.setMode("normal");
      } else {
        this.setMode("visual-line");
      }
      return true;
    }

    // Operations on selection
    const start = Math.min(this.buffer.cursor, this.buffer.visualStart ?? this.buffer.cursor);
    const end = Math.max(this.buffer.cursor, this.buffer.visualStart ?? this.buffer.cursor) + 1;

    switch (key) {
      case "d":
      case "x":
        this.yank(start, end);
        this.delete(start, end);
        this.setMode("normal");
        return true;

      case "y":
        this.yank(start, end);
        this.buffer.cursor = start;
        this.setMode("normal");
        return true;

      case "c":
        this.yank(start, end);
        this.delete(start, end);
        this.setMode("insert");
        return true;
    }

    return false;
  }

  private handleCommandMode(key: string, event: KeyEvent): boolean {
    // Escape to cancel
    if (key === "escape" || (event.ctrl && key === "c")) {
      this.buffer.commandBuffer = "";
      this.setMode("normal");
      return true;
    }

    // Enter to execute
    if (key === "return") {
      const result = this.executeCommand(this.buffer.commandBuffer);
      this.events.onCommand?.(result);
      this.buffer.commandBuffer = "";
      this.setMode("normal");
      return true;
    }

    // Backspace
    if (key === "backspace") {
      if (this.buffer.commandBuffer.length > 1) {
        this.buffer.commandBuffer = this.buffer.commandBuffer.slice(0, -1);
        this.updateStatus();
      } else {
        this.buffer.commandBuffer = "";
        this.setMode("normal");
      }
      return true;
    }

    // Add character to command
    if (key.length === 1 && !event.ctrl && !event.meta) {
      this.buffer.commandBuffer += key;
      this.updateStatus();
      return true;
    }

    return false;
  }

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  private handleNavigation(key: string, count: number): boolean {
    switch (key) {
      case "h":
      case "left":
        this.moveLeft(count);
        return true;

      case "l":
      case "right":
        this.moveRight(count);
        return true;

      case "j":
      case "down":
        this.moveDown(count);
        return true;

      case "k":
      case "up":
        this.moveUp(count);
        return true;

      case "w":
        for (let i = 0; i < count; i++) {
          this.moveWordForward();
        }
        return true;

      case "b":
        for (let i = 0; i < count; i++) {
          this.moveWordBackward();
        }
        return true;

      case "e":
        for (let i = 0; i < count; i++) {
          this.moveWordEnd();
        }
        return true;

      case "0":
      case "home":
        this.moveTo(this.getLineStart());
        return true;

      case "$":
      case "end":
        this.moveTo(this.getLineEnd());
        return true;

      case "^":
        this.moveTo(this.getFirstNonBlank());
        return true;
    }

    return false;
  }

  private moveLeft(count: number): void {
    this.buffer.cursor = Math.max(0, this.buffer.cursor - count);
  }

  private moveRight(count: number): void {
    const max = this.buffer.mode === "insert"
      ? this.buffer.content.length
      : Math.max(0, this.buffer.content.length - 1);
    this.buffer.cursor = Math.min(max, this.buffer.cursor + count);
  }

  private moveUp(count: number): void {
    const lines = this.buffer.content.split("\n");
    const { line, col } = this.getCursorLineCol();

    if (line >= count) {
      const targetLine = line - count;
      const targetCol = Math.min(col, lines[targetLine].length - 1);
      this.moveTo(this.getPositionFromLineCol(targetLine, Math.max(0, targetCol)));
    }
  }

  private moveDown(count: number): void {
    const lines = this.buffer.content.split("\n");
    const { line, col } = this.getCursorLineCol();

    if (line + count < lines.length) {
      const targetLine = line + count;
      const targetCol = Math.min(col, lines[targetLine].length - 1);
      this.moveTo(this.getPositionFromLineCol(targetLine, Math.max(0, targetCol)));
    }
  }

  private moveWordForward(): void {
    const content = this.buffer.content;
    let pos = this.buffer.cursor;

    // Skip current word
    while (pos < content.length && /\w/.test(content[pos])) {
      pos++;
    }

    // Skip whitespace
    while (pos < content.length && /\s/.test(content[pos])) {
      pos++;
    }

    this.buffer.cursor = Math.min(pos, content.length - 1);
  }

  private moveWordBackward(): void {
    const content = this.buffer.content;
    let pos = this.buffer.cursor - 1;

    // Skip whitespace
    while (pos > 0 && /\s/.test(content[pos])) {
      pos--;
    }

    // Skip word
    while (pos > 0 && /\w/.test(content[pos - 1])) {
      pos--;
    }

    this.buffer.cursor = Math.max(0, pos);
  }

  private moveWordEnd(): void {
    const content = this.buffer.content;
    let pos = this.buffer.cursor + 1;

    // Skip whitespace
    while (pos < content.length && /\s/.test(content[pos])) {
      pos++;
    }

    // Move to end of word
    while (pos < content.length - 1 && /\w/.test(content[pos + 1])) {
      pos++;
    }

    this.buffer.cursor = Math.min(pos, content.length - 1);
  }

  private moveTo(pos: number): void {
    this.buffer.cursor = Math.max(0, Math.min(pos, this.buffer.content.length - 1));
  }

  // ==========================================================================
  // LINE HELPERS
  // ==========================================================================

  private getCursorLineCol(): { line: number; col: number } {
    const content = this.buffer.content.slice(0, this.buffer.cursor);
    const lines = content.split("\n");
    return {
      line: lines.length - 1,
      col: lines[lines.length - 1].length,
    };
  }

  private getPositionFromLineCol(line: number, col: number): number {
    const lines = this.buffer.content.split("\n");
    let pos = 0;

    for (let i = 0; i < line && i < lines.length; i++) {
      pos += lines[i].length + 1; // +1 for newline
    }

    return pos + Math.min(col, (lines[line] || "").length);
  }

  private getLineStart(): number {
    const content = this.buffer.content;
    let pos = this.buffer.cursor;

    while (pos > 0 && content[pos - 1] !== "\n") {
      pos--;
    }

    return pos;
  }

  private getLineEnd(): number {
    const content = this.buffer.content;
    let pos = this.buffer.cursor;

    while (pos < content.length && content[pos] !== "\n") {
      pos++;
    }

    return pos - 1;
  }

  private getFirstNonBlank(): number {
    const start = this.getLineStart();
    const content = this.buffer.content;
    let pos = start;

    while (pos < content.length && content[pos] !== "\n" && /\s/.test(content[pos])) {
      pos++;
    }

    return pos;
  }

  // ==========================================================================
  // TEXT OBJECTS
  // ==========================================================================

  private getTextObjectRange(type: string, scope: TextObjectScope): { start: number; end: number } | null {
    switch (type) {
      case "w":
        return this.getWordObject(scope, false);
      case "W":
        return this.getWordObject(scope, true);
      case '"':
        return this.getQuoteObject('"', scope);
      case "'":
        return this.getQuoteObject("'", scope);
      case "(":
      case ")":
        return this.getPairObject("(", ")", scope);
      case "[":
      case "]":
        return this.getPairObject("[", "]", scope);
      case "{":
      case "}":
        return this.getPairObject("{", "}", scope);
      default:
        return null;
    }
  }

  private getWordObject(scope: TextObjectScope, bigWord: boolean): { start: number; end: number } | null {
    const content = this.buffer.content;
    const cursor = this.buffer.cursor;
    const pattern = bigWord ? /\S/ : /\w/;

    let start = cursor;
    let end = cursor;

    // Find word boundaries
    while (start > 0 && pattern.test(content[start - 1])) {
      start--;
    }

    while (end < content.length && pattern.test(content[end])) {
      end++;
    }

    // Adjust for around
    if (scope === "around") {
      // Include trailing whitespace
      while (end < content.length && /\s/.test(content[end]) && content[end] !== "\n") {
        end++;
      }

      // Or leading whitespace if no trailing
      if (end === cursor) {
        while (start > 0 && /\s/.test(content[start - 1]) && content[start - 1] !== "\n") {
          start--;
        }
      }
    }

    return { start, end };
  }

  private getQuoteObject(quote: string, scope: TextObjectScope): { start: number; end: number } | null {
    const content = this.buffer.content;
    const cursor = this.buffer.cursor;

    // Find opening quote
    let start = cursor;
    while (start >= 0 && content[start] !== quote) {
      start--;
    }

    if (start < 0) return null;

    // Find closing quote
    let end = cursor;
    if (content[end] === quote) {
      end++;
    }
    while (end < content.length && content[end] !== quote) {
      end++;
    }

    if (end >= content.length) return null;

    if (scope === "inner") {
      return { start: start + 1, end };
    } else {
      return { start, end: end + 1 };
    }
  }

  private getPairObject(open: string, close: string, scope: TextObjectScope): { start: number; end: number } | null {
    const content = this.buffer.content;
    const cursor = this.buffer.cursor;

    let depth = 0;
    let start = cursor;

    // Find opening
    while (start >= 0) {
      if (content[start] === close) depth++;
      if (content[start] === open) {
        if (depth === 0) break;
        depth--;
      }
      start--;
    }

    if (start < 0) return null;

    // Find closing
    depth = 0;
    let end = start;
    while (end < content.length) {
      if (content[end] === open) depth++;
      if (content[end] === close) {
        depth--;
        if (depth === 0) break;
      }
      end++;
    }

    if (end >= content.length) return null;

    if (scope === "inner") {
      return { start: start + 1, end };
    } else {
      return { start, end: end + 1 };
    }
  }

  // ==========================================================================
  // EDITING OPERATIONS
  // ==========================================================================

  private insertText(text: string): void {
    this.saveUndoState();
    const { content, cursor } = this.buffer;
    this.buffer.content = content.slice(0, cursor) + text + content.slice(cursor);
    this.buffer.cursor = cursor + text.length;
    this.events.onContentChange?.(this.buffer.content);
  }

  private deleteChar(): void {
    const { content, cursor } = this.buffer;
    if (cursor < content.length) {
      this.saveUndoState();
      this.buffer.content = content.slice(0, cursor) + content.slice(cursor + 1);
      this.events.onContentChange?.(this.buffer.content);
    }
  }

  private delete(start: number, end: number): void {
    this.saveUndoState();
    this.buffer.content = this.buffer.content.slice(0, start) + this.buffer.content.slice(end);
    this.buffer.cursor = Math.min(start, this.buffer.content.length - 1);
    this.events.onContentChange?.(this.buffer.content);
  }

  private deleteWordBackward(): void {
    const start = this.buffer.cursor;
    this.moveWordBackward();
    this.delete(this.buffer.cursor, start);
  }

  private deleteToLineStart(): void {
    const lineStart = this.getLineStart();
    this.delete(lineStart, this.buffer.cursor);
    this.buffer.cursor = lineStart;
  }

  private deleteLine(count: number): void {
    this.saveUndoState();
    const lines = this.buffer.content.split("\n");
    const { line } = this.getCursorLineCol();

    const deleteEnd = Math.min(line + count, lines.length);
    const deleted = lines.slice(line, deleteEnd).join("\n");

    // Yank to register
    this.buffer.registers.set("", { text: deleted, type: "line" });

    // Delete lines
    lines.splice(line, count);
    this.buffer.content = lines.join("\n");

    // Adjust cursor
    const newLine = Math.min(line, lines.length - 1);
    this.buffer.cursor = this.getPositionFromLineCol(Math.max(0, newLine), 0);

    this.events.onContentChange?.(this.buffer.content);
  }

  private yank(start: number, end: number): void {
    const text = this.buffer.content.slice(start, end);
    this.buffer.registers.set("", { text, type: "char" });
  }

  private yankLine(count: number): void {
    const lines = this.buffer.content.split("\n");
    const { line } = this.getCursorLineCol();
    const yanked = lines.slice(line, Math.min(line + count, lines.length)).join("\n");
    this.buffer.registers.set("", { text: yanked, type: "line" });
  }

  private paste(before: boolean): void {
    const register = this.buffer.registers.get("") || { text: "", type: "char" };

    if (register.type === "line") {
      const lines = this.buffer.content.split("\n");
      const { line } = this.getCursorLineCol();

      if (before) {
        lines.splice(line, 0, register.text);
      } else {
        lines.splice(line + 1, 0, register.text);
      }

      this.buffer.content = lines.join("\n");

      // Move to pasted line
      const targetLine = before ? line : line + 1;
      this.buffer.cursor = this.getPositionFromLineCol(targetLine, 0);
    } else {
      const pos = before ? this.buffer.cursor : this.buffer.cursor + 1;
      this.buffer.content =
        this.buffer.content.slice(0, pos) + register.text + this.buffer.content.slice(pos);
      this.buffer.cursor = pos + register.text.length - 1;
    }

    this.events.onContentChange?.(this.buffer.content);
  }

  private applyOperator(operator: string, start: number, end: number, _count: number): void {
    switch (operator) {
      case "d":
        this.yank(start, end);
        this.delete(start, end);
        break;

      case "c":
        this.yank(start, end);
        this.delete(start, end);
        this.setMode("insert");
        break;

      case "y":
        this.yank(start, end);
        this.buffer.cursor = start;
        break;
    }
  }

  // ==========================================================================
  // UNDO/REDO
  // ==========================================================================

  private saveUndoState(): void {
    this.buffer.undoStack.push({
      content: this.buffer.content,
      cursor: this.buffer.cursor,
    });

    if (this.buffer.undoStack.length > MAX_UNDO_HISTORY) {
      this.buffer.undoStack.shift();
    }

    // Clear redo stack on new change
    this.buffer.redoStack = [];
  }

  private undo(): void {
    if (this.buffer.undoStack.length === 0) return;

    // Save current state to redo
    this.buffer.redoStack.push({
      content: this.buffer.content,
      cursor: this.buffer.cursor,
    });

    const state = this.buffer.undoStack.pop()!;
    this.buffer.content = state.content;
    this.buffer.cursor = Math.min(state.cursor, state.content.length - 1);

    this.events.onContentChange?.(this.buffer.content);
    this.updateStatus();
  }

  private redo(): void {
    if (this.buffer.redoStack.length === 0) return;

    // Save current state to undo
    this.buffer.undoStack.push({
      content: this.buffer.content,
      cursor: this.buffer.cursor,
    });

    const state = this.buffer.redoStack.pop()!;
    this.buffer.content = state.content;
    this.buffer.cursor = Math.min(state.cursor, state.content.length - 1);

    this.events.onContentChange?.(this.buffer.content);
    this.updateStatus();
  }

  // ==========================================================================
  // COMMAND MODE
  // ==========================================================================

  private executeCommand(cmd: string): CommandResult {
    const command = cmd.slice(1).trim(); // Remove leading ':'

    switch (command) {
      case "w":
        return { save: true, message: "Save requested" };

      case "q":
        return { quit: true };

      case "wq":
      case "x":
        return { save: true, quit: true };

      case "q!":
        return { quit: true };

      default:
        // Handle :set commands, etc.
        if (command.startsWith("set ")) {
          return this.handleSetCommand(command.slice(4));
        }

        return { error: `Unknown command: ${command}` };
    }
  }

  private handleSetCommand(args: string): CommandResult {
    const parts = args.split("=");
    const option = parts[0].trim();
    const value = parts[1]?.trim();

    // Just acknowledge for now
    return { message: `Set ${option}${value ? ` = ${value}` : ""}` };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private clearPending(): void {
    this.pendingOperator = "";
    this.countBuffer = "";
    this.pendingCount = 0;
    this.updateStatus();
  }

  private saveCommand(cmd: string): void {
    this.buffer.lastCommand = (this.countBuffer || "") + cmd;
  }

  private repeatLastCommand(): void {
    // Simple repeat - just re-execute the string
    // A full implementation would replay the actual operations
    const cmd = this.buffer.lastCommand;
    if (!cmd) return;

    // Parse and execute
    for (const char of cmd) {
      this.processKey({
        sequence: char,
        name: char,
        ctrl: false,
        meta: false,
        shift: char === char.toUpperCase() && char !== char.toLowerCase(),
      });
    }
  }

  private updateStatus(): void {
    this.events.onStatusUpdate?.(this.getStatus());
  }
}

// ============================================================================
// READLINE INTEGRATION
// ============================================================================

/**
 * Options for Vim readline
 */
export interface VimReadlineOptions {
  prompt?: string;
  initialValue?: string;
  startInNormalMode?: boolean;
}

/**
 * Create a readline-like interface with Vim keybindings
 */
export class VimReadline {
  private editor: VimEditor;
  private rl: readline.Interface | null = null;
  private prompt: string;
  private resolve: ((value: string) => void) | null = null;
  private reject: ((reason: Error) => void) | null = null;

  constructor(options: VimReadlineOptions = {}) {
    this.prompt = options.prompt ?? "> ";

    this.editor = new VimEditor(options.initialValue ?? "", {
      onModeChange: () => this.render(),
      onContentChange: () => this.render(),
      onCommand: (result) => this.handleCommand(result),
      onStatusUpdate: () => this.render(),
    });

    if (options.startInNormalMode) {
      this.editor.setMode("normal");
    }
  }

  /**
   * Get input from user
   */
  async question(prompt?: string): Promise<string> {
    if (prompt) {
      this.prompt = prompt;
    }

    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      readline.emitKeypressEvents(process.stdin, this.rl);

      this.render();

      const keypressHandler = (_: string, key: readline.Key) => {
        // Handle Ctrl+C globally
        if (key && key.ctrl && key.name === "c") {
          this.cleanup();
          reject(new Error("Cancelled"));
          return;
        }

        // Handle Ctrl+D to submit (for convenience)
        if (key && key.ctrl && key.name === "d") {
          this.cleanup();
          resolve(this.editor.getContent());
          return;
        }

        // Handle Enter in insert mode to submit
        if (key && key.name === "return" && this.editor.getMode() === "insert") {
          this.cleanup();
          resolve(this.editor.getContent());
          return;
        }

        // Let Vim handle it
        const buffer = Buffer.from(key?.sequence || "");
        this.editor.processRawKey(buffer, key);
      };

      process.stdin.on("keypress", keypressHandler);
    });
  }

  /**
   * Get the Vim editor instance
   */
  getEditor(): VimEditor {
    return this.editor;
  }

  private render(): void {
    const content = this.editor.render();
    const status = this.editor.getStatus();

    // Clear line and redraw
    process.stdout.write("\r\x1b[K");
    process.stdout.write(c.dim(this.prompt) + content);

    // Show status on next line
    process.stdout.write("\n\r\x1b[K" + status);
    process.stdout.write("\x1b[A"); // Move back up

    // Position cursor
    const cursorOffset = this.prompt.length + this.editor.getCursor();
    process.stdout.write(`\r\x1b[${cursorOffset + 1}G`);
  }

  private handleCommand(result: CommandResult): void {
    if (result.quit) {
      this.cleanup();
      if (result.save && this.resolve) {
        this.resolve(this.editor.getContent());
      } else if (this.reject) {
        this.reject(new Error("Quit without saving"));
      }
    }

    if (result.error) {
      // Show error briefly
      process.stdout.write("\n" + c.error(result.error) + "\n");
    }

    if (result.message) {
      process.stdout.write("\n" + c.success(result.message) + "\n");
    }
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    process.stdout.write("\n");
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Create a Vim editor
 */
export function createVimEditor(initialContent: string = "", events: VimEvents = {}): VimEditor {
  return new VimEditor(initialContent, events);
}

/**
 * Create a Vim readline interface
 */
export function createVimReadline(options: VimReadlineOptions = {}): VimReadline {
  return new VimReadline(options);
}

/**
 * Quick function to get Vim-style input
 */
export async function vimInput(prompt: string = "> ", options: VimReadlineOptions = {}): Promise<string> {
  const vrl = new VimReadline({ ...options, prompt });
  return vrl.question();
}
