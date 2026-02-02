/**
 * Status Bar
 *
 * Bottom status bar with token counts and shortcuts.
 */

import { c } from "../theme/colors.js";
import { mascot } from "../theme/ascii-art.js";
import { getTerminalWidth, stripAnsi } from "./box.js";
import type { StatusBarConfig } from "./types.js";

/**
 * Format token count with K/M suffix
 */
function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(2)}M`;
}

/**
 * Status Bar class
 */
export class StatusBar {
  private stream = process.stderr;
  private config: StatusBarConfig = {
    inputTokens: 0,
    outputTokens: 0,
    version: "0.1.0",
  };
  private isVisible = false;
  private lastLine = "";

  /**
   * Update status bar configuration
   */
  update(config: Partial<StatusBarConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Show the status bar
   */
  show(): void {
    this.isVisible = true;
    this.render();
  }

  /**
   * Hide the status bar
   */
  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.clear();
  }

  /**
   * Render the status bar
   */
  render(): void {
    const width = getTerminalWidth();
    const line = this.buildStatusLine(width);

    // Clear previous line and write new one
    this.clear();
    this.stream.write(line);
    this.lastLine = line;
  }

  /**
   * Clear the status bar
   */
  private clear(): void {
    if (this.lastLine) {
      this.stream.write("\r\x1B[K");
    }
  }

  /**
   * Build the status line
   */
  private buildStatusLine(width: number): string {
    const parts: string[] = [];

    // Left side: Kaldi icon and mode
    const modeIcon = this.getModeIcon();
    parts.push(`${c.honey(mascot.icon)} ${modeIcon}`);

    // Center: Token counts
    const tokens = this.buildTokenDisplay();
    parts.push(tokens);

    // Right side: Shortcuts hint and version
    const shortcuts = c.dim("/help • /clear • /exit");
    const version = c.dim(`v${this.config.version}`);
    parts.push(`${shortcuts} ${c.dim("│")} ${version}`);

    // Calculate spacing
    const leftPart = parts[0];
    const centerPart = parts[1];
    const rightPart = parts[2];

    const leftLen = stripAnsi(leftPart).length;
    const centerLen = stripAnsi(centerPart).length;
    const rightLen = stripAnsi(rightPart).length;

    const totalContent = leftLen + centerLen + rightLen;
    const availableSpace = width - totalContent;

    if (availableSpace < 4) {
      // Not enough space, show minimal
      return `${leftPart} ${centerPart}`;
    }

    const leftPadding = Math.floor(availableSpace / 2);
    const rightPadding = availableSpace - leftPadding;

    return `${leftPart}${" ".repeat(leftPadding)}${centerPart}${" ".repeat(rightPadding)}${rightPart}`;
  }

  /**
   * Get mode icon
   */
  private getModeIcon(): string {
    switch (this.config.mode) {
      case "safe":
        return c.success("●");
      case "auto":
        return c.honey("●");
      case "plan":
        return c.info("●");
      default:
        return c.dim("●");
    }
  }

  /**
   * Build token count display
   */
  private buildTokenDisplay(): string {
    const input = formatTokens(this.config.inputTokens);
    const output = formatTokens(this.config.outputTokens);
    const total = formatTokens(this.config.inputTokens + this.config.outputTokens);

    return `${c.dim("↑")}${c.cream(input)} ${c.dim("↓")}${c.cream(output)} ${c.dim("=")}${c.honey(total)}`;
  }
}

/**
 * Create a status bar instance
 */
export function createStatusBar(): StatusBar {
  return new StatusBar();
}

// Singleton instance
let statusBarInstance: StatusBar | null = null;

export function getStatusBar(): StatusBar {
  if (!statusBarInstance) {
    statusBarInstance = new StatusBar();
  }
  return statusBarInstance;
}

/**
 * Format a simple status line (non-persistent)
 */
export function formatStatusLine(config: StatusBarConfig): string {
  const bar = new StatusBar();
  bar.update(config);
  return bar["buildStatusLine"](getTerminalWidth());
}
