/**
 * Kaldi UI Manager
 *
 * Unified UI management for the complete Kaldi experience.
 */

import { c } from "../theme/colors.js";
import { dogFace, dogEmote, errorMessages, getSuccessMessage } from "../theme/dog-messages.js";
import { coffeeVerbs, dogVerbs, spinnerConfigs, coffeeFrames } from "../theme/coffee-spinners.js";
import {
  getPermissionManager,
  type PermissionMode,
  formatMode,
  formatModeWithDescription,
} from "./permission-modes.js";
import { getBackgroundTaskManager, type BackgroundTask } from "./background-tasks.js";
import { getKaldiStatusBar } from "./kaldi-status-bar.js";
import { getCollapsibleOutput, formatWithCollapseHint } from "./collapsible-output.js";
import { printKaldiWelcome, type KaldiWelcomeConfig } from "./kaldi-welcome.js";
import { printKaldiGoodbye, type GoodbyeConfig } from "./kaldi-goodbye.js";
import { getTerminalWidth } from "./box.js";

// ANSI escape codes
const ansi = {
  hideCursor: "\x1B[?25l",
  showCursor: "\x1B[?25h",
  clearLine: "\x1B[2K",
  moveUp: (n: number) => `\x1B[${n}A`,
  moveToStart: "\r",
};

export interface ToolExecution {
  name: string;
  args?: Record<string, unknown>;
  startTime: number;
  status: "running" | "success" | "error";
  output?: string;
}

/**
 * Kaldi UI Manager - The complete UI experience
 */
export class KaldiUI {
  private stream = process.stderr;
  private stdout = process.stdout;

  // State
  private isActive = false;
  private currentVerb = coffeeVerbs.brewing;
  private startTime = Date.now();
  private inputTokens = 0;
  private outputTokens = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private sessionStartTime = Date.now();
  private sessionName?: string;

  // Spinner
  private spinnerFrameIndex = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private spinnerFrames = coffeeFrames.dots;

  // Current state
  private mode: "idle" | "thinking" | "tool" | "streaming" = "idle";
  private currentTool?: ToolExecution;
  private statusLineVisible = false;
  private lastStatusLine = "";
  private toolsThisTurn: Array<{ name: string; duration: string; success: boolean }> = [];

  // Components
  private permissionManager = getPermissionManager();
  private taskManager = getBackgroundTaskManager();
  private statusBar = getKaldiStatusBar();
  private collapsibleOutput = getCollapsibleOutput();

  /**
   * Initialize the UI
   */
  initialize(config: KaldiWelcomeConfig): void {
    this.sessionName = config.sessionName;
    this.sessionStartTime = Date.now();
    printKaldiWelcome(config);
  }

  /**
   * Start a new turn (user sent a message)
   */
  startTurn(): void {
    this.isActive = true;
    this.startTime = Date.now();
    this.toolsThisTurn = [];
    this.mode = "thinking";
    this.currentVerb = coffeeVerbs.brewing;
    this.stream.write(ansi.hideCursor);
    this.startSpinner();
  }

  /**
   * End the current turn
   */
  endTurn(): void {
    this.stopSpinner();
    this.clearStatusLine();
    this.stream.write(ansi.showCursor);
    this.mode = "idle";
    this.isActive = false;

    // Show token summary
    this.printTokenSummary();
  }

  /**
   * Update thinking state
   */
  updateThinking(text?: string): void {
    this.mode = "thinking";
    if (text) {
      // Could show thinking preview
    }
    this.renderStatusLine();
  }

  /**
   * Start tool execution
   */
  startTool(name: string, args?: Record<string, unknown>): void {
    this.stopSpinner();
    this.clearStatusLine();

    this.mode = "tool";
    this.currentTool = {
      name,
      args,
      startTime: Date.now(),
      status: "running",
    };

    // Set verb based on tool type
    this.currentVerb = this.getVerbForTool(name);

    // Print tool header
    this.stdout.write("\n");
    this.stdout.write(`${c.honey("●")} ${c.bold(name)}`);

    // Print tool args preview
    const preview = this.formatToolArgs(name, args);
    if (preview) {
      this.stdout.write(` ${c.dim(preview)}`);
    }
    this.stdout.write("\n");

    // Start spinner for tool
    this.startSpinner();
  }

