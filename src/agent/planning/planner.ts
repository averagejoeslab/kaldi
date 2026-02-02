/**
 * Planner
 *
 * Creates and manages execution plans.
 */

import { randomUUID } from "crypto";
import type {
  Plan,
  PlanStep,
  PlanStatus,
  StepStatus,
  CreatePlanOptions,
  PlanExecutionResult,
} from "./types.js";

/**
 * Planner - creates and manages execution plans
 */
export class Planner {
  private currentPlan: Plan | null = null;

  /**
   * Create a new plan
   */
  createPlan(options: CreatePlanOptions): Plan {
    const now = Date.now();

    const steps: PlanStep[] = (options.steps || []).map((step, index) => ({
      id: `step-${index + 1}`,
      description: step.description,
      status: "pending" as StepStatus,
      toolCalls: step.toolCalls,
      dependencies: step.dependencies,
      complexity: step.complexity,
    }));

    this.currentPlan = {
      id: randomUUID(),
      title: options.title,
      description: options.description,
      status: "draft",
      steps,
      affectedFiles: options.affectedFiles,
      createdAt: now,
      updatedAt: now,
    };

    return this.currentPlan;
  }

  /**
   * Get current plan
   */
  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  /**
   * Clear current plan
   */
  clearPlan(): void {
    this.currentPlan = null;
  }

  /**
   * Add a step to the current plan
   */
  addStep(step: Omit<PlanStep, "id" | "status">): PlanStep | null {
    if (!this.currentPlan) return null;

    const newStep: PlanStep = {
      id: `step-${this.currentPlan.steps.length + 1}`,
      status: "pending",
      ...step,
    };

    this.currentPlan.steps.push(newStep);
    this.currentPlan.updatedAt = Date.now();

    return newStep;
  }

  /**
   * Remove a step from the current plan
   */
  removeStep(stepId: string): boolean {
    if (!this.currentPlan) return false;

    const index = this.currentPlan.steps.findIndex((s) => s.id === stepId);
    if (index === -1) return false;

    this.currentPlan.steps.splice(index, 1);
    this.currentPlan.updatedAt = Date.now();

    return true;
  }

  /**
   * Update plan status
   */
  updateStatus(status: PlanStatus): void {
    if (!this.currentPlan) return;

    this.currentPlan.status = status;
    this.currentPlan.updatedAt = Date.now();

    if (status === "approved") {
      this.currentPlan.approvedAt = Date.now();
    } else if (status === "completed") {
      this.currentPlan.completedAt = Date.now();
    }
  }

  /**
   * Update step status
   */
  updateStepStatus(stepId: string, status: StepStatus, result?: string, error?: string): void {
    if (!this.currentPlan) return;

    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (!step) return;

    step.status = status;
    if (result) step.result = result;
    if (error) step.error = error;

    this.currentPlan.updatedAt = Date.now();
  }

  /**
   * Get next executable step
   */
  getNextStep(): PlanStep | null {
    if (!this.currentPlan || this.currentPlan.status !== "executing") {
      return null;
    }

    for (const step of this.currentPlan.steps) {
      if (step.status !== "pending") continue;

      // Check dependencies
      if (step.dependencies?.length) {
        const allDepsCompleted = step.dependencies.every((depId) => {
          const depStep = this.currentPlan?.steps.find((s) => s.id === depId);
          return depStep?.status === "completed";
        });

        if (!allDepsCompleted) continue;
      }

      return step;
    }

    return null;
  }

  /**
   * Check if plan is complete
   */
  isPlanComplete(): boolean {
    if (!this.currentPlan) return false;

    return this.currentPlan.steps.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );
  }

  /**
   * Check if plan has failed
   */
  isPlanFailed(): boolean {
    if (!this.currentPlan) return false;

    return this.currentPlan.steps.some((s) => s.status === "failed");
  }

  /**
   * Get plan summary
   */
  getSummary(): string {
    if (!this.currentPlan) return "No active plan";

    const completed = this.currentPlan.steps.filter(
      (s) => s.status === "completed"
    ).length;
    const failed = this.currentPlan.steps.filter(
      (s) => s.status === "failed"
    ).length;
    const total = this.currentPlan.steps.length;

    return `Plan: ${this.currentPlan.title} (${completed}/${total} completed, ${failed} failed)`;
  }

  /**
   * Format plan for display
   */
  formatPlan(): string {
    if (!this.currentPlan) return "No active plan";

    const lines: string[] = [];
    lines.push(`Plan: ${this.currentPlan.title}`);
    lines.push(`Status: ${this.currentPlan.status}`);
    lines.push(`Description: ${this.currentPlan.description}`);
    lines.push("");
    lines.push("Steps:");

    for (const step of this.currentPlan.steps) {
      const statusIcon = {
        pending: "○",
        in_progress: "◐",
        completed: "●",
        failed: "✗",
        skipped: "○",
      }[step.status];

      lines.push(`  ${statusIcon} ${step.id}: ${step.description}`);

      if (step.dependencies?.length) {
        lines.push(`      depends on: ${step.dependencies.join(", ")}`);
      }

      if (step.error) {
        lines.push(`      error: ${step.error}`);
      }
    }

    if (this.currentPlan.affectedFiles?.length) {
      lines.push("");
      lines.push("Affected files:");
      for (const file of this.currentPlan.affectedFiles) {
        lines.push(`  - ${file}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Execute the current plan
   */
  async execute(
    executeStep: (step: PlanStep) => Promise<{ success: boolean; result?: string; error?: string }>
  ): Promise<PlanExecutionResult> {
    if (!this.currentPlan) {
      return { success: false, completedSteps: [], failedSteps: [], error: "No plan to execute" };
    }

    if (this.currentPlan.status !== "approved") {
      return { success: false, completedSteps: [], failedSteps: [], error: "Plan not approved" };
    }

    this.updateStatus("executing");

    const completedSteps: string[] = [];
    const failedSteps: string[] = [];

    let step = this.getNextStep();

    while (step) {
      this.updateStepStatus(step.id, "in_progress");

      try {
        const result = await executeStep(step);

        if (result.success) {
          this.updateStepStatus(step.id, "completed", result.result);
          completedSteps.push(step.id);
        } else {
          this.updateStepStatus(step.id, "failed", undefined, result.error);
          failedSteps.push(step.id);

          // Stop on failure
          this.updateStatus("failed");
          return {
            success: false,
            completedSteps,
            failedSteps,
            error: result.error,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.updateStepStatus(step.id, "failed", undefined, errorMessage);
        failedSteps.push(step.id);

        this.updateStatus("failed");
        return {
          success: false,
          completedSteps,
          failedSteps,
          error: errorMessage,
        };
      }

      step = this.getNextStep();
    }

    this.updateStatus("completed");

    return {
      success: true,
      completedSteps,
      failedSteps,
    };
  }
}
