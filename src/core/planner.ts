/**
 * Planning Mode System for Kaldi CLI
 *
 * Provides intelligent planning mode that:
 * - Auto-detects when a task needs planning
 * - Manages mode transitions (plan → execute → done)
 * - Tracks plan progress and status
 */

import chalk from "chalk";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Agent operation modes
 */
export type AgentMode = "chat" | "plan" | "execute" | "review";

/**
 * Planning triggers - what causes auto-plan mode
 */
export type PlanTrigger =
  | "complex_task"
  | "multi_file"
  | "architecture"
  | "new_feature"
  | "refactor"
  | "user_request"
  | "ambiguous";

/**
 * Plan step status
 */
export type StepStatus = "pending" | "active" | "completed" | "skipped" | "failed";

/**
 * A single step in the plan
 */
export interface PlanStep {
  id: string;
  description: string;
  status: StepStatus;
  substeps?: PlanStep[];
  files?: string[];
  estimatedComplexity?: "low" | "medium" | "high";
  notes?: string;
}

/**
 * The full plan
 */
export interface Plan {
  id: string;
  title: string;
  summary: string;
  trigger: PlanTrigger;
  steps: PlanStep[];
  createdAt: Date;
  updatedAt: Date;
  status: "draft" | "approved" | "in_progress" | "completed" | "cancelled";
  metadata?: Record<string, unknown>;
}

/**
 * Planning configuration
 */
export interface PlannerConfig {
  /** Auto-detect when planning is needed */
  autoDetect: boolean;
  /** Complexity threshold for auto-planning */
  complexityThreshold: "low" | "medium" | "high";
  /** Require user approval before executing plan */
  requireApproval: boolean;
  /** Max steps before suggesting split */
  maxStepsBeforeSplit: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const colors = {
  primary: chalk.hex("#C9A66B"),
  secondary: chalk.hex("#DAA520"),
  success: chalk.hex("#7CB342"),
  warning: chalk.hex("#FFB74D"),
  error: chalk.hex("#E57373"),
  info: chalk.hex("#64B5F6"),
  dim: chalk.hex("#A09080"),
  text: chalk.hex("#F5F0E6"),
  muted: chalk.hex("#6B5B4F"),
};

const MODE_ICONS: Record<AgentMode, string> = {
  chat: "💬",
  plan: "📋",
  execute: "⚡",
  review: "👀",
};

const STATUS_ICONS: Record<StepStatus, string> = {
  pending: "○",
  active: "●",
  completed: "✓",
  skipped: "⊘",
  failed: "✗",
};

/**
 * Patterns that suggest planning is needed
 */
const PLANNING_PATTERNS = [
  // Multi-step requests
  /\b(implement|create|build|develop|add)\s+(a\s+)?(new\s+)?(feature|system|module|component)/i,
  /\b(refactor|restructure|reorganize|redesign)\b/i,
  /\b(multiple|several|many)\s+(files?|changes?|steps?)/i,

  // Architecture keywords
  /\b(architecture|design|structure|pattern)/i,
  /\b(database|schema|migration|api)\s+(design|structure)/i,

  // Complexity indicators
  /\b(complex|complicated|intricate|elaborate)/i,
  /\b(strategy|approach|plan)\s+(for|to)/i,
  /\bhow\s+(should|would|can)\s+(we|i)\s+(approach|implement|design)/i,

  // Explicit planning requests
  /\b(plan|outline|design|architect)\s+(how|the|a)/i,
  /\bstep[- ]?by[- ]?step/i,
  /\bbreak\s+(it\s+)?down/i,
];

/**
 * Patterns that suggest immediate execution
 */
const IMMEDIATE_PATTERNS = [
  /\b(fix|bug|error|typo|quick)\b/i,
  /\b(just|simply|only)\s+(add|change|update|fix)/i,
  /\b(show|display|print|log)\b/i,
  /\b(explain|what\s+is|how\s+does)\b/i,
];

// ============================================================================
// PLANNER CLASS
// ============================================================================

/**
 * Planner - Manages planning mode and plan execution
 */
export class Planner extends EventEmitter {
  private _mode: AgentMode = "chat";
  private _currentPlan: Plan | null = null;
  private _planHistory: Plan[] = [];
  private config: PlannerConfig;
  private stepCounter = 0;

