import * as readline from "readline";
import chalk from "chalk";
import { getClipboardImage, type ClipboardImage } from "./clipboard.js";
import type { ContentBlock, ImageContent } from "../providers/types.js";

const c = {
  dim: chalk.gray,
  accent: chalk.hex("#D4A574"),
  highlight: chalk.bgHex("#2D4F67"),
};

export interface InputResult {
  text: string;
  images: ClipboardImage[];
}

export interface InputState {
  text: string;
  images: ClipboardImage[];
  cursorPos: number;
}

/**
 * Enhanced input handler with image paste support
 */
export class InputHandler {
  private rl: readline.Interface | null = null;
  private images: ClipboardImage[] = [];
  private prompt: string;
  private onSubmit: (result: InputResult) => void;

  constructor(prompt: string, onSubmit: (result: InputResult) => void) {
    this.prompt = prompt;
    this.onSubmit = onSubmit;
  }

  start() {
    this.images = [];

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Enable raw mode for keypress detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, this.rl);

    // Handle keypress for Ctrl+V detection
    const keypressHandler = (_: string, key: readline.Key) => {
      if (key && key.ctrl && key.name === "v") {
        this.handlePaste();
      }
    };

    process.stdin.on("keypress", keypressHandler);

    this.rl.on("line", (input) => {
      process.stdin.removeListener("keypress", keypressHandler);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      this.onSubmit({
        text: input.trim(),
        images: this.images,
      });
    });

    this.rl.on("close", () => {
      process.exit(0);
    });

    this.showPrompt();
  }

  private showPrompt() {
    const imageIndicator = this.images.length > 0
      ? c.dim(` [${this.images.map((_, i) => `Image #${i + 1}`).join("] [")}] `)
      : "";

    process.stdout.write(`\r\x1b[K${this.prompt}${imageIndicator}`);
  }

  private handlePaste() {
    const image = getClipboardImage();
    if (image) {
      this.images.push(image);
      // Show updated prompt with image count
      const line = (this.rl as any).line || "";
      this.showPrompt();
      process.stdout.write(line);
    }
  }

  clear() {
    this.images = [];
  }

  close() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

/**
 * Create user message content blocks from input result
 */
export function createUserContent(result: InputResult): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Add images first
  for (const img of result.images) {
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.data,
      },
    } as ImageContent);
  }

  // Add text
  if (result.text) {
    blocks.push({ type: "text", text: result.text });
  }

  return blocks;
}

/**
 * Format image indicator for display
 */
export function formatImageIndicator(count: number): string {
  if (count === 0) return "";
  const labels = Array.from({ length: count }, (_, i) => `Image #${i + 1}`);
  return c.dim(`[${labels.join("] [")}]`);
}

/**
 * Simple readline with autocomplete and image support
 */
export function createEnhancedReadline(
  completer?: (line: string) => [string[], string]
): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    terminal: true,
  });

  return rl;
}
