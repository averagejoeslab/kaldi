/**
 * Subagent Types
 *
 * Type definitions for subagent system.
 */

/**
 * Subagent status
 */
export type SubagentStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Subagent configuration
 */
export interface SubagentConfig {
  /** Subagent type */
  type: "explore" | "research" | "implement" | "test" | "review";
  /** Task description */
  task: string;
  /** Maximum turns */
  maxTurns?: number;
  /** Model to use (optional override) */
  model?: string;
  /** Working directory */
  cwd?: string;
  /** Run in background */
  background?: boolean;
}

/**
 * Subagent result
 */
export interface SubagentResult {
  /** Subagent ID */
  id: string;
  /** Final status */
  status: SubagentStatus;
  /** Result output */
  output?: string;
  /** Files modified */
  filesModified?: string[];
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  duration?: number;
}

/**
 * Background task
 */
export interface BackgroundTask {
  /** Task ID */
  id: string;
  /** Task description */
  description: string;
  /** Current status */
  status: SubagentStatus;
  /** Progress (0-100) */
  progress?: number;
  /** Started timestamp */
  startedAt: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Result when complete */
  result?: SubagentResult;
}
