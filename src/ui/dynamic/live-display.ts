/**
 * Live Display Manager
 *
 * Manages dynamic terminal output with in-place updates,
 * similar to Claude Code's interface.
 */

import { c } from "../theme/colors.js";
import { mascot } from "../theme/ascii-art.js";

/**
 * ANSI escape codes for terminal control
 */
const ansi = {
  // Cursor control
  hideCursor: "\x1B[?25l",
  showCursor: "\x1B[?25h",
  saveCursor: "\x1B7",
  restoreCursor: "\x1B8",

  // Line control
  clearLine: "\x1B[2K",
  clearToEnd: "\x1B[K",
  moveToColumn: (n: number) => `\x1B[${n}G`,

  // Cursor movement
  moveUp: (n: number) => `\x1B[${n}A`,
  moveDown: (n: number) => `\x1B[${n}B`,
  moveToStart: "\r",

  // Screen control
  clearScreen: "\x1B[2J",
  moveHome: "\x1B[H",
};

interface ToolExecution {
  name: string;
  args?: Record<string, unknown>;
  startTime: number;
  status: "running" | "success" | "error";
  output?: string;
  lineCount: number;
}

interface StatusState {
  mode: "idle" | "thinking" | "tool" | "streaming";
  startTime: number;
  inputTokens: number;
  outputTokens: number;
  currentTool?: ToolExecution;
  thinkingText?: string;
}

/**
 * Live Display Manager
 *
 * Provides Claude Code-like dynamic terminal output.
 */
export class LiveDisplay {
  private stream = process.stderr;
  private state: StatusState = {
    mode: "idle",
    startTime: Date.now(),
    inputTokens: 0,
    outputTokens: 0,
  };
  private statusTimer: NodeJS.Timeout | null = null;
  private toolLines: number = 0;
  private lastStatusLine = "";
  private isActive = false;

  /**
   * Start the live display
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.state.startTime = Date.now();
    this.stream.write(ansi.hideCursor);
  }

  /**
   * Stop the live display
   */
  stop(): void {
    if (!this.isActive) return;
    this.stopStatusTimer();
    this.clearStatus();
    this.stream.write(ansi.showCursor);
    this.isActive = false;
  }

  /**
   * Enter thinking mode
   */
  startThinking(): void {
    this.state.mode = "thinking";
    this.state.startTime = Date.now();
    this.startStatusTimer();
  }

  /**
   * Update thinking text
   */
  updateThinking(text: string): void {
    this.state.thinkingText = text;
    this.renderStatus();
  }

  /**
   * Exit thinking mode
   */
  stopThinking(): void {
    this.stopStatusTimer();
    this.clearStatus();
    this.state.mode = "idle";
    this.state.thinkingText = undefined;
  }

  /**
   * Start a tool execution display
   */
  startTool(name: string, args?: Record<string, unknown>): void {
    this.stopStatusTimer();
    this.clearStatus();

    this.state.mode = "tool";
    this.state.currentTool = {
      name,
      args,
      startTime: Date.now(),
      status: "running",
      lineCount: 0,
    };

    this.renderTool();
    this.startStatusTimer();
  }

  /**
   * Complete a tool execution
   */
  completeTool(success: boolean, output?: string): void {
    if (!this.state.currentTool) return;

    this.state.currentTool.status = success ? "success" : "error";
    this.state.currentTool.output = output;

    this.stopStatusTimer();
    this.renderToolComplete();
    this.state.currentTool = undefined;
    this.state.mode = "idle";
  }

  /**
   * Enter streaming mode (receiving text from LLM)
   */
  startStreaming(): void {
    this.stopStatusTimer();
    this.clearStatus();
    this.state.mode = "streaming";
  }

  /**
   * Update token counts
   */
  updateTokens(input: number, output: number): void {
    this.state.inputTokens = input;
    this.state.outputTokens = output;
  }

  /**
   * Render current tool state
   */
  private renderTool(): void {
    if (!this.state.currentTool) return;

    const tool = this.state.currentTool;
    const icon = this.getToolIcon(tool.name);
    const elapsed = this.formatDuration(Date.now() - tool.startTime);

    // Clear previous tool lines
    this.clearToolLines();

    // Render tool header
    let line = `${c.honey("●")} ${c.bold(tool.name)}`;

    // Add args preview
    const preview = this.formatToolArgs(tool.name, tool.args);
    if (preview) {
      line += c.dim(` ${preview}`);
    }

    this.stream.write(line + "\n");
    this.toolLines = 1;
  }

