/**
 * Background Tasks UI
 *
 * UI for managing background tasks with ctrl+b to background,
 * status indicators, and desktop notifications.
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface BackgroundTaskUI {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  result?: string;
  error?: string;
}

export interface BackgroundUIConfig {
  /** Show status in prompt */
  showInPrompt?: boolean;
  /** Send desktop notifications */
  enableNotifications?: boolean;
  /** Auto-show result when task completes */
  autoShowResult?: boolean;
  /** Maximum tasks to show in status bar */
  maxVisibleTasks?: number;
}

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  running: chalk.hex("#87CEEB"),    // Blue
  completed: chalk.hex("#7CB342"),  // Green
  failed: chalk.hex("#E57373"),     // Red
  cancelled: chalk.hex("#888888"),  // Gray
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
  warning: chalk.hex("#DAA520"),
};

// ============================================================================
// BACKGROUND TASK UI MANAGER
// ============================================================================

export class BackgroundUIManager extends EventEmitter {
  private tasks: Map<string, BackgroundTaskUI> = new Map();
  private config: Required<BackgroundUIConfig>;
  private taskIdCounter = 0;

  constructor(config: BackgroundUIConfig = {}) {
    super();
    this.config = {
      showInPrompt: config.showInPrompt ?? true,
      enableNotifications: config.enableNotifications ?? true,
      autoShowResult: config.autoShowResult ?? false,
      maxVisibleTasks: config.maxVisibleTasks ?? 3,
    };
  }

  /**
   * Create a new background task
   */
  createTask(name: string, description?: string): BackgroundTaskUI {
    const id = `bg_${++this.taskIdCounter}_${Date.now()}`;
    const task: BackgroundTaskUI = {
      id,
      name,
      description: description || name,
      startTime: Date.now(),
      status: "running",
    };

    this.tasks.set(id, task);
    this.emit("taskCreated", task);

    return task;
  }

