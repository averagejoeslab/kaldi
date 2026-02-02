/**
 * Background Tasks Manager
 *
 * Manages background tasks with dog-themed display.
 */

import { c } from "../theme/colors.js";
import { dogFace } from "../theme/dog-messages.js";

export type TaskStatus = "running" | "thinking" | "completed" | "failed" | "waiting";

export interface BackgroundTask {
  id: string;
  description: string;
  status: TaskStatus;
  startTime: number;
  endTime?: number;
  output?: string;
  error?: string;
}

/**
 * Background Task Manager
 */
export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private listeners: Array<() => void> = [];
  private idCounter = 0;

  /**
   * Generate a short task ID
   */
  private generateId(): string {
    this.idCounter++;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 4; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * Create a new background task
   */
  createTask(description: string): BackgroundTask {
    const id = this.generateId();
    const task: BackgroundTask = {
      id,
      description,
      status: "running",
      startTime: Date.now(),
    };
    this.tasks.set(id, task);
    this.notifyListeners();
    return task;
  }

  /**
   * Update task status
   */
  updateTask(
    id: string,
    updates: Partial<Pick<BackgroundTask, "status" | "output" | "error">>
  ): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      if (updates.status === "completed" || updates.status === "failed") {
        task.endTime = Date.now();
      }
      this.notifyListeners();
    }
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
    return this.getAllTasks().filter(
      (t) => t.status === "running" || t.status === "thinking" || t.status === "waiting"
    );
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): BackgroundTask[] {
    return this.getAllTasks().filter(
      (t) => t.status === "completed" || t.status === "failed"
    );
  }

  /**
   * Remove a task
   */
  removeTask(id: string): void {
    this.tasks.delete(id);
    this.notifyListeners();
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === "completed" || task.status === "failed") {
        this.tasks.delete(id);
      }
    }
    this.notifyListeners();
  }

  /**
   * Get task count by status
   */
  getTaskCounts(): { running: number; completed: number; failed: number } {
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const task of this.tasks.values()) {
      if (task.status === "running" || task.status === "thinking" || task.status === "waiting") {
        running++;
      } else if (task.status === "completed") {
        completed++;
      } else if (task.status === "failed") {
        failed++;
      }
    }

    return { running, completed, failed };
  }

  /**
   * Subscribe to task changes
   */
  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Format task status icon
   */
  formatStatusIcon(status: TaskStatus): string {
    switch (status) {
      case "running":
        return c.honey("●");
      case "thinking":
        return c.honey("◐");
      case "waiting":
        return c.dim("◷");
      case "completed":
        return c.success("✓");
      case "failed":
        return c.error("✗");
      default:
        return "○";
    }
  }

  /**
   * Format task duration
   */
  formatDuration(task: BackgroundTask): string {
    const endTime = task.endTime || Date.now();
    const duration = endTime - task.startTime;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;

    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Format a single task line
   */
  formatTask(task: BackgroundTask): string {
    const icon = this.formatStatusIcon(task.status);
    const duration = this.formatDuration(task);

    let statusText = "";
    switch (task.status) {
      case "running":
        statusText = c.honey(`☕ Running... (${duration})`);
        break;
      case "thinking":
        statusText = c.honey(`☕ Brewing... (${duration})`);
        break;
      case "waiting":
        statusText = c.dim(`Waiting...`);
        break;
      case "completed":
        statusText = c.success(`✓ Done (${duration})`);
        break;
      case "failed":
        statusText = c.error(`✗ Failed`);
        break;
    }

    return `${icon} #${task.id}  ${task.description.slice(0, 30).padEnd(30)} ${statusText}`;
  }

  /**
   * Format task list panel
   */
  formatTaskPanel(): string {
    const tasks = this.getAllTasks();

    if (tasks.length === 0) {
      return "";
    }

    const lines: string[] = [];
    lines.push(c.cream("╭─ 🐕 Background Tasks ─────────────────────────────────────────╮"));
    lines.push(c.cream("│") + " ".repeat(63) + c.cream("│"));

    for (const task of tasks.slice(0, 5)) {
      const taskLine = this.formatTask(task);
      const padding = 63 - this.stripAnsi(taskLine).length;
      lines.push(c.cream("│") + "  " + taskLine + " ".repeat(Math.max(0, padding - 2)) + c.cream("│"));
    }

    if (tasks.length > 5) {
      const more = `  ... +${tasks.length - 5} more tasks`;
      lines.push(c.cream("│") + c.dim(more) + " ".repeat(63 - more.length) + c.cream("│"));
    }

    lines.push(c.cream("│") + " ".repeat(63) + c.cream("│"));
    lines.push(c.cream("│") + c.dim("  ↑/↓ navigate · Enter view · D dismiss · Ctrl+T hide") + " ".repeat(8) + c.cream("│"));
    lines.push(c.cream("╰─────────────────────────────────────────────────────────────────╯"));

    return lines.join("\n");
  }

  /**
   * Strip ANSI codes for length calculation
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }
}

// Singleton instance
let taskManager: BackgroundTaskManager | null = null;

export function getBackgroundTaskManager(): BackgroundTaskManager {
  if (!taskManager) {
    taskManager = new BackgroundTaskManager();
  }
  return taskManager;
}
