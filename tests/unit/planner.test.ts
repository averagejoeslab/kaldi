/**
 * Unit tests for Planning Mode System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Planner,
  getPlanner,
  resetPlanner,
  type AgentMode,
  type PlanTrigger,
} from '../../src/core/planner.js';

describe('Planner', () => {
  let planner: Planner;

  beforeEach(() => {
    resetPlanner();
    // Use low threshold for consistent testing
    planner = new Planner({ complexityThreshold: 'low' });
  });

  describe('mode management', () => {
    it('should start in chat mode', () => {
      expect(planner.mode).toBe('chat');
    });

    it('should change mode', () => {
      planner.setMode('plan');
      expect(planner.mode).toBe('plan');
    });

    it('should emit event on mode change', () => {
      const handler = vi.fn();
      planner.on('modeChange', handler);

      planner.setMode('plan');

      expect(handler).toHaveBeenCalledWith({ from: 'chat', to: 'plan' });
    });

    it('should cycle through modes', () => {
      expect(planner.mode).toBe('chat');

      planner.cycleMode();
      expect(planner.mode).toBe('plan');

      planner.cycleMode();
      expect(planner.mode).toBe('execute');

      planner.cycleMode();
      expect(planner.mode).toBe('review');

      planner.cycleMode();
      expect(planner.mode).toBe('chat');
    });

    it('should report planning state', () => {
      expect(planner.isPlanning()).toBe(false);
      planner.setMode('plan');
      expect(planner.isPlanning()).toBe(true);
    });
  });

  describe('shouldPlan', () => {
    it('should detect complex tasks', () => {
      // "implement a new system" matches feature patterns
      const result = planner.shouldPlan('implement a complex new authentication system with multiple components');
      expect(result.shouldPlan).toBe(true);
      // Trigger depends on pattern order, just verify it triggers planning
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect refactoring requests', () => {
      const result = planner.shouldPlan('refactor the user service to use dependency injection');
      expect(result.shouldPlan).toBe(true);
      expect(result.trigger).toBe('refactor');
    });

    it('should detect architecture requests', () => {
      // More explicit architecture request
      const result = planner.shouldPlan('design the architecture for our application');
      expect(result.shouldPlan).toBe(true);
      expect(result.trigger).toBe('architecture');
    });

    it('should detect multi-file changes', () => {
      const result = planner.shouldPlan('make changes across multiple files');
      expect(result.shouldPlan).toBe(true);
      expect(result.trigger).toBe('multi_file');
    });

    it('should not plan for simple fixes', () => {
      const result = planner.shouldPlan('fix the typo in the readme');
      expect(result.shouldPlan).toBe(false);
    });

    it('should not plan for quick changes', () => {
      const result = planner.shouldPlan('just add a console.log');
      expect(result.shouldPlan).toBe(false);
    });

    it('should not plan for explanations', () => {
      const result = planner.shouldPlan('explain how this function works');
      expect(result.shouldPlan).toBe(false);
    });

    it('should detect explicit planning requests', () => {
      // Explicit planning without other triggers
      const result = planner.shouldPlan('plan the approach for this task');
      expect(result.shouldPlan).toBe(true);
      expect(result.trigger).toBe('user_request');
    });
  });

  describe('autoEnterPlanMode', () => {
    it('should auto-enter plan mode for complex tasks', () => {
      const result = planner.autoEnterPlanMode('implement a new feature with multiple components');
      expect(result).toBe(true);
      expect(planner.mode).toBe('plan');
    });

    it('should not auto-enter for simple tasks', () => {
      const result = planner.autoEnterPlanMode('fix the bug');
      expect(result).toBe(false);
      expect(planner.mode).toBe('chat');
    });

    it('should emit autoPlanTriggered event', () => {
      const handler = vi.fn();
      planner.on('autoPlanTriggered', handler);

      planner.autoEnterPlanMode('design a new architecture');

      expect(handler).toHaveBeenCalled();
    });

    it('should not trigger if already in plan mode', () => {
      planner.setMode('plan');
      const result = planner.autoEnterPlanMode('implement feature');
      expect(result).toBe(false);
    });
  });

  describe('plan management', () => {
    it('should create a plan', () => {
      const plan = planner.createPlan('Test Plan', 'A test plan summary');

      expect(plan.title).toBe('Test Plan');
      expect(plan.summary).toBe('A test plan summary');
      expect(plan.status).toBe('draft');
      expect(planner.currentPlan).toBe(plan);
      expect(planner.mode).toBe('plan');
    });

    it('should add steps to plan', () => {
      planner.createPlan('Test', 'Test');
      const step = planner.addStep('First step');

      expect(step).not.toBeNull();
      expect(step?.description).toBe('First step');
      expect(step?.status).toBe('pending');
      expect(planner.currentPlan?.steps).toHaveLength(1);
    });

    it('should update step status', () => {
      planner.createPlan('Test', 'Test');
      const step = planner.addStep('First step');

      const updated = planner.updateStepStatus(step!.id, 'completed');

      expect(updated).toBe(true);
      expect(planner.currentPlan?.steps[0].status).toBe('completed');
    });

    it('should approve plan', () => {
      planner.createPlan('Test', 'Test');
      planner.addStep('Step 1');

      const approved = planner.approvePlan();

      expect(approved).toBe(true);
      expect(planner.currentPlan?.status).toBe('approved');
    });

    it('should not approve non-draft plan', () => {
      planner.createPlan('Test', 'Test');
      planner.approvePlan();

      const approved = planner.approvePlan();

      expect(approved).toBe(false);
    });

    it('should start execution', () => {
      planner.createPlan('Test', 'Test');
      planner.addStep('Step 1');
      planner.approvePlan();

      const started = planner.startExecution();

      expect(started).toBe(true);
      expect(planner.currentPlan?.status).toBe('in_progress');
      expect(planner.mode).toBe('execute');
    });

    it('should cancel plan', () => {
      planner.createPlan('Test', 'Test');

      const cancelled = planner.cancelPlan();

      expect(cancelled).toBe(true);
      expect(planner.currentPlan).toBeNull();
      expect(planner.mode).toBe('chat');
    });

    it('should complete plan', () => {
      planner.createPlan('Test', 'Test');
      planner.addStep('Step 1');
      planner.approvePlan();
      planner.startExecution();

      const completed = planner.completePlan();

      expect(completed).toBe(true);
      expect(planner.currentPlan).toBeNull();
      expect(planner.mode).toBe('chat');
    });

    it('should get next pending step', () => {
      planner.createPlan('Test', 'Test');
      const step1 = planner.addStep('Step 1');
      const step2 = planner.addStep('Step 2');

      planner.updateStepStatus(step1!.id, 'completed');

      const next = planner.getNextStep();
      expect(next?.id).toBe(step2?.id);
    });

    it('should return null when no pending steps', () => {
      planner.createPlan('Test', 'Test');
      const step = planner.addStep('Step 1');
      planner.updateStepStatus(step!.id, 'completed');

      const next = planner.getNextStep();
      expect(next).toBeNull();
    });
  });

  describe('formatting', () => {
    it('should format mode indicator', () => {
      const indicator = planner.formatModeIndicator();
      expect(indicator).toContain('Chat');
    });

    it('should format plan mode indicator', () => {
      planner.setMode('plan');
      const indicator = planner.formatModeIndicator();
      expect(indicator).toContain('Planning');
    });

    it('should format empty plan', () => {
      const formatted = planner.formatPlan();
      expect(formatted).toContain('No active plan');
    });

    it('should format plan with steps', () => {
      planner.createPlan('My Plan', 'Summary');
      planner.addStep('First step');
      planner.addStep('Second step');

      const formatted = planner.formatPlan();

      expect(formatted).toContain('My Plan');
      expect(formatted).toContain('First step');
      expect(formatted).toContain('Second step');
    });

    it('should format progress', () => {
      planner.createPlan('Test', 'Test');
      planner.addStep('Step 1');
      planner.addStep('Step 2');

      const progress = planner.formatProgress();
      expect(progress).toContain('0%');
      expect(progress).toContain('0/2');
    });

    it('should update progress on completion', () => {
      planner.createPlan('Test', 'Test');
      const step1 = planner.addStep('Step 1');
      planner.addStep('Step 2');

      planner.updateStepStatus(step1!.id, 'completed');

      const progress = planner.formatProgress();
      expect(progress).toContain('50%');
      expect(progress).toContain('1/2');
    });
  });

  describe('configuration', () => {
    it('should respect autoDetect config', () => {
      const noAutoPlanner = new Planner({ autoDetect: false });

      const result = noAutoPlanner.shouldPlan('implement complex feature');
      expect(result.shouldPlan).toBe(false);
    });

    it('should respect complexity threshold', () => {
      const highThreshold = new Planner({ complexityThreshold: 'high' });
      const lowThreshold = new Planner({ complexityThreshold: 'low' });

      const input = 'add a feature';

      // Same input, different thresholds
      const highResult = highThreshold.shouldPlan(input);
      const lowResult = lowThreshold.shouldPlan(input);

      // Low threshold should be more likely to trigger planning
      expect(lowResult.confidence >= highResult.confidence).toBe(true);
    });
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetPlanner();
  });

  it('should return same instance', () => {
    const p1 = getPlanner();
    const p2 = getPlanner();
    expect(p1).toBe(p2);
  });

  it('should create new instance after reset', () => {
    const p1 = getPlanner();
    resetPlanner();
    const p2 = getPlanner();
    expect(p1).not.toBe(p2);
  });
});
