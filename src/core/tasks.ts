/**
 * Background Tasks System for Kaldi CLI
 *
 * Provides background task execution, management, and tool history tracking.
 * Allows operations to run in the background while the user continues working,
 * with support for keyboard shortcuts to background current operations and
 * toggle verbose output modes.
 *
 * Part of the Kaldi CLI - Your loyal coding companion.
 */

import chalk from "chalk";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Task status lifecycle
 */
export type TaskStatus = "pending" | "running" | "complete" | "error";

/**
 * Tool use record for history tracking
 */
export interface ToolUse {
  id: string;
  name: string;
  args: Record<string, unknown>;
  startTime: number;
  endTime?: number;
  result?: string;
  isError?: boolean;
  truncated?: boolean;
}

/**
 * Background task configuration
 */
export interface BackgroundTaskConfig {
  id: string;
  name: string;
  description?: string;
  operation: () => Promise<string>;
  onProgress?: (message: string) => void;
  onComplete?: (result: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Task output record
 */
export interface TaskOutput {
  taskId: string;
  output: string;
  timestamp: number;
  isError: boolean;
}

// ============================================================================
// CONSTANTS - Pyrenees + Coffee Palette
// ============================================================================

const colors = {
  primary: chalk.hex("#C9A66B"),    // Latte
  accent: chalk.hex("#DAA520"),     // Golden honey
  dim: chalk.hex("#A09080"),        // Muted brown-gray
  text: chalk.hex("#F5F0E6"),       // Cream
  success: chalk.hex("#7CB342"),    // Soft green
  error: chalk.hex("#E57373"),      // Soft red
  muted: chalk.hex("#6B5B4F"),      // Dark coffee
};

// Symbols for display
const SYMBOLS = {
  pending: colors.dim("\u25CB"),     // Empty circle
  running: colors.accent("\u25CF"),  // Filled circle
  complete: colors.success("\u2713"), // Check mark
  error: colors.error("\u2717"),     // X mark
  collapsed: colors.dim("\u25B6"),   // Right triangle
  expanded: colors.dim("\u25BC"),    // Down triangle
  background: colors.primary("\u2693"), // Anchor (backgrounded)
};

// ============================================================================
// BACKGROUND TASK CLASS
// ============================================================================

/**
 * BackgroundTask - Runs agent operations in background
 *
 * Like sending Kaldi to fetch something while you continue working.
 * The loyal companion works in the background and returns with results.
 */
export class BackgroundTask extends EventEmitter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: number;

  private _status: TaskStatus = "pending";
  private _output: string = "";
  private _error: Error | null = null;
  private _startTime: number = 0;
  private _endTime: number = 0;
  private operation: () => Promise<string>;
  private progressMessages: string[] = [];
  private abortController: AbortController;

  constructor(config: BackgroundTaskConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || "";
    this.createdAt = Date.now();
    this.operation = config.operation;
    this.abortController = new AbortController();

    // Wire up callbacks
    if (config.onProgress) {
      this.on("progress", config.onProgress);
    }
    if (config.onComplete) {
      this.on("complete", config.onComplete);
    }
    if (config.onError) {
      this.on("error", config.onError);
    }
  }

  /**
   * Get current task status
   */
  get status(): TaskStatus {
    return this._status;
  }

  /**
   * Get task output (when complete or error)
   */
  get output(): string {
    return this._output;
  }

  /**
   * Get error if task failed
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * Get task duration in milliseconds
   */
  get duration(): number {
    if (this._startTime === 0) return 0;
    const end = this._endTime || Date.now();
    return end - this._startTime;
  }

  /**
   * Check if task is still running
   */
  get isRunning(): boolean {
    return this._status === "running";
  }

  /**
   * Check if task is finished (complete or error)
   */
  get isFinished(): boolean {
    return this._status === "complete" || this._status === "error";
  }

  /**
   * Start the background task
   */
  async start(): Promise<void> {
    if (this._status !== "pending") {
      throw new Error(`Task ${this.id} has already been started`);
    }

    this._status = "running";
    this._startTime = Date.now();
    this.emit("start", this);

    try {
      this._output = await this.operation();
      this._status = "complete";
      this._endTime = Date.now();
      this.emit("complete", this._output);
    } catch (err) {
      this._status = "error";
      this._error = err instanceof Error ? err : new Error(String(err));
      this._output = this._error.message;
      this._endTime = Date.now();
      this.emit("error", this._error);
    }

    this.emit("finish", this);
  }

  /**
   * Abort the task (if supported by the operation)
   */
  abort(): void {
    this.abortController.abort();
    this._status = "error";
    this._error = new Error("Task aborted");
    this._output = "Task aborted by user";
    this._endTime = Date.now();
    this.emit("abort", this);
    this.emit("finish", this);
  }

  /**
   * Add a progress message
   */
  progress(message: string): void {
    this.progressMessages.push(message);
    this.emit("progress", message);
  }

  /**
   * Get the abort signal for cooperative cancellation
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Get all progress messages
   */
  getProgressMessages(): string[] {
    return [...this.progressMessages];
  }

  /**
   * Format task for display
   */
  format(verbose: boolean = false): string {
    const statusIcon = SYMBOLS[this._status];
    const duration = this.formatDuration();

    let line = `${statusIcon} ${colors.text(this.name)}`;

    if (this.description && verbose) {
      line += colors.dim(` - ${this.description}`);
    }

    if (this._status === "running") {
      line += colors.dim(` (${duration})`);
    } else if (this.isFinished) {
      line += colors.dim(` [${duration}]`);
    }

    if (this._status === "error" && this._error) {
      line += `\n    ${colors.error(this._error.message)}`;
    }

    return line;
  }

  /**
   * Format duration for display
   */
  private formatDuration(): string {
    const ms = this.duration;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
}

// ============================================================================
// TASK MANAGER
// ============================================================================

/**
 * TaskManager - Singleton for managing background tasks
 *
 * The kennel keeper - tracks all the background tasks Kaldi is working on.
 */
export class TaskManager extends EventEmitter {
  private tasks: Map<string, BackgroundTask> = new Map();
  private taskCounter: number = 0;
  private maxCompletedTasks: number = 50;
  private autoCleanupInterval: NodeJS.Timeout | null = null;
  private verbose: boolean = false;

  constructor() {
    super();
    this.startAutoCleanup();
  }

  /**
   * Create and start a new background task
   */
  async createTask(config: Omit<BackgroundTaskConfig, "id">): Promise<BackgroundTask> {
    const id = this.generateId();
    const task = new BackgroundTask({ ...config, id });

    this.tasks.set(id, task);
    this.emit("taskCreated", task);

    // Forward task events
    task.on("start", () => this.emit("taskStarted", task));
    task.on("complete", (result) => this.emit("taskCompleted", task, result));
    task.on("error", (error) => this.emit("taskError", task, error));
    task.on("finish", () => this.emit("taskFinished", task));

    // Start the task in background
    task.start().catch(() => {
      // Error already handled by task events
    });

    return task;
  }

  /**
   * Background an existing operation
   * Returns the task that will complete when the operation finishes
   */
  backgroundOperation(
    name: string,
    operation: () => Promise<string>,
    description?: string
  ): BackgroundTask {
    const id = this.generateId();
    const task = new BackgroundTask({
      id,
      name,
      description,
      operation,
    });

    this.tasks.set(id, task);
    this.emit("taskCreated", task);
    this.emit("taskBackgrounded", task);

    task.on("finish", () => this.emit("taskFinished", task));

    // Start in next tick to allow caller to attach listeners
    setImmediate(() => {
      task.start().catch(() => {});
    });

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.isRunning);
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === "complete");
  }

