/**
 * Kaldi Status Bar
 *
 * Persistent bottom status bar with dog-themed modes.
 */

import { c } from "../theme/colors.js";
import {
  getPermissionManager,
  formatModeWithDescription,
  formatModeChangeHint,
  type PermissionMode,
} from "./permission-modes.js";
import { getBackgroundTaskManager } from "./background-tasks.js";
import { getTerminalWidth } from "./box.js";

export interface StatusBarState {
  inputTokens: number;
  outputTokens: number;
  sessionName?: string;
  pendingTools: number;
  isProcessing: boolean;
  currentAction?: string;
  elapsedTime?: number;
}

/**
 * Kaldi Status Bar
 */
export class KaldiStatusBar {
  private stream = process.stderr;
  private state: StatusBarState = {
    inputTokens: 0,
    outputTokens: 0,
    pendingTools: 0,
    isProcessing: false,
  };
  private visible = false;
  private lastRender = "";

  /**
   * Update status bar state
   */
  update(updates: Partial<StatusBarState>): void {
    this.state = { ...this.state, ...updates };
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Show the status bar
   */
  show(): void {
    this.visible = true;
    this.render();
  }

  /**
   * Hide the status bar
   */
  hide(): void {
    if (this.visible) {
      this.clear();
      this.visible = false;
    }
  }

  /**
   * Clear the status bar
   */
  clear(): void {
    if (this.lastRender) {
      this.stream.write("\r\x1B[K");
      this.lastRender = "";
    }
  }

  /**
   * Render the status bar
   */
  render(): void {
    const width = getTerminalWidth();
    const line = this.buildStatusLine(width);

    this.clear();
    this.stream.write(line);
    this.lastRender = line;
  }

  /**
   * Build the status line content
   */
  private buildStatusLine(width: number): string {
    const parts: string[] = [];
    const permissionManager = getPermissionManager();
    const taskManager = getBackgroundTaskManager();

    // Separator line
    const separator = c.dim("─".repeat(width));

    // Mode indicator
    const mode = permissionManager.getMode();
    const modeDisplay = this.formatModeIndicator(mode);
    parts.push(modeDisplay);

    // Background tasks
    const taskCounts = taskManager.getTaskCounts();
    if (taskCounts.running > 0) {
      parts.push(c.honey(`${taskCounts.running} task${taskCounts.running > 1 ? "s" : ""} running`));
    }

    // Pending tools
    if (this.state.pendingTools > 0) {
      parts.push(c.warning(`${this.state.pendingTools} pending`));
    }

    // Token count
    const tokens = this.formatTokens();
    parts.push(tokens);

    // Session name
    if (this.state.sessionName) {
      parts.push(c.dim(`session: ${this.state.sessionName}`));
    }

    // Help hint
    parts.push(c.dim("/help"));

    // Build the line
    const content = parts.join(c.dim(" · "));

    return `\n${separator}\n${content}`;
  }

  /**
   * Format mode indicator
   */
  private formatModeIndicator(mode: PermissionMode): string {
    const config = getPermissionManager().getConfig();
    return `${config.icon} ${config.color(config.name)}`;
  }

  /**
   * Format token count
   */
  private formatTokens(): string {
    const formatNum = (n: number): string => {
      if (n < 1000) return String(n);
      if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
      return `${(n / 1000000).toFixed(2)}M`;
    };

    const input = formatNum(this.state.inputTokens);
    const output = formatNum(this.state.outputTokens);

    return c.dim(`↑${input} ↓${output}`);
  }

  /**
   * Format processing status line (shown above status bar during processing)
   */
  formatProcessingLine(
    verb: string,
    elapsed: number,
    tokens: number,
    extra?: string
  ): string {
    const time = this.formatDuration(elapsed);
    const tokenStr = this.formatSingleTokenCount(tokens);

    let line = `${c.honey("☕")} ${c.honey(verb + "...")} (${time} · ${tokenStr}`;

    if (extra) {
      line += ` · ${extra}`;
    }

    line += ")";

    return line;
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
   * Format single token count
   */
  private formatSingleTokenCount(n: number): string {
    if (n < 1000) return `↑${n} tokens`;
    if (n < 1000000) return `↑${(n / 1000).toFixed(1)}k tokens`;
    return `↑${(n / 1000000).toFixed(2)}M tokens`;
  }
}

// Singleton instance
let statusBar: KaldiStatusBar | null = null;

export function getKaldiStatusBar(): KaldiStatusBar {
  if (!statusBar) {
    statusBar = new KaldiStatusBar();
  }
  return statusBar;
}