  /**
   * Update task progress
   */
  updateProgress(id: string, progress: number): void {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      this.emit("taskProgress", task);
    }
  }

  /**
   * Mark task as completed
   */
  completeTask(id: string, result?: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = "completed";
      task.endTime = Date.now();
      task.result = result;
      this.emit("taskCompleted", task);

      if (this.config.enableNotifications) {
        this.sendNotification(task);
      }
    }
  }

  /**
   * Mark task as failed
   */
  failTask(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = "failed";
      task.endTime = Date.now();
      task.error = error;
      this.emit("taskFailed", task);

      if (this.config.enableNotifications) {
        this.sendNotification(task);
      }
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === "running") {
      task.status = "cancelled";
      task.endTime = Date.now();
      this.emit("taskCancelled", task);
    }
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): BackgroundTaskUI | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTaskUI[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): BackgroundTaskUI[] {
    return this.getAllTasks().filter(t => t.status === "running");
  }

  /**
   * Get recent completed tasks
   */
  getRecentCompleted(count: number = 5): BackgroundTaskUI[] {
    return this.getAllTasks()
      .filter(t => t.status !== "running")
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      .slice(0, count);
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): number {
    let cleared = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== "running") {
        this.tasks.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Send desktop notification
   */
  private sendNotification(task: BackgroundTaskUI): void {
    const title = task.status === "completed"
      ? `✓ ${task.name} completed`
      : `✗ ${task.name} failed`;

    const message = task.status === "completed"
      ? task.result?.slice(0, 100) || "Task finished successfully"
      : task.error?.slice(0, 100) || "Task failed";

    // Platform-specific notification
    if (process.platform === "darwin") {
      // macOS
      exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
    } else if (process.platform === "linux") {
      // Linux (requires notify-send)
      exec(`notify-send "${title}" "${message}"`);
    } else if (process.platform === "win32") {
      // Windows (PowerShell)
      exec(`powershell -Command "New-BurntToastNotification -Text '${title}', '${message}'"`);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackgroundUIConfig>): void {
    Object.assign(this.config, config);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let backgroundUIInstance: BackgroundUIManager | null = null;

export function getBackgroundUI(config?: BackgroundUIConfig): BackgroundUIManager {
  if (!backgroundUIInstance) {
    backgroundUIInstance = new BackgroundUIManager(config);
  }
  return backgroundUIInstance;
}

export function resetBackgroundUI(): void {
  backgroundUIInstance = null;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format status indicator for prompt
 */
export function formatBackgroundIndicator(tasks: BackgroundTaskUI[]): string {
  const running = tasks.filter(t => t.status === "running");

  if (running.length === 0) {
    return "";
  }

  const indicators = running.slice(0, 3).map(t => {
    const elapsed = formatElapsed(Date.now() - t.startTime);
    if (t.progress !== undefined) {
      return colors.running(`⟳ ${t.name} ${t.progress}%`);
    }
    return colors.running(`⟳ ${t.name} ${elapsed}`);
  });

  if (running.length > 3) {
    indicators.push(colors.dim(`+${running.length - 3} more`));
  }

  return indicators.join(" · ");
}

/**
 * Format task list
 */
export function formatTaskList(tasks: BackgroundTaskUI[]): string {
  if (tasks.length === 0) {
    return colors.dim("  No background tasks");
  }

  const lines: string[] = [colors.accent("  Background Tasks"), ""];

  for (const task of tasks) {
    const icon = getStatusIcon(task.status);
    const duration = formatElapsed((task.endTime || Date.now()) - task.startTime);
    const progress = task.progress !== undefined ? ` ${task.progress}%` : "";

    lines.push(`  ${icon} ${task.name}${progress} ${colors.dim(`(${duration})`)}`);

    if (task.status === "failed" && task.error) {
      lines.push(colors.failed(`      ${task.error.slice(0, 60)}`));
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format single task status
 */
export function formatTaskStatus(task: BackgroundTaskUI): string {
  const icon = getStatusIcon(task.status);
  const duration = formatElapsed((task.endTime || Date.now()) - task.startTime);

  let status = `${icon} ${task.name}`;

  if (task.status === "running") {
    if (task.progress !== undefined) {
      status += ` ${formatProgressBar(task.progress)} ${task.progress}%`;
    } else {
      status += ` ${colors.running("running")}`;
    }
  } else if (task.status === "completed") {
    status += ` ${colors.completed("completed")}`;
  } else if (task.status === "failed") {
    status += ` ${colors.failed("failed")}`;
  } else {
    status += ` ${colors.cancelled("cancelled")}`;
  }

  status += colors.dim(` (${duration})`);

  return status;
}

/**
 * Format completion notification
 */
export function formatTaskCompletion(task: BackgroundTaskUI): string {
  const duration = formatElapsed((task.endTime || Date.now()) - task.startTime);

  if (task.status === "completed") {
    return [
      "",
      colors.completed(`  ✓ Background task completed: ${task.name}`),
      colors.dim(`    Duration: ${duration}`),
      task.result ? colors.dim(`    ${task.result.slice(0, 80)}`) : "",
      "",
    ].filter(Boolean).join("\n");
  } else {
    return [
      "",
      colors.failed(`  ✗ Background task failed: ${task.name}`),
      colors.dim(`    Duration: ${duration}`),
      task.error ? colors.failed(`    ${task.error.slice(0, 80)}`) : "",
      "",
    ].filter(Boolean).join("\n");
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusIcon(status: BackgroundTaskUI["status"]): string {
  switch (status) {
    case "running":
      return colors.running("⟳");
    case "completed":
      return colors.completed("✓");
    case "failed":
      return colors.failed("✗");
    case "cancelled":
      return colors.cancelled("○");
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function formatProgressBar(progress: number, width: number = 15): string {
  const filled = Math.round((progress / 100) * width);
  return colors.running("█".repeat(filled)) + colors.dim("░".repeat(width - filled));
}

// ============================================================================
// KEYBOARD HANDLING
// ============================================================================

/**
 * Check if key is ctrl+b (background shortcut)
 */
export function isBackgroundKey(key: { ctrl?: boolean; name?: string }): boolean {
  return !!key.ctrl && key.name === "b";
}

/**
 * Format background mode hint
 */
export function formatBackgroundHint(): string {
  return colors.dim("ctrl+b to background this task");
}