  /**
   * Get failed tasks
   */
  getFailedTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === "error");
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === "pending");
  }

  /**
   * Get task output
   */
  getTaskOutput(taskId: string): TaskOutput | undefined {
    const task = this.tasks.get(taskId);
    if (!task || !task.isFinished) return undefined;

    return {
      taskId: task.id,
      output: task.output,
      timestamp: task.createdAt + task.duration,
      isError: task.status === "error",
    };
  }

  /**
   * Remove a task by ID
   */
  removeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    if (task.isRunning) {
      task.abort();
    }

    this.tasks.delete(id);
    this.emit("taskRemoved", task);
    return true;
  }

  /**
   * Clean up completed tasks (keep only recent ones)
   */
  cleanupCompleted(): number {
    const completed = this.getCompletedTasks()
      .sort((a, b) => b.createdAt - a.createdAt);

    let removed = 0;
    if (completed.length > this.maxCompletedTasks) {
      const toRemove = completed.slice(this.maxCompletedTasks);
      for (const task of toRemove) {
        this.tasks.delete(task.id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all finished tasks
   */
  clearFinished(): number {
    const finished = this.getAllTasks().filter((t) => t.isFinished);
    for (const task of finished) {
      this.tasks.delete(task.id);
    }
    return finished.length;
  }

  /**
   * Cancel all running tasks
   */
  cancelAll(): number {
    const running = this.getRunningTasks();
    for (const task of running) {
      task.abort();
    }
    return running.length;
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
    this.emit("verboseChanged", verbose);
  }

  /**
   * Get verbose mode
   */
  isVerbose(): boolean {
    return this.verbose;
  }

  /**
   * Toggle verbose mode
   */
  toggleVerbose(): boolean {
    this.verbose = !this.verbose;
    this.emit("verboseChanged", this.verbose);
    return this.verbose;
  }

  /**
   * Format task list for display (for /tasks command)
   */
  formatTaskList(): string {
    const tasks = this.getAllTasks();

    if (tasks.length === 0) {
      return colors.dim("  No background tasks - Kaldi is resting");
    }

    const lines: string[] = [];
    lines.push("");
    lines.push(colors.primary.bold("  Background Tasks"));
    lines.push(colors.muted("  " + "-".repeat(50)));
    lines.push("");

    // Group by status
    const running = this.getRunningTasks();
    const pending = this.getPendingTasks();
    const completed = this.getCompletedTasks();
    const failed = this.getFailedTasks();

    if (running.length > 0) {
      lines.push(colors.accent("  Running:"));
      for (const task of running) {
        lines.push(`    ${task.format(this.verbose)}`);
      }
      lines.push("");
    }

    if (pending.length > 0) {
      lines.push(colors.dim("  Pending:"));
      for (const task of pending) {
        lines.push(`    ${task.format(this.verbose)}`);
      }
      lines.push("");
    }

    if (completed.length > 0) {
      const shown = this.verbose ? completed : completed.slice(0, 5);
      lines.push(colors.success("  Completed:"));
      for (const task of shown) {
        lines.push(`    ${task.format(this.verbose)}`);
      }
      if (!this.verbose && completed.length > 5) {
        lines.push(colors.dim(`    ... and ${completed.length - 5} more`));
      }
      lines.push("");
    }

    if (failed.length > 0) {
      lines.push(colors.error("  Failed:"));
      for (const task of failed) {
        lines.push(`    ${task.format(this.verbose)}`);
      }
      lines.push("");
    }

    // Summary
    lines.push(colors.muted("  " + "-".repeat(50)));
    lines.push(colors.dim(`  Total: ${tasks.length} | Running: ${running.length} | Completed: ${completed.length} | Failed: ${failed.length}`));
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Generate unique task ID
   */
  private generateId(): string {
    this.taskCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.taskCounter.toString(36).padStart(4, "0");
    return `task_${timestamp}_${counter}`;
  }

  /**
   * Start auto-cleanup interval
   */
  private startAutoCleanup(): void {
    // Clean up old completed tasks every 5 minutes
    this.autoCleanupInterval = setInterval(() => {
      this.cleanupCompleted();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop auto-cleanup
   */
  destroy(): void {
    if (this.autoCleanupInterval) {
      clearInterval(this.autoCleanupInterval);
      this.autoCleanupInterval = null;
    }
    this.cancelAll();
    this.removeAllListeners();
  }
}

// ============================================================================
// TOOL HISTORY
// ============================================================================

/**
 * ToolHistory - Tracks tool uses during a turn with collapse support
 *
 * Shows condensed view by default with "+N more tool uses (ctrl+o to expand)"
 * and supports ctrl+o to toggle verbose mode.
 */
export class ToolHistory extends EventEmitter {
  private toolUses: ToolUse[] = [];
  private maxVisibleCollapsed: number = 3;
  private _verbose: boolean = false;
  private turnId: string = "";
  private idCounter: number = 0;

  /**
   * Start a new turn, clearing previous history
   */
  startTurn(): void {
    this.toolUses = [];
    this.turnId = Date.now().toString(36);
    this.idCounter = 0;
    this.emit("turnStart", this.turnId);
  }

  /**
   * Record a tool use starting
   */
  startToolUse(name: string, args: Record<string, unknown>): string {
    const id = `${this.turnId}_${++this.idCounter}`;
    const use: ToolUse = {
      id,
      name,
      args,
      startTime: Date.now(),
    };
    this.toolUses.push(use);
    this.emit("toolStart", use);
    return id;
  }

  /**
   * Record a tool use completion
   */
  endToolUse(id: string, result: string, isError: boolean = false): void {
    const use = this.toolUses.find((t) => t.id === id);
    if (use) {
      use.endTime = Date.now();
      use.result = result;
      use.isError = isError;
      use.truncated = result.length > 500;
      this.emit("toolEnd", use);
    }
  }

  /**
   * Get all tool uses for current turn
   */
  getToolUses(): ToolUse[] {
    return [...this.toolUses];
  }

  /**
   * Get count of tool uses
   */
  get count(): number {
    return this.toolUses.length;
  }

  /**
   * Check if there are hidden tool uses in collapsed mode
   */
  get hasHidden(): boolean {
    return !this._verbose && this.toolUses.length > this.maxVisibleCollapsed;
  }

  /**
   * Get number of hidden tool uses
   */
  get hiddenCount(): number {
    if (this._verbose) return 0;
    return Math.max(0, this.toolUses.length - this.maxVisibleCollapsed);
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this._verbose = verbose;
    this.emit("verboseChanged", verbose);
  }

  /**
   * Get verbose mode
   */
  isVerbose(): boolean {
    return this._verbose;
  }

  /**
   * Toggle verbose mode
   */
  toggleVerbose(): boolean {
    this._verbose = !this._verbose;
    this.emit("verboseChanged", this._verbose);
    return this._verbose;
  }

  /**
   * Format a single tool use
   */
  formatToolUse(use: ToolUse): string {
    const duration = use.endTime
      ? `${use.endTime - use.startTime}ms`
      : "running";

    const icon = use.isError
      ? colors.error("\u2717")
      : use.endTime
        ? colors.success("\u2713")
        : colors.accent("\u25CF");

    let line = `  ${icon} ${colors.primary(use.name)}`;

    // Add abbreviated args
    const argStr = this.formatArgs(use.args);
    if (argStr) {
      line += colors.dim(` ${argStr}`);
    }

    line += colors.dim(` [${duration}]`);

    return line;
  }

  /**
   * Format tool arguments for display
   */
  private formatArgs(args: Record<string, unknown>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) continue;

      let valueStr: string;
      if (typeof value === "string") {
        // Truncate long strings
        valueStr = value.length > 30
          ? `"${value.slice(0, 27)}..."`
          : `"${value}"`;
      } else if (typeof value === "object") {
        valueStr = "[...]";
      } else {
        valueStr = String(value);
      }

      parts.push(`${key}=${valueStr}`);
    }

    const result = parts.join(" ");
    return result.length > 60 ? result.slice(0, 57) + "..." : result;
  }

  /**
   * Format the tool history display
   */
  format(): string {
    if (this.toolUses.length === 0) {
      return "";
    }

    const lines: string[] = [];
    const visible = this._verbose
      ? this.toolUses
      : this.toolUses.slice(0, this.maxVisibleCollapsed);

    for (const use of visible) {
      lines.push(this.formatToolUse(use));
    }

    // Show collapse hint
    if (this.hasHidden) {
      const icon = SYMBOLS.collapsed;
      lines.push(
        `  ${icon} ${colors.dim(`+${this.hiddenCount} more tool uses`)} ${colors.muted("(ctrl+o to expand)")}`
      );
    } else if (this._verbose && this.toolUses.length > this.maxVisibleCollapsed) {
      const icon = SYMBOLS.expanded;
      lines.push(
        `  ${icon} ${colors.muted("(ctrl+o to collapse)")}`
      );
    }

    return lines.join("\n");
  }

  /**
   * Format with background hint
   */
  formatWithHints(isLongOperation: boolean = false): string {
    const base = this.format();

    if (isLongOperation && this.toolUses.length > 0) {
      const hint = colors.muted("  (ctrl+b to run in background)");
      return base ? `${base}\n${hint}` : hint;
    }

    return base;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.toolUses = [];
    this.emit("cleared");
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/**
 * Global TaskManager singleton
 */
export const taskManager = new TaskManager();

/**
 * Global ToolHistory singleton
 */
export const toolHistory = new ToolHistory();

// ============================================================================
// KEYBOARD INTEGRATION HELPERS
// ============================================================================

/**
 * Handle ctrl+b to background current operation
 * Returns a function that can wrap an async operation
 */
export function createBackgroundableOperation<T>(
  name: string,
  operation: () => Promise<T>,
  options?: {
    description?: string;
    onBackground?: (task: BackgroundTask) => void;
  }
): {
  start: () => Promise<T>;
  background: () => BackgroundTask;
  isBackgrounded: () => boolean;
} {
  let backgrounded = false;
  let task: BackgroundTask | null = null;

  return {
    start: async () => {
      if (backgrounded && task) {
        // Wait for background task to complete
        return new Promise((resolve, reject) => {
          task!.on("complete", (result) => resolve(result as T));
          task!.on("error", reject);
        });
      }
      return operation();
    },

    background: () => {
      if (backgrounded && task) return task;

      backgrounded = true;
      task = taskManager.backgroundOperation(
        name,
        async () => {
          const result = await operation();
          return String(result);
        },
        options?.description
      );

      options?.onBackground?.(task);
      return task;
    },

    isBackgrounded: () => backgrounded,
  };
}

/**
 * Handle ctrl+o toggle for verbose mode
 */
export function toggleVerboseMode(): { tasks: boolean; tools: boolean } {
  const tasksVerbose = taskManager.toggleVerbose();
  const toolsVerbose = toolHistory.toggleVerbose();

  return {
    tasks: tasksVerbose,
    tools: toolsVerbose,
  };
}

/**
 * Format keyboard hints for display
 */
export function formatKeyboardHints(
  options: {
    showBackground?: boolean;
    showVerbose?: boolean;
    isVerbose?: boolean;
  } = {}
): string {
  const hints: string[] = [];

  if (options.showBackground) {
    hints.push(colors.muted("ctrl+b: background"));
  }

  if (options.showVerbose) {
    const verboseHint = options.isVerbose ? "collapse" : "expand";
    hints.push(colors.muted(`ctrl+o: ${verboseHint}`));
  }

  return hints.length > 0 ? `  ${hints.join(" | ")}` : "";
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as taskColors,
  SYMBOLS as taskSymbols,
};
