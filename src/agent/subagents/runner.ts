/**
 * Subagent Runner
 *
 * Runs subagents for specialized tasks.
 */

import { randomUUID } from "crypto";
import type {
  SubagentConfig,
  SubagentResult,
  SubagentStatus,
  BackgroundTask,
} from "./types.js";

/**
 * Subagent Runner - manages subagent execution
 */
export class SubagentRunner {
  private backgroundTasks = new Map<string, BackgroundTask>();
  private taskCallbacks = new Map<string, (result: SubagentResult) => void>();

  /**
   * Run a subagent synchronously
   */
  async run(config: SubagentConfig): Promise<SubagentResult> {
    const id = randomUUID();
    const startTime = Date.now();

    try {
      // Build system prompt based on type
      const systemPrompt = this.buildSystemPrompt(config.type);

      // In a real implementation, this would call the provider
      // For now, simulate execution
      await this.simulateExecution(config);

      return {
        id,
        status: "completed",
        output: `Completed ${config.type} task: ${config.task}`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run a subagent in the background
   */
  runBackground(
    config: SubagentConfig,
    onComplete?: (result: SubagentResult) => void
  ): string {
    const id = randomUUID();

    const task: BackgroundTask = {
      id,
      description: config.task,
      status: "pending",
      progress: 0,
      startedAt: Date.now(),
    };

    this.backgroundTasks.set(id, task);

    if (onComplete) {
      this.taskCallbacks.set(id, onComplete);
    }

    // Run in background
    this.executeBackground(id, config);

    return id;
  }

  /**
   * Get background task status
   */
  getTaskStatus(id: string): BackgroundTask | undefined {
    return this.backgroundTasks.get(id);
  }

  /**
   * Get all background tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  /**
   * Cancel a background task
   */
  cancelTask(id: string): boolean {
    const task = this.backgroundTasks.get(id);
    if (!task || task.status !== "running") {
      return false;
    }

    task.status = "cancelled";
    task.completedAt = Date.now();

    return true;
  }

  /**
   * Clear completed tasks
   */
  clearCompletedTasks(): void {
    for (const [id, task] of this.backgroundTasks) {
      if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
        this.backgroundTasks.delete(id);
        this.taskCallbacks.delete(id);
      }
    }
  }

  /**
   * Build system prompt for subagent type
   */
  private buildSystemPrompt(type: SubagentConfig["type"]): string {
    const prompts: Record<SubagentConfig["type"], string> = {
      explore: `You are an exploration subagent. Your task is to explore the codebase and gather information.
Focus on understanding the structure, patterns, and conventions used.
Report your findings clearly and concisely.`,

      research: `You are a research subagent. Your task is to research and answer questions.
Search for relevant information, read documentation, and synthesize your findings.
Provide accurate, well-sourced answers.`,

      implement: `You are an implementation subagent. Your task is to implement code changes.
Follow the project's coding conventions and best practices.
Write clean, tested, well-documented code.`,

      test: `You are a testing subagent. Your task is to test code and verify functionality.
Write comprehensive tests and check for edge cases.
Report any issues or failures clearly.`,

      review: `You are a review subagent. Your task is to review code and provide feedback.
Check for bugs, security issues, and code quality.
Provide constructive, actionable feedback.`,
    };

    return prompts[type];
  }

  /**
   * Execute a background task
   */
  private async executeBackground(id: string, config: SubagentConfig): Promise<void> {
    const task = this.backgroundTasks.get(id);
    if (!task) return;

    task.status = "running";

    try {
      const result = await this.run(config);

      task.status = result.status;
      task.completedAt = Date.now();
      task.result = result;
      task.progress = 100;

      const callback = this.taskCallbacks.get(id);
      if (callback) {
        callback(result);
      }
    } catch (error) {
      task.status = "failed";
      task.completedAt = Date.now();
      task.result = {
        id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Simulate execution (placeholder for real provider calls)
   */
  private async simulateExecution(config: SubagentConfig): Promise<void> {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Singleton instance
let runnerInstance: SubagentRunner | null = null;

/**
 * Get the subagent runner singleton
 */
export function getSubagentRunner(): SubagentRunner {
  if (!runnerInstance) {
    runnerInstance = new SubagentRunner();
  }
  return runnerInstance;
}
