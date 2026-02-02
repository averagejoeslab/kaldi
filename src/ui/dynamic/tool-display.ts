/**
 * Tool Execution Display
 *
 * Dynamic display for tool calls with timing and status.
 */

import { c } from "../theme/colors.js";
import { spinnerFrames, AnimatedSpinner } from "./spinner.js";
import { box, stripAnsi, getTerminalWidth } from "./box.js";
import type { ToolState } from "./types.js";

/**
 * Tool icons by category
 */
const toolIcons: Record<string, string> = {
  // File operations
  read: "📄",
  write: "✏️",
  edit: "📝",
  glob: "🔍",
  grep: "🔎",

  // Shell operations
  bash: "⚡",
  shell: "⚡",

  // Web operations
  web_search: "🌐",
  web_fetch: "🌐",

  // Default
  default: "⚙️",
};

/**
 * Get icon for a tool
 */
function getToolIcon(toolName: string): string {
  const normalized = toolName.toLowerCase();
  return toolIcons[normalized] || toolIcons.default;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Tool Display class for showing tool execution
 */
export class ToolDisplay {
  private spinner: AnimatedSpinner;
  private stream = process.stderr;
  private currentTool: ToolState | null = null;
  private linesWritten = 0;

  constructor() {
    this.spinner = new AnimatedSpinner({
      frames: spinnerFrames.dots,
      color: c.honey,
      interval: 80,
    });
  }

  /**
   * Start displaying a tool execution
   */
  start(name: string, args?: Record<string, unknown>): void {
    this.currentTool = {
      name,
      args,
      startTime: Date.now(),
      status: "running",
    };

    this.render();
  }

  /**
   * Update tool status
   */
  update(status: "running" | "success" | "error", result?: string): void {
    if (!this.currentTool) return;

    this.currentTool.status = status;
    if (result) {
      this.currentTool.result = result;
    }

    this.render();
  }

  /**
   * Complete the tool execution
   */
  complete(success: boolean, result?: string): void {
    if (!this.currentTool) return;

    this.currentTool.status = success ? "success" : "error";
    this.currentTool.result = result;

    this.renderFinal();
    this.currentTool = null;
  }

  /**
   * Render the tool display (during execution)
   */
  private render(): void {
    if (!this.currentTool) return;

    this.clearDisplay();

    const icon = getToolIcon(this.currentTool.name);
    const elapsed = Date.now() - this.currentTool.startTime;
    const duration = c.dim(`(${formatDuration(elapsed)})`);

    // Tool header
    const header = `${c.honey("⚙")} ${c.bold(this.currentTool.name)} ${duration}`;
    this.stream.write(header + "\n");
    this.linesWritten = 1;

    // Show args preview if available
    if (this.currentTool.args) {
      const preview = this.formatArgsPreview(this.currentTool.args);
      if (preview) {
        this.stream.write(`  ${c.dim(preview)}\n`);
        this.linesWritten++;
      }
    }
  }

  /**
   * Render final state (after completion)
   */
  private renderFinal(): void {
    if (!this.currentTool) return;

    this.clearDisplay();

    const elapsed = Date.now() - this.currentTool.startTime;
    const duration = c.dim(`(${formatDuration(elapsed)})`);

    // Status indicator
    let statusIcon: string;
    let statusColor: (s: string) => string;

    if (this.currentTool.status === "success") {
      statusIcon = c.success("✓");
      statusColor = c.success;
    } else {
      statusIcon = c.error("✗");
      statusColor = c.error;
    }

    // Tool header with status
    const header = `${statusIcon} ${c.bold(this.currentTool.name)} ${duration}`;
    this.stream.write(header + "\n");

    // Show result preview if available
    if (this.currentTool.result) {
      const preview = this.truncateResult(this.currentTool.result, 2);
      for (const line of preview) {
        this.stream.write(`  ${c.dim(line)}\n`);
      }
    }
  }

  /**
   * Clear the display
   */
  private clearDisplay(): void {
    for (let i = 0; i < this.linesWritten; i++) {
      this.stream.write("\x1B[1A\x1B[2K");
    }
    this.linesWritten = 0;
  }

  /**
   * Format args for preview
   */
  private formatArgsPreview(args: Record<string, unknown>): string {
    const width = getTerminalWidth() - 4;
    const parts: string[] = [];

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) continue;

      let valueStr: string;
      if (typeof value === "string") {
        // Truncate long strings
        valueStr = value.length > 40 ? value.slice(0, 37) + "..." : value;
        // Remove newlines
        valueStr = valueStr.replace(/\n/g, "↵");
      } else if (typeof value === "object") {
        valueStr = "[object]";
      } else {
        valueStr = String(value);
      }

      parts.push(`${key}: ${valueStr}`);
    }

    const result = parts.join(", ");
    return result.length > width ? result.slice(0, width - 3) + "..." : result;
  }

  /**
   * Truncate result for preview
   */
  private truncateResult(result: string, maxLines: number): string[] {
    const width = getTerminalWidth() - 4;
    const lines = result.split("\n").slice(0, maxLines);

    return lines.map((line) => {
      const cleaned = line.replace(/\r/g, "");
      return cleaned.length > width ? cleaned.slice(0, width - 3) + "..." : cleaned;
    });
  }
}

/**
 * Create a tool display instance
 */
export function createToolDisplay(): ToolDisplay {
  return new ToolDisplay();
}

// Singleton instance
let toolDisplayInstance: ToolDisplay | null = null;

export function getToolDisplay(): ToolDisplay {
  if (!toolDisplayInstance) {
    toolDisplayInstance = new ToolDisplay();
  }
  return toolDisplayInstance;
}