  constructor(config: Partial<PlannerConfig> = {}) {
    super();
    this.config = {
      autoDetect: true,
      complexityThreshold: "medium",
      requireApproval: true,
      maxStepsBeforeSplit: 10,
      ...config,
    };
  }

  // ==========================================================================
  // MODE MANAGEMENT
  // ==========================================================================

  /**
   * Get current mode
   */
  get mode(): AgentMode {
    return this._mode;
  }

  /**
   * Set mode and emit event
   */
  setMode(mode: AgentMode): void {
    const previousMode = this._mode;
    this._mode = mode;
    this.emit("modeChange", { from: previousMode, to: mode });
  }

  /**
   * Cycle to next mode
   */
  cycleMode(): AgentMode {
    const modes: AgentMode[] = ["chat", "plan", "execute", "review"];
    const currentIndex = modes.indexOf(this._mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
    return this._mode;
  }

  /**
   * Check if planning mode is active
   */
  isPlanning(): boolean {
    return this._mode === "plan";
  }

  /**
   * Check if executing a plan
   */
  isExecuting(): boolean {
    return this._mode === "execute" && this._currentPlan?.status === "in_progress";
  }

  // ==========================================================================
  // PLAN DETECTION
  // ==========================================================================

  /**
   * Analyze a user request to determine if planning is needed
   */
  shouldPlan(userInput: string): { shouldPlan: boolean; trigger?: PlanTrigger; confidence: number } {
    if (!this.config.autoDetect) {
      return { shouldPlan: false, confidence: 0 };
    }

    // Check for immediate execution patterns first
    for (const pattern of IMMEDIATE_PATTERNS) {
      if (pattern.test(userInput)) {
        return { shouldPlan: false, confidence: 0.8 };
      }
    }

    // Check for planning patterns
    let matchCount = 0;
    let trigger: PlanTrigger = "complex_task";

    for (const pattern of PLANNING_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;

        // Determine trigger type
        if (/refactor|restructure/i.test(userInput)) {
          trigger = "refactor";
        } else if (/feature|implement/i.test(userInput)) {
          trigger = "new_feature";
        } else if (/architecture|design/i.test(userInput)) {
          trigger = "architecture";
        } else if (/multiple|several/i.test(userInput)) {
          trigger = "multi_file";
        } else if (/plan|outline/i.test(userInput)) {
          trigger = "user_request";
        }
      }
    }

    const confidence = Math.min(matchCount / 3, 1);
    const thresholds = { low: 0.3, medium: 0.5, high: 0.7 };
    const threshold = thresholds[this.config.complexityThreshold];

    return {
      shouldPlan: confidence >= threshold,
      trigger: confidence >= threshold ? trigger : undefined,
      confidence,
    };
  }

  /**
   * Auto-enter planning mode if needed
   */
  autoEnterPlanMode(userInput: string): boolean {
    const { shouldPlan, trigger } = this.shouldPlan(userInput);

    if (shouldPlan && this._mode === "chat") {
      this.setMode("plan");
      this.emit("autoPlanTriggered", { trigger, input: userInput });
      return true;
    }

    return false;
  }

  // ==========================================================================
  // PLAN MANAGEMENT
  // ==========================================================================

  /**
   * Get current plan
   */
  get currentPlan(): Plan | null {
    return this._currentPlan;
  }

  /**
   * Create a new plan
   */
  createPlan(title: string, summary: string, trigger: PlanTrigger = "user_request"): Plan {
    const plan: Plan = {
      id: `plan_${Date.now()}`,
      title,
      summary,
      trigger,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
    };

    this._currentPlan = plan;
    this.setMode("plan");
    this.emit("planCreated", plan);

    return plan;
  }

