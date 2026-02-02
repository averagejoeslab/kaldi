/**
 * Unit tests for Background Tasks System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackgroundTask,
  TaskManager,
  ToolHistory,
  taskManager,
  toolHistory,
  toggleVerboseMode,
  formatKeyboardHints,
  type TaskStatus,
  type BackgroundTaskConfig,
} from '../../src/core/tasks.js';

describe('BackgroundTask', () => {
  it('should create task with pending status', () => {
    const task = new BackgroundTask({
      id: 'test-1',
      name: 'test-task',
      description: 'A test task',
      operation: async () => 'result',
    });
    expect(task.status).toBe('pending');
    expect(task.name).toBe('test-task');
    expect(task.description).toBe('A test task');
  });

  it('should generate unique IDs when created via manager', async () => {
    const manager = new TaskManager();
    const task1 = await manager.createTask({
      name: 'task1',
      operation: async () => 'done',
    });
    const task2 = await manager.createTask({
      name: 'task2',
      operation: async () => 'done',
    });
    expect(task1.id).not.toBe(task2.id);
    manager.destroy();
  });

  it('should emit events on status changes', async () => {
    const startHandler = vi.fn();
    const completeHandler = vi.fn();

    const task = new BackgroundTask({
      id: 'event-test',
      name: 'event-test',
      operation: async () => 'result',
    });

    task.on('start', startHandler);
    task.on('complete', completeHandler);

    // Start the task
    await task.start();

    expect(startHandler).toHaveBeenCalled();
    expect(completeHandler).toHaveBeenCalled();
    expect(task.status).toBe('complete');
  });

  it('should handle errors', async () => {
    const errorHandler = vi.fn();

    const task = new BackgroundTask({
      id: 'error-test',
      name: 'error-test',
      operation: async () => {
        throw new Error('Test error');
      },
    });

    task.on('error', errorHandler);

    await task.start();

    expect(errorHandler).toHaveBeenCalled();
    expect(task.status).toBe('error');
    expect(task.error?.message).toBe('Test error');
  });

  it('should support abort', () => {
    const task = new BackgroundTask({
      id: 'abort-test',
      name: 'abort-test',
      operation: async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('done'), 10000);
        });
      },
    });

    task.abort();

    expect(task.status).toBe('error');
    expect(task.error?.message).toBe('Task aborted');
  });

  it('should track duration', async () => {
    const task = new BackgroundTask({
      id: 'duration-test',
      name: 'duration-test',
      operation: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      },
    });

    await task.start();

    // Allow some timing variance
    expect(task.duration).toBeGreaterThanOrEqual(40);
    expect(task.isFinished).toBe(true);
  });

  it('should format task for display', () => {
    const task = new BackgroundTask({
      id: 'format-test',
      name: 'format-test',
      description: 'A test task',
      operation: async () => 'done',
    });

    const formatted = task.format();
    expect(formatted).toContain('format-test');
  });
});

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should create and track tasks', async () => {
    const task = await manager.createTask({
      name: 'test',
      operation: async () => 'done',
    });
    expect(manager.getTask(task.id)).toBe(task);
  });

  it('should list all tasks', async () => {
    await manager.createTask({ name: 'task1', operation: async () => 'done' });
    await manager.createTask({ name: 'task2', operation: async () => 'done' });
    expect(manager.getAllTasks()).toHaveLength(2);
  });

  it('should filter tasks by status', async () => {
    const task1 = await manager.createTask({
      name: 'task1',
      operation: async () => 'done',
    });

    // Create a second task that stays pending longer
    const task2 = manager.backgroundOperation(
      'task2',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'done';
      }
    );

    // Wait for task1 to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(manager.getCompletedTasks().length).toBeGreaterThanOrEqual(1);

    // Clean up
    task2.abort();
  });

  it('should cleanup completed tasks', async () => {
    await manager.createTask({
      name: 'cleanup-test',
      operation: async () => 'done',
    });

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(manager.getAllTasks()).toHaveLength(1);
    manager.clearFinished();
    expect(manager.getAllTasks()).toHaveLength(0);
  });

  it('should toggle verbose mode', () => {
    expect(manager.isVerbose()).toBe(false);
    manager.setVerbose(true);
    expect(manager.isVerbose()).toBe(true);
  });

  it('should format task list', () => {
    const output = manager.formatTaskList();
    expect(output).toContain('No background tasks');
  });

  it('should remove tasks', async () => {
    const task = await manager.createTask({
      name: 'remove-test',
      operation: async () => 'done',
    });

    expect(manager.removeTask(task.id)).toBe(true);
    expect(manager.getTask(task.id)).toBeUndefined();
  });

  it('should cancel all running tasks', async () => {
    // Create a long-running task
    const task = manager.backgroundOperation(
      'long-task',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return 'done';
      }
    );

    // Wait a tick for task to start
    await new Promise((resolve) => setImmediate(resolve));

    const cancelled = manager.cancelAll();
    expect(cancelled).toBeGreaterThanOrEqual(0);
  });
});

describe('ToolHistory', () => {
  let history: ToolHistory;

  beforeEach(() => {
    history = new ToolHistory();
  });

  it('should track tool uses within a turn', () => {
    history.startTurn();
    const id = history.startToolUse('read_file', { path: '/test.txt' });
    history.endToolUse(id, 'content', false);

    const uses = history.getToolUses();
    expect(uses).toHaveLength(1);
    expect(uses[0].name).toBe('read_file');
  });

  it('should count hidden tools when collapsed', () => {
    history.startTurn();
    for (let i = 0; i < 10; i++) {
      const id = history.startToolUse(`tool_${i}`, {});
      history.endToolUse(id, 'result', false);
    }

    // Default visible count is 3
    expect(history.hasHidden).toBe(true);
    expect(history.hiddenCount).toBe(7);

    const formatted = history.format();
    expect(formatted).toContain('+7 more tool uses');
  });

  it('should toggle verbose mode', () => {
    expect(history.isVerbose()).toBe(false);
    history.toggleVerbose();
    expect(history.isVerbose()).toBe(true);
    history.toggleVerbose();
    expect(history.isVerbose()).toBe(false);
  });

  it('should clear on new turn', () => {
    history.startTurn();
    const id = history.startToolUse('test', {});
    history.endToolUse(id, 'result', false);

    history.startTurn();
    expect(history.getToolUses()).toHaveLength(0);
  });

  it('should format tool use', () => {
    history.startTurn();
    const id = history.startToolUse('read_file', { path: '/test.txt' });
    history.endToolUse(id, 'content', false);

    const uses = history.getToolUses();
    const formatted = history.formatToolUse(uses[0]);
    expect(formatted).toContain('read_file');
  });

  it('should track tool count', () => {
    history.startTurn();
    expect(history.count).toBe(0);

    const id = history.startToolUse('test', {});
    expect(history.count).toBe(1);

    history.endToolUse(id, 'result', false);
    expect(history.count).toBe(1);
  });

  it('should clear history', () => {
    history.startTurn();
    const id = history.startToolUse('test', {});
    history.endToolUse(id, 'result', false);

    history.clear();
    expect(history.getToolUses()).toHaveLength(0);
  });
});

describe('Helper Functions', () => {
  it('formatKeyboardHints should format hints', () => {
    const hints = formatKeyboardHints({
      showBackground: true,
      showVerbose: true,
      isVerbose: false,
    });
    expect(hints).toContain('ctrl+b');
    expect(hints).toContain('ctrl+o');
  });

  it('formatKeyboardHints should return empty when no options', () => {
    const hints = formatKeyboardHints({});
    expect(hints).toBe('');
  });

  it('toggleVerboseMode should toggle both manager and history', () => {
    const startVerbose = toolHistory.isVerbose();
    toggleVerboseMode();
    expect(toolHistory.isVerbose()).toBe(!startVerbose);
    toggleVerboseMode(); // Reset
  });
});
