/**
 * End-to-End tests for Kaldi CLI Commands
 *
 * Tests the CLI behavior from a user's perspective.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

// Import core modules to test command-like functionality
import {
  SkillsManager,
  createSkillsManager,
  loadKaldiMemory,
  isSkillCommand,
  executeSkillCommand,
} from '../../src/core/skills.js';
import {
  HooksManager,
  resetHooksManager,
  validateHookConfig,
  createDefaultHooksConfig,
} from '../../src/core/hooks.js';
import {
  SubAgentManager,
  resetSubAgentManager,
} from '../../src/core/subagents.js';
import {
  TaskManager,
  ToolHistory,
  formatKeyboardHints,
} from '../../src/core/tasks.js';

describe('CLI Memory Commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-e2e-memory-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('/memory should list memory files', () => {
    // Simulate /memory command
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.md'), '# Project Notes\n\nImportant info.');

    const memory = loadKaldiMemory(tempDir);
    expect(memory.files.length).toBe(1);
    expect(memory.files[0].type).toBe('project');
    expect(memory.combinedContent).toContain('Project Notes');
  });

  it('/memory should show empty state', () => {
    const memory = loadKaldiMemory(tempDir);
    expect(memory.files.length).toBe(0);
    expect(memory.combinedContent).toBe('');
  });

  it('/memory should load multiple memory levels', () => {
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.md'), '# Project');
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.local.md'), '# Local');

    const memory = loadKaldiMemory(tempDir);
    expect(memory.files.length).toBe(2);
    expect(memory.files.some(f => f.type === 'project')).toBe(true);
    expect(memory.files.some(f => f.type === 'local')).toBe(true);
  });
});

describe('CLI Skill Commands', () => {
  let tempDir: string;
  let manager: SkillsManager;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-e2e-skills-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = createSkillsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('/skills should list available skills', () => {
    const output = manager.getFormattedList();
    expect(output).toContain('No skills');
  });

  it('/skills should show custom skills', () => {
    manager.createSkill('my-skill', {
      description: 'My custom skill',
      prompt: 'Do $ARGUMENTS',
      isUserLevel: false,
    });

    const output = manager.getFormattedList();
    expect(output).toContain('my-skill');
    expect(output).toContain('Project Skills');
  });

  it('skill commands should be detected', () => {
    manager.createSkill('test', {
      description: 'Test skill',
      prompt: 'Test $ARGUMENTS',
      isUserLevel: false,
    });

    expect(isSkillCommand('/test', tempDir)).toBe(true);
    expect(isSkillCommand('/unknown', tempDir)).toBe(false);
    expect(isSkillCommand('test', tempDir)).toBe(false);
  });

  it('skill commands should execute', () => {
    manager.createSkill('greet', {
      description: 'Greet someone',
      prompt: 'Hello, $ARGUMENTS!',
      isUserLevel: false,
    });

    const result = executeSkillCommand('/greet world', tempDir);
    expect(result.success).toBe(true);
    expect(result.prompt).toBe('Hello, world!');
  });

  it('skill commands should handle arguments', () => {
    manager.createSkill('args-test', {
      description: 'Test args',
      prompt: 'First: $1, Second: $2, All: $ARGUMENTS',
      isUserLevel: false,
    });

    const result = executeSkillCommand('/args-test one two three', tempDir);
    expect(result.success).toBe(true);
    expect(result.prompt).toContain('First: one');
    expect(result.prompt).toContain('Second: two');
    expect(result.prompt).toContain('All: one two three');
  });
});

describe('CLI Hooks Commands', () => {
  let manager: HooksManager;

  beforeEach(() => {
    resetHooksManager();
    manager = new HooksManager();
  });

  it('/hooks should list configured hooks', () => {
    const output = manager.formatHooksList();
    expect(output).toContain('No hooks configured');
  });

  it('hooks config should validate', () => {
    expect(validateHookConfig({
      event: 'PreToolUse',
      command: 'echo "test"',
    })).toBe(true);

    expect(validateHookConfig({
      event: 'InvalidEvent' as any,
      command: 'echo "test"',
    })).toBe(false);
  });

  it('default hooks config should be valid', () => {
    const config = createDefaultHooksConfig();
    expect(config.version).toBe(1);
    expect(config.hooks).toEqual([]);
  });

  it('/hooks should toggle enabled state', () => {
    expect(manager.isEnabled()).toBe(true);
    manager.setEnabled(false);
    expect(manager.isEnabled()).toBe(false);
  });
});

describe('CLI Task Commands', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  afterEach(() => {
    taskManager.destroy();
  });

  it('/tasks should list background tasks', () => {
    const output = taskManager.formatTaskList();
    expect(output).toContain('No background tasks');
  });

  it('/tasks should show running tasks', async () => {
    const task = taskManager.backgroundOperation(
      'long-task',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      }
    );

    // Wait for task to start
    await new Promise((resolve) => setImmediate(resolve));

    const output = taskManager.formatTaskList();
    expect(output).toContain('long-task');

    task.abort();
  });

  it('/tasks should show completed tasks', async () => {
    await taskManager.createTask({
      name: 'completed-task',
      operation: async () => 'done',
    });

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = taskManager.formatTaskList();
    expect(output).toContain('completed-task');
  });

  it('verbose mode should expand tool uses', () => {
    const history = new ToolHistory();
    history.startTurn();

    for (let i = 0; i < 10; i++) {
      const id = history.startToolUse(`tool_${i}`, {});
      history.endToolUse(id, 'result', false);
    }

    // Collapsed view
    expect(history.hasHidden).toBe(true);
    let output = history.format();
    expect(output).toContain('+7 more');

    // Verbose view
    history.toggleVerbose();
    expect(history.hasHidden).toBe(false);
    output = history.format();
    expect(output).not.toContain('+7 more');
  });
});

describe('CLI Subagent Commands', () => {
  let tempDir: string;
  let manager: SubAgentManager;

  beforeEach(() => {
    resetSubAgentManager();
    tempDir = path.join(tmpdir(), `kaldi-e2e-subagent-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = new SubAgentManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should list available subagents', () => {
    const names = manager.listNames();
    expect(names).toContain('explore');
    expect(names).toContain('plan');
    expect(names).toContain('explore:quick');
    expect(names).toContain('explore:medium');
    expect(names).toContain('explore:thorough');
  });

  it('explore agent should have correct configuration', () => {
    const config = manager.get('explore');
    expect(config).toBeDefined();
    expect(config?.toolRestrictions?.allowOnly).toContain('read_file');
    expect(config?.toolRestrictions?.allowOnly).toContain('glob');
    expect(config?.toolRestrictions?.allowOnly).toContain('grep');
    expect(config?.toolRestrictions?.allowOnly).toContain('list_dir');
    expect(config?.toolRestrictions?.allowOnly).not.toContain('write_file');
    expect(config?.toolRestrictions?.allowOnly).not.toContain('bash');
  });

  it('plan agent should have correct configuration', () => {
    const config = manager.get('plan');
    expect(config).toBeDefined();
    expect(config?.description).toContain('planning');
    expect(config?.maxTurns).toBe(30);
  });

  it('should load custom agents', async () => {
    // Create custom agent
    const agentDir = path.join(tempDir, '.kaldi', 'agents', 'custom');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, 'AGENT.md'),
      `---
name: custom
description: Custom agent
maxTurns: 5
---
You are a custom agent.`
    );

    await manager.loadProjectAgents();

    const config = manager.get('custom');
    expect(config).toBeDefined();
    expect(config?.name).toBe('custom');
  });
});

describe('CLI Keyboard Shortcuts', () => {
  it('should format keyboard hints', () => {
    const hints = formatKeyboardHints({
      showBackground: true,
      showVerbose: true,
      isVerbose: false,
    });

    expect(hints).toContain('ctrl+b');
    expect(hints).toContain('ctrl+o');
  });

  it('should show collapse/expand hint based on verbose state', () => {
    const collapsed = formatKeyboardHints({
      showVerbose: true,
      isVerbose: false,
    });
    expect(collapsed).toContain('expand');

    const expanded = formatKeyboardHints({
      showVerbose: true,
      isVerbose: true,
    });
    expect(expanded).toContain('collapse');
  });
});

describe('CLI Project Setup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-e2e-project-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should initialize project with .kaldi directory', () => {
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });

    expect(fs.existsSync(kaldiDir)).toBe(true);
  });

  it('should create skills directory structure', () => {
    const skillsDir = path.join(tempDir, '.kaldi', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const manager = createSkillsManager(tempDir);
    manager.createSkill('my-skill', {
      description: 'Test',
      prompt: '$ARGUMENTS',
      isUserLevel: false,
    });

    expect(fs.existsSync(path.join(skillsDir, 'my-skill', 'SKILL.md'))).toBe(true);
  });

  it('should create agents directory structure', async () => {
    const agentsDir = path.join(tempDir, '.kaldi', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    expect(fs.existsSync(agentsDir)).toBe(true);

    // Can load agents from this directory
    const manager = new SubAgentManager(tempDir);
    await manager.loadProjectAgents();
    // No errors thrown
  });
});

describe('CLI Workflow Simulation', () => {
  let tempDir: string;

  beforeEach(() => {
    resetHooksManager();
    resetSubAgentManager();
    tempDir = path.join(tmpdir(), `kaldi-e2e-workflow-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should simulate code review workflow', () => {
    // 1. Setup project with memory
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(
      path.join(kaldiDir, 'KALDI.md'),
      '# Code Standards\n\n- Use TypeScript\n- Write tests'
    );

    // 2. Create review skill
    const manager = createSkillsManager(tempDir);
    manager.createSkill('review', {
      description: 'Review code for issues',
      prompt: 'Review $ARGUMENTS following our code standards.',
      isUserLevel: false,
    });

    // 3. Load memory
    const memory = loadKaldiMemory(tempDir);
    expect(memory.combinedContent).toContain('TypeScript');

    // 4. Execute skill
    const result = executeSkillCommand('/review main.ts', tempDir);
    expect(result.success).toBe(true);
    expect(result.prompt).toContain('main.ts');
  });

  it('should simulate exploration workflow', () => {
    // 1. Setup project
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const main = () => {}');

    // 2. Get explore subagent config
    const subAgentManager = new SubAgentManager(tempDir);
    const exploreConfig = subAgentManager.get('explore:quick');

    expect(exploreConfig).toBeDefined();
    expect(exploreConfig?.maxTurns).toBe(5);
    expect(exploreConfig?.toolRestrictions?.allowOnly).toContain('glob');
    expect(exploreConfig?.toolRestrictions?.allowOnly).toContain('grep');
  });

  it('should simulate background task workflow', async () => {
    const taskManager = new TaskManager();

    // 1. Create a task
    const task = await taskManager.createTask({
      name: 'analyze-codebase',
      operation: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'Analysis complete';
      },
    });

    // 2. Wait for completion
    await new Promise((r) => setTimeout(r, 50));

    // 3. Check result
    expect(task.status).toBe('complete');
    expect(task.output).toBe('Analysis complete');

    // 4. Verify in task list
    expect(taskManager.getCompletedTasks().length).toBe(1);

    taskManager.destroy();
  });
});