  /**
   * Complete tool execution
   */
  completeTool(success: boolean, output?: string): void {
    this.stopSpinner();
    this.clearStatusLine();

    if (!this.currentTool) return;

    const duration = this.formatDuration(Date.now() - this.currentTool.startTime);
    this.currentTool.status = success ? "success" : "error";
    this.currentTool.output = output;

    // Move up and rewrite the tool line
    this.stream.write(ansi.moveUp(1) + ansi.clearLine);

    // Status icon
    const icon = success ? c.success("✓") : c.error("✗");

    // Rewrite tool header with status
    this.stdout.write(`${icon} ${c.bold(this.currentTool.name)}`);

    const preview = this.formatToolArgs(this.currentTool.name, this.currentTool.args);
    if (preview) {
      this.stdout.write(` ${c.dim(preview)}`);
    }

    this.stdout.write(` ${c.dim(`(${duration})`)}\n`);

    // Show output if error or verbose
    if (!success && output) {
      const errorPreview = output.split("\n")[0].slice(0, 80);
      this.stdout.write(`  └─ ${c.error(errorPreview)}\n`);
    } else if (output && output.trim()) {
      // Collapsible output
      const lines = output.split("\n");
      if (lines.length > 3) {
        this.stdout.write(`  └─ ${c.dim(`+${lines.length} lines (Ctrl+O expand)`)}\n`);
      }
    }

    // Track for summary
    this.toolsThisTurn.push({
      name: this.currentTool.name,
      duration,
      success,
    });

    this.currentTool = undefined;
    this.mode = "thinking";

    // Resume spinner
    this.currentVerb = coffeeVerbs.brewing;
    this.startSpinner();
  }

  /**
   * Start streaming response
   */
  startStreaming(): void {
    this.stopSpinner();
    this.clearStatusLine();
    this.mode = "streaming";
    this.currentVerb = coffeeVerbs.pouring;
  }

  /**
   * Handle text output (streaming)
   */
  onText(text: string): void {
    if (this.mode !== "streaming") {
      this.startStreaming();
    }
    this.stdout.write(text);
  }

  /**
   * Update token counts
   */
  updateTokens(input: number, output: number): void {
    this.inputTokens = input;
    this.outputTokens = output;
    this.totalInputTokens += input;
    this.totalOutputTokens += output;
  }

  /**
   * Cycle permission mode (Shift+Tab)
   */
  cycleMode(): PermissionMode {
    const newMode = this.permissionManager.cycleMode();
    this.showModeChange(newMode);
    return newMode;
  }

  /**
   * Show mode change notification
   */
  private showModeChange(mode: PermissionMode): void {
    const display = formatModeWithDescription(mode);
    this.stdout.write(`\n${display}\n\n`);
  }

  /**
   * Show error
   */
  showError(message: string, type: keyof typeof errorMessages = "apiError"): void {
    this.stopSpinner();
    this.clearStatusLine();
    this.stream.write(ansi.showCursor);

    const errorMsg = errorMessages[type] || errorMessages.apiError;
    this.stdout.write(`\n${errorMsg}\n`);
    this.stdout.write(`  └─ ${c.dim(message)}\n\n`);
  }

  /**
   * Show goodbye and cleanup
   */
  goodbye(): void {
    this.stopSpinner();
    this.stream.write(ansi.showCursor);

    printKaldiGoodbye({
      sessionName: this.sessionName,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      duration: Date.now() - this.sessionStartTime,
    });
  }

  /**
   * Get permission for an action
   */
  async requestPermission(
    action: "edit" | "bash" | "read",
    description: string
  ): Promise<boolean> {
    const { allowed, autoApprove } = this.permissionManager.isAllowed(action);

    if (!allowed) {
      this.stdout.write(`\n${c.error("✗")} ${c.dim("Action not allowed in current mode")}\n`);
      return false;
    }

    if (autoApprove) {
      return true;
    }

    // Show permission prompt
    return this.showPermissionPrompt(action, description);
  }

