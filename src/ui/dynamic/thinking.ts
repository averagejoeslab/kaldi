/**
 * Thinking Display
 *
 * Shows animated thinking indicator with reasoning text.
 */

import { c } from "../theme/colors.js";
import { mascot } from "../theme/ascii-art.js";

const THINKING_FRAMES = ["∴", "∵", "∴", "∵"];
const THINKING_INTERVAL = 400;

/**
 * Dynamic Thinking Display class
 */
export class DynamicThinkingDisplay {
  private frameIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private isActive = false;
  private currentText = "";
  private stream = process.stderr;
  private linesWritten = 0;

  /**
   * Start thinking display
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.frameIndex = 0;
    this.currentText = "";
    this.linesWritten = 0;

    // Hide cursor
    this.stream.write("\x1B[?25l");

    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % THINKING_FRAMES.length;
      this.render();
    }, THINKING_INTERVAL);
  }

  /**
   * Update thinking text
   */
  update(text: string): void {
    this.currentText = text;
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Append to thinking text
   */
  append(text: string): void {
    this.currentText += text;
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Stop thinking display
   */
  stop(): void {
    if (!this.isActive) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isActive = false;

    // Clear thinking display
    this.clearDisplay();

    // Show cursor
    this.stream.write("\x1B[?25h");
  }

  /**
   * Render thinking display
   */
  private render(): void {
    this.clearDisplay();

    const frame = c.dim(THINKING_FRAMES[this.frameIndex]);
    const label = c.dim("Thinking…");

    // Header line
    this.stream.write(`${frame} ${label}\n`);
    this.linesWritten = 1;

    // Show thinking text if available (truncated to fit)
    if (this.currentText) {
      const maxWidth = (process.stdout.columns || 80) - 4;
      const lines = this.wrapText(this.currentText, maxWidth);
      const displayLines = lines.slice(-5); // Show last 5 lines

      for (const line of displayLines) {
        this.stream.write(`  ${c.dim(line)}\n`);
        this.linesWritten++;
      }
    }
  }

  /**
   * Clear the display
   */
  private clearDisplay(): void {
    // Move cursor up and clear each line
    for (let i = 0; i < this.linesWritten; i++) {
      this.stream.write("\x1B[1A\x1B[2K");
    }
    this.linesWritten = 0;
  }

  /**
   * Wrap text to width
   */
  private wrapText(text: string, width: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

/**
 * Create thinking display instance
 */
export function createDynamicThinkingDisplay(): DynamicThinkingDisplay {
  return new DynamicThinkingDisplay();
}

// Singleton instance
let dynamicThinkingInstance: DynamicThinkingDisplay | null = null;

export function getDynamicThinkingDisplay(): DynamicThinkingDisplay {
  if (!dynamicThinkingInstance) {
    dynamicThinkingInstance = new DynamicThinkingDisplay();
  }
  return dynamicThinkingInstance;
}
