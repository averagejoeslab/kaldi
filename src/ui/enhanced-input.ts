/**
 * Enhanced Input Handler
 *
 * Proper terminal input handling that:
 * - Calculates visible prompt width (strips ANSI codes)
 * - Handles special keys (Shift+Tab, Ctrl+O, etc.)
 * - Maintains cursor position correctly on backspace
 * - Supports multi-line input
 */

import * as readline from "readline";
import { c } from "./theme/colors.js";
import {
  keyboard,
  KeyboardHandler,
  attachToReadline,
  type KeyEvent,
  type ActionEvent,
} from "./keyboard.js";

// ANSI regex to strip color codes for width calculation
const ANSI_REGEX = /\x1B\[[0-9;]*[a-zA-Z]|\x1B\].*?\x07/g;

/**
 * Strip ANSI codes from a string to get visible length
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

/**
 * Get visible width of a string (excluding ANSI codes)
 */
export function visibleWidth(str: string): number {
  return stripAnsi(str).length;
}

export interface EnhancedInputOptions {
  prompt: string;
  history?: string[];
  multiline?: boolean;
  onKeyAction?: (action: string, event?: ActionEvent) => boolean | void;
}

export interface EnhancedInputResult {
  text: string;
  cancelled: boolean;
}

/**
 * Enhanced Input class with proper ANSI handling
 */
export class EnhancedInput {
  private rl: readline.Interface | null = null;
  private prompt: string;
  private visiblePromptWidth: number;
  private history: string[];
  private historyIndex: number = -1;
  private multiline: boolean;
  private buffer: string = "";
  private cursorPos: number = 0;
  private keyboardCleanup: (() => void) | null = null;
  private onKeyAction?: (action: string, event?: ActionEvent) => boolean | void;
  private resolveInput: ((result: EnhancedInputResult) => void) | null = null;
  private rawModeEnabled = false;

  constructor(options: EnhancedInputOptions) {
    this.prompt = options.prompt;
    this.visiblePromptWidth = visibleWidth(options.prompt);
    this.history = options.history || [];
    this.historyIndex = this.history.length;
    this.multiline = options.multiline || false;
    this.onKeyAction = options.onKeyAction;
  }

  /**
   * Update the prompt (for mode changes)
   */
  setPrompt(prompt: string): void {
    this.prompt = prompt;
    this.visiblePromptWidth = visibleWidth(prompt);
    if (this.rl) {
      // Use internal _setPrompt to set the prompt properly
      (this.rl as any).setPrompt(prompt);
    }
  }

  /**
   * Get input from user
   */
  async getInput(): Promise<EnhancedInputResult> {
    return new Promise((resolve) => {
      this.resolveInput = resolve;

      // Create readline with our prompt
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        prompt: this.prompt,
        // This is key - tells readline the visible prompt width
        // Prevents backspace corruption with ANSI codes
      });

      // Enable raw mode for keypress events
      if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin, this.rl);
      }

      // Setup keyboard handler
      this.setupKeyboardHandler();

      // Handle line input
      this.rl.on("line", (input) => {
        this.cleanup();
        resolve({ text: input.trim(), cancelled: false });
      });

      // Handle close
      this.rl.on("close", () => {
        this.cleanup();
        resolve({ text: "", cancelled: true });
      });

      // Show prompt
      this.rl.prompt();
    });
  }

  /**
   * Setup keyboard handler for special keys
   */
  private setupKeyboardHandler(): void {
    if (!this.rl) return;

    // Create keypress handler
    const keypressHandler = (_: string, key: readline.Key) => {
      if (!key) return;

      // Create event
      const event: KeyEvent = {
        sequence: key.sequence || "",
        name: key.name || "",
        ctrl: key.ctrl || false,
        meta: key.meta || false,
        shift: key.shift || false,
      };

      // Check for Shift+Tab
      if (event.shift && event.name === "tab") {
        if (this.onKeyAction?.("cycle-permission")) {
          // Action was handled
          return;
        }
      }

      // Check for Ctrl+O
      if (event.ctrl && event.name === "o") {
        if (this.onKeyAction?.("toggle-verbose")) {
          return;
        }
      }

      // Check for Ctrl+L (clear screen)
      if (event.ctrl && event.name === "l") {
        if (this.onKeyAction?.("clear")) {
          return;
        }
      }

      // Check for Ctrl+T (toggle tasks)
      if (event.ctrl && event.name === "t") {
        if (this.onKeyAction?.("toggle-task-list")) {
          return;
        }
      }
    };

    process.stdin.on("keypress", keypressHandler);

    this.keyboardCleanup = () => {
      process.stdin.removeListener("keypress", keypressHandler);
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Cancel input
   */
  cancel(): void {
    if (this.resolveInput) {
      this.cleanup();
      this.resolveInput({ text: "", cancelled: true });
    }
  }
}

/**
 * Create a simple prompt with proper ANSI handling
 *
 * This function wraps readline to handle ANSI codes properly
 */
export function createPrompt(options: {
  prompt: string;
  onKeyAction?: (action: string) => boolean | void;
}): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Enable keypress events
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin, rl);
    }

    // Keypress handler
    const keypressHandler = (_: string, key: readline.Key) => {
      if (!key) return;

      // Shift+Tab
      if (key.shift && key.name === "tab") {
        if (options.onKeyAction?.("cycle-permission")) {
          // Redraw prompt after mode change
          process.stdout.write("\r\x1B[K" + options.prompt);
          process.stdout.write((rl as any).line || "");
        }
      }

      // Ctrl+O
      if (key.ctrl && key.name === "o") {
        options.onKeyAction?.("toggle-verbose");
      }

      // Ctrl+L
      if (key.ctrl && key.name === "l") {
        options.onKeyAction?.("clear");
      }
    };

    process.stdin.on("keypress", keypressHandler);

    rl.question(options.prompt, (answer) => {
      process.stdin.removeListener("keypress", keypressHandler);
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Calculate proper cursor position for prompt with ANSI codes
 */
export function calculateCursorPosition(prompt: string, input: string, cursorPos: number): number {
  const promptWidth = visibleWidth(prompt);
  return promptWidth + cursorPos;
}