  /**
   * Show permission prompt
   */
  private async showPermissionPrompt(
    action: string,
    description: string
  ): Promise<boolean> {
    this.stopSpinner();
    this.clearStatusLine();

    const width = Math.min(getTerminalWidth(), 65);
    const lines = [
      "",
      c.cream("┌" + "─".repeat(width - 2) + "┐"),
      c.cream("│") + `  ${c.honey("🐕")} ${c.bold("Permission Request")}`.padEnd(width + 10) + c.cream("│"),
      c.cream("│") + " ".repeat(width - 2) + c.cream("│"),
      c.cream("│") + `  Kaldi wants to ${action}:`.padEnd(width - 2) + c.cream("│"),
      c.cream("│") + `  ${c.dim(description.slice(0, width - 6))}`.padEnd(width + 5) + c.cream("│"),
      c.cream("│") + " ".repeat(width - 2) + c.cream("│"),
      c.cream("│") + `  ${c.success("[Y]")} Yes  ${c.error("[N]")} No  ${c.dim("[A] Always allow")}`.padEnd(width + 15) + c.cream("│"),
      c.cream("└" + "─".repeat(width - 2) + "┘"),
      "",
    ];

    this.stdout.write(lines.join("\n"));

    // For now, auto-approve (TODO: implement actual prompt)
    return true;
  }

  /**
   * Print token summary at end of turn
   */
  private printTokenSummary(): void {
    if (this.inputTokens === 0 && this.outputTokens === 0) return;

    const input = this.formatTokenCount(this.inputTokens);
    const output = this.formatTokenCount(this.outputTokens);
    const total = this.formatTokenCount(this.totalInputTokens + this.totalOutputTokens);
    const duration = this.formatDuration(Date.now() - this.startTime);

    this.stdout.write(`\n  ${c.dim(`↑${input} ↓${output} · ${duration} · Total: ${total}`)}\n`);

    // Reset for next turn
    this.inputTokens = 0;
    this.outputTokens = 0;
  }

  /**
   * Start the spinner
   */
  private startSpinner(): void {
    if (this.spinnerTimer) return;

    this.spinnerFrameIndex = 0;
    this.renderStatusLine();

    this.spinnerTimer = setInterval(() => {
      this.spinnerFrameIndex = (this.spinnerFrameIndex + 1) % this.spinnerFrames.length;
      this.renderStatusLine();
    }, 80);
  }

  /**
   * Stop the spinner
   */
  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  /**
   * Render the status line
   */
  private renderStatusLine(): void {
    const elapsed = Date.now() - this.startTime;
    const frame = this.spinnerFrames[this.spinnerFrameIndex];
    const time = this.formatDuration(elapsed);
    const tokens = this.formatTokenCount(this.totalInputTokens);

    let extra = "";
    if (this.mode === "thinking") {
      extra = "thinking";
    } else if (this.mode === "tool" && this.currentTool) {
      extra = this.currentTool.name;
    }

    const status = `${c.honey(frame)} ${c.honey(this.currentVerb + "...")} (${time} · ↑${tokens} tokens${extra ? ` · ${extra}` : ""})`;

    this.clearStatusLine();
    this.stream.write(status);
    this.lastStatusLine = status;
    this.statusLineVisible = true;
  }

  /**
   * Clear the status line
   */
  private clearStatusLine(): void {
    if (this.statusLineVisible) {
      this.stream.write(ansi.moveToStart + ansi.clearLine);
      this.statusLineVisible = false;
      this.lastStatusLine = "";
    }
  }

  /**
   * Get verb for tool type
   */
  private getVerbForTool(name: string): string {
    const toolVerbs: Record<string, string> = {
      read_file: dogVerbs.fetching,
      list_dir: dogVerbs.sniffing,
      glob: dogVerbs.sniffing,
      grep: dogVerbs.hunting,
      bash: coffeeVerbs.percolating,
      write_file: coffeeVerbs.roasting,
      edit_file: coffeeVerbs.roasting,
      web_fetch: dogVerbs.fetching,
      web_search: dogVerbs.hunting,
    };

    return toolVerbs[name] || coffeeVerbs.percolating;
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
   * Format token count
   */
  private formatTokenCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1000000).toFixed(2)}M`;
  }
}

// Singleton instance
let kaldiUI: KaldiUI | null = null;

export function getKaldiUI(): KaldiUI {
  if (!kaldiUI) {
    kaldiUI = new KaldiUI();
  }
  return kaldiUI;
}

export function resetKaldiUI(): void {
  kaldiUI = null;
}