  /**
   * Render tool completion
   */
  private renderToolComplete(): void {
    if (!this.state.currentTool) return;

    const tool = this.state.currentTool;
    const elapsed = this.formatDuration(Date.now() - tool.startTime);

    // Clear previous tool lines
    this.clearToolLines();

    // Status icon
    const statusIcon = tool.status === "success" ? c.success("✓") : c.error("✗");

    // Render completion line
    let line = `${statusIcon} ${c.bold(tool.name)}`;

    // Add args preview
    const preview = this.formatToolArgs(tool.name, tool.args);
    if (preview) {
      line += c.dim(` ${preview}`);
    }

    line += c.dim(` (${elapsed})`);

    this.stream.write(line + "\n");

    // Show output preview for errors
    if (tool.status === "error" && tool.output) {
      const errorPreview = tool.output.split("\n")[0].slice(0, 80);
      this.stream.write(c.dim(`  └─ ${errorPreview}\n`));
    }

    this.toolLines = 0;
  }

  /**
   * Clear tool display lines
   */
  private clearToolLines(): void {
    for (let i = 0; i < this.toolLines; i++) {
      this.stream.write(ansi.moveUp(1) + ansi.clearLine);
    }
    this.toolLines = 0;
  }

  /**
   * Render status line
   */
  private renderStatus(): void {
    if (!this.isActive) return;

    const elapsed = this.formatDuration(Date.now() - this.state.startTime);
    const tokens = this.formatTokens();

    let status = "";

    switch (this.state.mode) {
      case "thinking":
        const thinkingPreview = this.state.thinkingText
          ? ` · ${this.state.thinkingText.slice(0, 30)}${this.state.thinkingText.length > 30 ? "..." : ""}`
          : "";
        status = `${c.honey("+")} ${c.honey("Processing...")} (${elapsed} · ${tokens}${thinkingPreview})`;
        break;

      case "tool":
        if (this.state.currentTool) {
          const toolElapsed = this.formatDuration(Date.now() - this.state.currentTool.startTime);
          status = `${c.honey("●")} ${this.state.currentTool.name} (${toolElapsed})`;
        }
        break;

      case "streaming":
        status = `${c.success("●")} Responding... (${elapsed} · ${tokens})`;
        break;

      default:
        return;
    }

    // Clear and rewrite status line
    this.stream.write(ansi.moveToStart + ansi.clearLine + status);
    this.lastStatusLine = status;
  }

  /**
   * Clear status line
   */
  private clearStatus(): void {
    if (this.lastStatusLine) {
      this.stream.write(ansi.moveToStart + ansi.clearLine);
      this.lastStatusLine = "";
    }
  }

  /**
   * Start status update timer
   */
  private startStatusTimer(): void {
    this.stopStatusTimer();
    this.statusTimer = setInterval(() => {
      this.renderStatus();
    }, 100);
  }

  /**
   * Stop status update timer
   */
  private stopStatusTimer(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  /**
   * Format tool arguments for display
   */
  private formatToolArgs(name: string, args?: Record<string, unknown>): string {
    if (!args) return "";

    switch (name) {
      case "bash":
        if (args.command) {
          const cmd = String(args.command);
          return cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
        }
        break;

      case "read_file":
      case "write_file":
      case "edit_file":
        if (args.path) return String(args.path);
        break;

      case "list_dir":
        if (args.path) return String(args.path);
        break;

      case "glob":
        if (args.pattern) return String(args.pattern);
        break;

      case "grep":
        if (args.pattern) return String(args.pattern);
        break;
    }

    return "";
  }

  /**
   * Get icon for tool
   */
  private getToolIcon(name: string): string {
    const icons: Record<string, string> = {
      bash: "⚡",
      read_file: "📄",
      write_file: "📝",
      edit_file: "✏️",
      list_dir: "📁",
      glob: "🔍",
      grep: "🔎",
      web_fetch: "🌐",
      web_search: "🌐",
    };
    return icons[name] || "⚙";
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Format token display
   */
  private formatTokens(): string {
    const formatNum = (n: number) => {
      if (n < 1000) return String(n);
      if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
      return `${(n / 1000000).toFixed(2)}M`;
    };

    return `↑ ${formatNum(this.state.inputTokens)} tokens`;
  }
}

// Singleton instance
let liveDisplayInstance: LiveDisplay | null = null;

export function getLiveDisplay(): LiveDisplay {
  if (!liveDisplayInstance) {
    liveDisplayInstance = new LiveDisplay();
  }
  return liveDisplayInstance;
}

export function resetLiveDisplay(): void {
  if (liveDisplayInstance) {
    liveDisplayInstance.stop();
    liveDisplayInstance = null;
  }
}
