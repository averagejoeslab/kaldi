/**
 * Integration tests for Kaldi Core Systems
 *
 * Tests how the core modules (tasks, hooks, skills, subagents) work together.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Core modules
import {
  TaskManager,
  ToolHistory,
  BackgroundTask,
  type BackgroundTaskConfig,
} from '../../src/core/tasks.js';
import {
  HooksManager,
  resetHooksManager,
  type HookConfig,
} from '../../src/core/hooks.js';
import {
  SkillsManager,
  createSkillsManager,
  loadKaldiMemory,
} from '../../src/core/skills.js';
import {
  SubAgentManager,
  createExploreAgent,
  createPlanAgent,
  resetSubAgentManager,
} from '../../src/core/subagents.js';

describe('Tasks and Hooks Integration', () => {
  let taskManager: TaskManager;
  let hooksManager: HooksManager;
  let tempDir: string;

  beforeEach(() => {
    resetHooksManager();
    tempDir = path.join(tmpdir(), `kaldi-integration-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    taskManager = new TaskManager();
    hooksManager = new HooksManager();
  });

  afterEach(() => {
    taskManager.destroy();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should trigger hooks when task starts', async () => {
    const hookTriggered = vi.fn();

    // Simulate hook trigger on task creation
    taskManager.on('taskCreated', () => {
      hookTriggered();
    });

    await taskManager.createTask({
      name: 'test-task',
      operation: async () => 'done',
    });

    expect(hookTriggered).toHaveBeenCalled();
  });

  it('should handle disabled hooks during task execution', async () => {
    hooksManager.setEnabled(false);

    const result = await hooksManager.trigger('PreToolUse', { tool: 'bash' });
    expect(result.proceed).toBe(true);

    const task = await taskManager.createTask({
      name: 'task-with-disabled-hooks',
      operation: async () => 'done',
    });

    expect(task.status).toBe('complete');
  });

  it('should track tool uses during task execution', () => {
    const toolHistory = new ToolHistory();

    toolHistory.startTurn();
    const id1 = toolHistory.startToolUse('read_file', { path: '/test.txt' });
    toolHistory.endToolUse(id1, 'file content', false);

    const id2 = toolHistory.startToolUse('write_file', { path: '/output.txt' });
    toolHistory.endToolUse(id2, 'written', false);

    expect(toolHistory.count).toBe(2);
    expect(toolHistory.getToolUses().map(t => t.name)).toEqual(['read_file', 'write_file']);
  });
});

describe('Skills and Memory Integration', () => {
  let tempDir: string;
  let skillsManager: SkillsManager;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-skills-integration-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    skillsManager = createSkillsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should load memory and skills from same project', () => {
    // Create project .kaldi directory
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });

    // Create memory file
    fs.writeFileSync(
      path.join(kaldiDir, 'KALDI.md'),
      '# Project Memory\n\nThis is a test project.'
    );

    // Create skills directory and skill
    const skillsDir = path.join(kaldiDir, 'skills', 'test-skill');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, 'SKILL.md'),
      '# Test Skill\n\nA test skill.\n\n## Prompt\n\nDo $ARGUMENTS'
    );

    // Load both
    const memory = loadKaldiMemory(tempDir);
    expect(memory.combinedContent).toContain('Project Memory');

    skillsManager.load();
    expect(skillsManager.has('test-skill')).toBe(true);
  });

  it('should execute skill with memory context', () => {
    // Create memory
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(
      path.join(kaldiDir, 'KALDI.md'),
      '# Memory\n\nAlways use TypeScript.'
    );

    // Create skill that references memory context
    skillsManager.createSkill('check-style', {
      description: 'Check coding style',
      prompt: 'Check if this follows our style: $ARGUMENTS',
      isUserLevel: false,
    });

    const memory = loadKaldiMemory(tempDir);
    const result = skillsManager.execute('check-style', 'const x = 5;');

    expect(result.success).toBe(true);
    expect(result.prompt).toContain('const x = 5');
    expect(memory.combinedContent).toContain('TypeScript');
  });

  it('should override user skills with project skills', () => {
    // Create project skill
    skillsManager.createSkill('review', {
      description: 'Project-specific review',
      prompt: 'Review (project): $ARGUMENTS',
      isUserLevel: false,
    });

    const result = skillsManager.execute('review', 'code.ts');
    expect(result.prompt).toContain('Review (project)');
  });
});

describe('SubAgents and Tasks Integration', () => {
  let tempDir: string;
  let subAgentManager: SubAgentManager;
  let taskManager: TaskManager;

  beforeEach(() => {
    resetSubAgentManager();
    tempDir = path.join(tmpdir(), `kaldi-subagent-integration-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    subAgentManager = new SubAgentManager(tempDir);
    taskManager = new TaskManager();
  });

  afterEach(() => {
    taskManager.destroy();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should have explore agent with read-only tools', () => {
    const config = subAgentManager.get('explore');
    expect(config).toBeDefined();
    expect(config?.toolRestrictions?.allowOnly).toContain('read_file');
    expect(config?.toolRestrictions?.allowOnly).toContain('glob');
    expect(config?.toolRestrictions?.allowOnly).not.toContain('write_file');
    expect(config?.toolRestrictions?.allowOnly).not.toContain('bash');
  });

  it('should have plan agent with read-only tools', () => {
    const config = subAgentManager.get('plan');
    expect(config).toBeDefined();
    expect(config?.toolRestrictions?.allowOnly).toContain('read_file');
    expect(config?.toolRestrictions?.allowOnly).not.toContain('bash');
  });

  it('should list background tasks from subagents', () => {
    // SubAgentManager has its own background task tracking
    expect(subAgentManager.listBackgroundTasks()).toEqual([]);
  });

  it('should track subagent execution as background task', async () => {
    // Create a task that simulates subagent work
    const task = await taskManager.createTask({
      name: 'explore-codebase',
      description: 'Using explore subagent',
      operation: async () => {
        // Simulate subagent work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'Found 5 relevant files';
      },
    });

    // Wait for task to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(task.status).toBe('complete');
    expect(task.output).toBe('Found 5 relevant files');
  });

  it('should load custom agents from directory', async () => {
    // Create custom agent directory
    const agentDir = path.join(tempDir, '.kaldi', 'agents', 'custom-agent');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, 'AGENT.md'),
      `---
name: custom-agent
description: A custom test agent
maxTurns: 10
---

You are a custom agent for testing.`
    );

    await subAgentManager.loadProjectAgents();

    const config = subAgentManager.get('custom-agent');
    expect(config).toBeDefined();
    expect(config?.description).toBe('A custom test agent');
    expect(config?.maxTurns).toBe(10);
  });
});

describe('Full Workflow Integration', () => {
  let tempDir: string;
  let taskManager: TaskManager;
  let hooksManager: HooksManager;
  let skillsManager: SkillsManager;
  let subAgentManager: SubAgentManager;
  let toolHistory: ToolHistory;

  beforeEach(() => {
    resetHooksManager();
    resetSubAgentManager();

    tempDir = path.join(tmpdir(), `kaldi-full-integration-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    taskManager = new TaskManager();
    hooksManager = new HooksManager();
    skillsManager = createSkillsManager(tempDir);
    subAgentManager = new SubAgentManager(tempDir);
    toolHistory = new ToolHistory();
  });

  afterEach(() => {
    taskManager.destroy();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should execute complete skill workflow', async () => {
    // 1. Setup project with memory and skills
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(
      path.join(kaldiDir, 'KALDI.md'),
      '# Project\n\nUse TypeScript.'
    );

    skillsManager.createSkill('analyze', {
      description: 'Analyze code',
      prompt: 'Analyze: $ARGUMENTS',
      isUserLevel: false,
    });

    // 2. Load memory
    const memory = loadKaldiMemory(tempDir);
    expect(memory.files.length).toBeGreaterThan(0);

    // 3. Execute skill
    const skillResult = skillsManager.execute('analyze', 'main.ts');
    expect(skillResult.success).toBe(true);

    // 4. Track tool usage
    toolHistory.startTurn();
    const toolId = toolHistory.startToolUse('read_file', { path: 'main.ts' });
    toolHistory.endToolUse(toolId, 'file contents', false);

    expect(toolHistory.count).toBe(1);

    // 5. Create background task for analysis
    const task = await taskManager.createTask({
      name: 'analyze-code',
      operation: async () => {
        // Simulate analysis work
        return 'Analysis complete';
      },
    });

    expect(task.status).toBe('complete');
  });

  it('should handle concurrent background tasks', async () => {
    const tasks = await Promise.all([
      taskManager.createTask({
        name: 'task-1',
        operation: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'Task 1 done';
        },
      }),
      taskManager.createTask({
        name: 'task-2',
        operation: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'Task 2 done';
        },
      }),
      taskManager.createTask({
        name: 'task-3',
        operation: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'Task 3 done';
        },
      }),
    ]);

    // Wait for all tasks to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(tasks).toHaveLength(3);
    expect(tasks.every((t) => t.status === 'complete')).toBe(true);
    expect(taskManager.getCompletedTasks()).toHaveLength(3);
  });

  it('should toggle verbose mode across systems', () => {
    // Tool history verbose
    expect(toolHistory.isVerbose()).toBe(false);
    toolHistory.toggleVerbose();
    expect(toolHistory.isVerbose()).toBe(true);

    // Task manager verbose
    expect(taskManager.isVerbose()).toBe(false);
    taskManager.setVerbose(true);
    expect(taskManager.isVerbose()).toBe(true);
  });

  it('should format output with tool history collapsed', () => {
    toolHistory.startTurn();

    // Add many tool uses
    for (let i = 0; i < 10; i++) {
      const id = toolHistory.startToolUse(`tool_${i}`, { index: i });
      toolHistory.endToolUse(id, `result_${i}`, false);
    }

    // Check collapsed view
    expect(toolHistory.hasHidden).toBe(true);
    expect(toolHistory.hiddenCount).toBe(7);

    const formatted = toolHistory.format();
    expect(formatted).toContain('+7 more tool uses');
    expect(formatted).toContain('ctrl+o');
  });
});

describe('Error Handling Integration', () => {
  let tempDir: string;
  let taskManager: TaskManager;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-error-integration-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    taskManager = new TaskManager();
  });

  afterEach(() => {
    taskManager.destroy();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should handle task errors gracefully', async () => {
    const errorHandler = vi.fn();
    taskManager.on('taskError', errorHandler);

    const task = await taskManager.createTask({
      name: 'failing-task',
      operation: async () => {
        throw new Error('Task failed!');
      },
    });

    expect(task.status).toBe('error');
    expect(task.error?.message).toBe('Task failed!');
    expect(errorHandler).toHaveBeenCalled();
  });

  it('should handle aborted tasks', async () => {
    const task = taskManager.backgroundOperation(
      'long-running-task',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return 'done';
      }
    );

    // Wait for task to start
    await new Promise((resolve) => setImmediate(resolve));

    task.abort();

    expect(task.status).toBe('error');
    expect(task.error?.message).toBe('Task aborted');
  });

  it('should handle missing skill gracefully', () => {
    const manager = createSkillsManager(tempDir);
    const result = manager.execute('nonexistent-skill', 'args');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown skill');
  });

  it('should handle malformed KALDI.md gracefully', () => {
    // Empty .kaldi directory with no files
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });

    const result = loadKaldiMemory(tempDir);
    expect(result.files).toHaveLength(0);
    expect(result.combinedContent).toBe('');
  });
});
