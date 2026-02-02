/**
 * Planning Types
 *
 * Type definitions for the planning system.
 */

/**
 * Plan status
 */
export type PlanStatus = "draft" | "pending" | "approved" | "rejected" | "executing" | "completed" | "failed";

/**
 * Plan step status
 */
export type StepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

/**
 * A single step in a plan
 */
export interface PlanStep {
  /** Step ID */
  id: string;
  /** Step description */
  description: string;
  /** Current status */
  status: StepStatus;
  /** Tool calls to execute */
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
  }>;
  /** Dependencies (step IDs that must complete first) */
  dependencies?: string[];
  /** Result from execution */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** Estimated complexity (1-5) */
  complexity?: number;
}

/**
 * A complete plan
 */
export interface Plan {
  /** Plan ID */
  id: string;
  /** Plan title */
  title: string;
  /** Plan description */
  description: string;
  /** Current status */
  status: PlanStatus;
  /** Plan steps */
  steps: PlanStep[];
  /** Files that will be modified */
  affectedFiles?: string[];
  /** User who created the plan */
  createdBy?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Approval timestamp */
  approvedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
}

/**
 * Plan creation options
 */
export interface CreatePlanOptions {
  /** Plan title */
  title: string;
  /** Plan description */
  description: string;
  /** Initial steps */
  steps?: Omit<PlanStep, "id" | "status">[];
  /** Files that will be affected */
  affectedFiles?: string[];
}

/**
 * Plan execution result
 */
export interface PlanExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Completed steps */
  completedSteps: string[];
  /** Failed steps */
  failedSteps: string[];
  /** Error message if failed */
  error?: string;
}