  /**
   * Add a step to the current plan
   */
  addStep(description: string, options: Partial<PlanStep> = {}): PlanStep | null {
    if (!this._currentPlan) return null;

    const step: PlanStep = {
      id: `step_${++this.stepCounter}`,
      description,
      status: "pending",
      ...options,
    };

    this._currentPlan.steps.push(step);
    this._currentPlan.updatedAt = new Date();
    this.emit("stepAdded", { plan: this._currentPlan, step });

    return step;
  }

  /**
   * Update a step's status
   */
  updateStepStatus(stepId: string, status: StepStatus, notes?: string): boolean {
    if (!this._currentPlan) return false;

    const step = this.findStep(stepId);
    if (!step) return false;

    step.status = status;
    if (notes) step.notes = notes;
    this._currentPlan.updatedAt = new Date();

    this.emit("stepUpdated", { plan: this._currentPlan, step });

    // Check if all steps are done
    if (this.areAllStepsComplete()) {
      this._currentPlan.status = "completed";
      this.emit("planCompleted", this._currentPlan);
    }

    return true;
  }

  /**
   * Find a step by ID
   */
  private findStep(stepId: string, steps?: PlanStep[]): PlanStep | null {
    const searchSteps = steps || this._currentPlan?.steps || [];

    for (const step of searchSteps) {
      if (step.id === stepId) return step;
      if (step.substeps) {
        const found = this.findStep(stepId, step.substeps);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Check if all steps are complete
   */
  private areAllStepsComplete(): boolean {
    if (!this._currentPlan) return false;

    const checkSteps = (steps: PlanStep[]): boolean => {
      return steps.every((step) => {
        if (step.substeps && step.substeps.length > 0) {
          return checkSteps(step.substeps);
        }
        return step.status === "completed" || step.status === "skipped";
      });
    };

    return checkSteps(this._currentPlan.steps);
  }

  /**
   * Approve the plan and start execution
   */
  approvePlan(): boolean {
    if (!this._currentPlan || this._currentPlan.status !== "draft") {
      return false;
    }

    this._currentPlan.status = "approved";
    this._currentPlan.updatedAt = new Date();
    this.emit("planApproved", this._currentPlan);

    return true;
  }

  /**
   * Start executing the plan
   */
  startExecution(): boolean {
    if (!this._currentPlan || this._currentPlan.status !== "approved") {
      return false;
    }

    this._currentPlan.status = "in_progress";
    this._currentPlan.updatedAt = new Date();
    this.setMode("execute");
    this.emit("executionStarted", this._currentPlan);

    // Mark first step as active
    if (this._currentPlan.steps.length > 0) {
      this._currentPlan.steps[0].status = "active";
    }

    return true;
  }

  /**
   * Cancel the current plan
   */
  cancelPlan(): boolean {
    if (!this._currentPlan) return false;

    this._currentPlan.status = "cancelled";
    this._currentPlan.updatedAt = new Date();
    this._planHistory.push(this._currentPlan);

    this.emit("planCancelled", this._currentPlan);
    this._currentPlan = null;
    this.setMode("chat");

    return true;
  }

  /**
   * Complete the current plan
   */
  completePlan(): boolean {
    if (!this._currentPlan) return false;

    this._currentPlan.status = "completed";
    this._currentPlan.updatedAt = new Date();
    this._planHistory.push(this._currentPlan);

    this.emit("planCompleted", this._currentPlan);
    this._currentPlan = null;
    this.setMode("chat");

    return true;
  }

  /**
   * Get the next pending step
   */
  getNextStep(): PlanStep | null {
    if (!this._currentPlan) return null;

    const findNextPending = (steps: PlanStep[]): PlanStep | null => {
      for (const step of steps) {
        if (step.status === "pending") return step;
        if (step.substeps) {
          const found = findNextPending(step.substeps);
          if (found) return found;
        }
      }
      return null;
    };

    return findNextPending(this._currentPlan.steps);
  }

  // ==========================================================================
  // FORMATTING
  // ==========================================================================

  /**
   * Format the current mode indicator
   */
  formatModeIndicator(): string {
    const icon = MODE_ICONS[this._mode];
    const modeNames: Record<AgentMode, string> = {
      chat: "Chat",
      plan: "Planning",
      execute: "Executing",
      review: "Reviewing",
    };
    return `${icon} ${colors.primary(modeNames[this._mode])}`;
  }

  /**
   * Format the current plan for display
   */
  formatPlan(verbose: boolean = false): string {
    if (!this._currentPlan) {
      return colors.dim("No active plan");
    }

    const lines: string[] = [];
    const plan = this._currentPlan;

    // Header
    lines.push(colors.primary.bold(`📋 ${plan.title}`));
    lines.push(colors.dim(`Status: ${plan.status} | ${plan.steps.length} steps`));
    lines.push("");

    // Summary
    if (verbose && plan.summary) {
      lines.push(colors.text(plan.summary));
      lines.push("");
    }

    // Steps
    lines.push(colors.secondary("Steps:"));
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const isLast = i === plan.steps.length - 1;
      lines.push(this.formatStep(step, isLast, 0, verbose));
    }

    return lines.join("\n");
  }

  /**
   * Format a single step
   */
  private formatStep(
    step: PlanStep,
    isLast: boolean,
    depth: number,
    verbose: boolean
  ): string {
    const indent = "  ".repeat(depth);
    const prefix = isLast ? "└" : "├";
    const statusIcon = this.getStatusIcon(step.status);
    const statusColor = this.getStatusColor(step.status);

    let line = `${indent}${colors.dim(prefix)} ${statusColor(statusIcon)} ${colors.text(step.description)}`;

    // Add file count if present
    if (step.files && step.files.length > 0) {
      line += colors.dim(` (${step.files.length} files)`);
    }

    // Add notes if verbose
    if (verbose && step.notes) {
      line += `\n${indent}  ${colors.dim(step.notes)}`;
    }

    // Format substeps
    if (step.substeps && step.substeps.length > 0) {
      const substepLines = step.substeps.map((substep, i) =>
        this.formatStep(substep, i === step.substeps!.length - 1, depth + 1, verbose)
      );
      line += "\n" + substepLines.join("\n");
    }

    return line;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: StepStatus): string {
    return STATUS_ICONS[status];
  }

  /**
   * Get status color
   */
  private getStatusColor(status: StepStatus): (text: string) => string {
    switch (status) {
      case "completed":
        return colors.success;
      case "active":
        return colors.secondary;
      case "failed":
        return colors.error;
      case "skipped":
        return colors.dim;
      default:
        return colors.dim;
    }
  }

  /**
   * Format plan progress
   */
  formatProgress(): string {
    if (!this._currentPlan) return "";

    const total = this._currentPlan.steps.length;
    const completed = this._currentPlan.steps.filter(
      (s) => s.status === "completed" || s.status === "skipped"
    ).length;

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const barWidth = 20;
    const filledWidth = Math.round((percent / 100) * barWidth);
    const bar = "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);

    return `${colors.dim("Progress:")} ${colors.primary(bar)} ${colors.text(`${percent}%`)} (${completed}/${total})`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _planner: Planner | null = null;

/**
 * Get the planner singleton
 */
export function getPlanner(config?: Partial<PlannerConfig>): Planner {
  if (!_planner) {
    _planner = new Planner(config);
  }
  return _planner;
}

/**
 * Reset the planner singleton
 */
export function resetPlanner(): void {
  _planner = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as plannerColors,
  MODE_ICONS,
  STATUS_ICONS,
  PLANNING_PATTERNS,
  IMMEDIATE_PATTERNS,
};
