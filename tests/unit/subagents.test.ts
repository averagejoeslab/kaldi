/**
 * Unit tests for Subagents System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SubAgent,
  SubAgentManager,
  createExploreAgent,
  createPlanAgent,
  getSubAgentManager,
  resetSubAgentManager,
  type SubAgentConfig,
  type ExploreSpeed,
  type ToolRestrictions,
} from '../../src/core/subagents.js';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

describe('createExploreAgent', () => {
  it('should create a quick explore agent', () => {
    const config = createExploreAgent('quick');
    expect(config.name).toBe('explore');
    expect(config.maxTurns).toBe(5);
    expect(config.description).toContain('quick');
    expect(config.toolRestrictions?.allowOnly).toContain('read_file');
    expect(config.toolRestrictions?.allowOnly).toContain('glob');
    expect(config.toolRestrictions?.allowOnly).toContain('grep');
    expect(config.toolRestrictions?.allowOnly).toContain('list_dir');
  });

  it('should create a medium explore agent', () => {
    const config = createExploreAgent('medium');
    expect(config.maxTurns).toBe(15);
    expect(config.description).toContain('medium');
  });

  it('should create a very thorough explore agent', () => {
    const config = createExploreAgent('very_thorough');
    expect(config.maxTurns).toBe(50);
    expect(config.description).toContain('very_thorough');
    expect(config.systemPrompt).toContain('extremely comprehensive');
  });

  it('should default to medium speed', () => {
    const config = createExploreAgent();
    expect(config.maxTurns).toBe(15);
  });

  it('should set auto permission mode', () => {
    const config = createExploreAgent('quick');
    expect(config.permissionMode).toBe('auto');
  });
});

describe('createPlanAgent', () => {
  it('should create a plan agent', () => {
    const config = createPlanAgent();
    expect(config.name).toBe('plan');
    expect(config.maxTurns).toBe(30);
    expect(config.description).toContain('planning');
  });

  it('should be read-only', () => {
    const config = createPlanAgent();
    expect(config.toolRestrictions?.allowOnly).toContain('read_file');
    expect(config.toolRestrictions?.allowOnly).not.toContain('write_file');
    expect(config.toolRestrictions?.allowOnly).not.toContain('bash');
  });

  it('should have implementation planning prompt', () => {
    const config = createPlanAgent();
    expect(config.systemPrompt).toContain('planning');
    expect(config.systemPrompt).toContain('Implementation Steps');
  });
});

describe('SubAgentManager', () => {
  let manager: SubAgentManager;
  let tempDir: string;

  beforeEach(() => {
    resetSubAgentManager();
    tempDir = path.join(tmpdir(), `kaldi-subagent-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = new SubAgentManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('built-in agents', () => {
    it('should have explore agent registered', () => {
      const config = manager.get('explore');
      expect(config).toBeDefined();
      expect(config?.name).toBe('explore');
    });

    it('should have explore speed variants', () => {
      expect(manager.get('explore:quick')).toBeDefined();
      expect(manager.get('explore:medium')).toBeDefined();
      expect(manager.get('explore:thorough')).toBeDefined();
    });

    it('should have plan agent registered', () => {
      const config = manager.get('plan');
      expect(config).toBeDefined();
      expect(config?.name).toBe('plan');
    });
  });

  describe('listNames', () => {
    it('should list all agent names', () => {
      const names = manager.listNames();
      expect(names).toContain('explore');
      expect(names).toContain('plan');
      expect(names).toContain('explore:quick');
      expect(names).toContain('explore:medium');
      expect(names).toContain('explore:thorough');
    });
  });

  describe('list', () => {
    it('should list all agent configs', () => {
      const configs = manager.list();
      expect(configs.length).toBeGreaterThanOrEqual(5);
      expect(configs.some(c => c.name === 'explore')).toBe(true);
      expect(configs.some(c => c.name === 'plan')).toBe(true);
    });
  });

  describe('register', () => {
    it('should register a custom agent', () => {
      const customConfig: SubAgentConfig = {
        name: 'custom-agent',
        description: 'A custom test agent',
        systemPrompt: 'You are a custom agent.',
        maxTurns: 10,
      };

      manager.register(customConfig);

      const retrieved = manager.get('custom-agent');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('custom-agent');
      expect(retrieved?.description).toBe('A custom test agent');
    });
  });

  describe('loadAgentsFromDirectory', () => {
    it('should load agents from AGENT.md files', async () => {
      // Create a custom agent directory
      const agentDir = path.join(tempDir, '.kaldi', 'agents', 'test-agent');
      fs.mkdirSync(agentDir, { recursive: true });

      const agentMd = `---
name: test-agent
description: A test agent for unit tests
maxTurns: 5
permissionMode: auto
allowTools: read_file, glob
---

You are a test agent.

## Guidelines
Be helpful and concise.
`;
      fs.writeFileSync(path.join(agentDir, 'AGENT.md'), agentMd);

      await manager.loadAgentsFromDirectory(path.join(tempDir, '.kaldi', 'agents'));

      const config = manager.get('test-agent');
      expect(config).toBeDefined();
      expect(config?.description).toBe('A test agent for unit tests');
      expect(config?.maxTurns).toBe(5);
      expect(config?.toolRestrictions?.allowOnly).toContain('read_file');
      expect(config?.toolRestrictions?.allowOnly).toContain('glob');
    });

    it('should handle missing directory gracefully', async () => {
      await expect(
        manager.loadAgentsFromDirectory('/nonexistent/path')
      ).resolves.not.toThrow();
    });

    it('should handle missing AGENT.md gracefully', async () => {
      const agentDir = path.join(tempDir, 'empty-agent');
      fs.mkdirSync(agentDir, { recursive: true });

      await expect(
        manager.loadAgentsFromDirectory(tempDir)
      ).resolves.not.toThrow();
    });
  });

  describe('background tasks', () => {
    it('should list background tasks', () => {
      const tasks = manager.listBackgroundTasks();
      expect(tasks).toEqual([]);
    });

    it('should return undefined for unknown task', () => {
      const task = manager.getBackgroundTask('unknown-task');
      expect(task).toBeUndefined();
    });

    it('should return undefined when waiting for unknown task', async () => {
      const result = await manager.waitForTask('unknown-task');
      expect(result).toBeUndefined();
    });

    it('should cleanup completed tasks', () => {
      manager.cleanupCompletedTasks();
      expect(manager.listBackgroundTasks()).toEqual([]);
    });
  });

  describe('runAgent', () => {
    it('should return error for unknown agent', async () => {
      // Create a mock provider
      const mockProvider = {
        name: 'mock',
        createMessage: vi.fn(),
        supportsStreaming: false,
      };

      const result = await manager.runAgent('unknown-agent', mockProvider as any, {
        task: 'test task',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown subagent');
    });
  });
});

describe('SubAgent', () => {
  it('should get config', () => {
    const config: SubAgentConfig = {
      name: 'test',
      description: 'Test agent',
      systemPrompt: 'You are a test agent.',
    };

    const mockProvider = {
      name: 'mock',
      createMessage: vi.fn(),
      supportsStreaming: false,
    };

    const agent = new SubAgent(config, mockProvider as any);
    const retrievedConfig = agent.getConfig();

    expect(retrievedConfig.name).toBe('test');
    expect(retrievedConfig.description).toBe('Test agent');
  });

  it('should get available tools without restrictions', () => {
    const config: SubAgentConfig = {
      name: 'test',
      description: 'Test agent',
      systemPrompt: 'You are a test agent.',
    };

    const mockProvider = {
      name: 'mock',
      createMessage: vi.fn(),
      supportsStreaming: false,
    };

    const agent = new SubAgent(config, mockProvider as any);
    const tools = agent.getAvailableTools();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toContain('read_file');
  });

  it('should restrict tools with allowOnly', () => {
    const config: SubAgentConfig = {
      name: 'test',
      description: 'Test agent',
      systemPrompt: 'You are a test agent.',
      toolRestrictions: {
        allowOnly: ['read_file', 'glob'],
      },
    };

    const mockProvider = {
      name: 'mock',
      createMessage: vi.fn(),
      supportsStreaming: false,
    };

    const agent = new SubAgent(config, mockProvider as any);
    const tools = agent.getAvailableTools();

    expect(tools).toContain('read_file');
    expect(tools).toContain('glob');
    expect(tools).not.toContain('write_file');
    expect(tools).not.toContain('bash');
  });

  it('should restrict tools with block', () => {
    const config: SubAgentConfig = {
      name: 'test',
      description: 'Test agent',
      systemPrompt: 'You are a test agent.',
      toolRestrictions: {
        block: ['bash', 'write_file', 'edit_file'],
      },
    };

    const mockProvider = {
      name: 'mock',
      createMessage: vi.fn(),
      supportsStreaming: false,
    };

    const agent = new SubAgent(config, mockProvider as any);
    const tools = agent.getAvailableTools();

    expect(tools).toContain('read_file');
    expect(tools).not.toContain('bash');
    expect(tools).not.toContain('write_file');
    expect(tools).not.toContain('edit_file');
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetSubAgentManager();
  });

  it('should return same instance', () => {
    const m1 = getSubAgentManager();
    const m2 = getSubAgentManager();
    expect(m1).toBe(m2);
  });

  it('should create new instance after reset', () => {
    const m1 = getSubAgentManager();
    resetSubAgentManager();
    const m2 = getSubAgentManager();
    expect(m1).not.toBe(m2);
  });
});

describe('Tool Restrictions', () => {
  const speeds: ExploreSpeed[] = ['quick', 'medium', 'very_thorough'];

  it.each(speeds)('explore %s should only allow read-only tools', (speed) => {
    const config = createExploreAgent(speed);
    const allowedTools = config.toolRestrictions?.allowOnly || [];

    // Should have read-only tools
    expect(allowedTools).toContain('read_file');
    expect(allowedTools).toContain('glob');
    expect(allowedTools).toContain('grep');
    expect(allowedTools).toContain('list_dir');

    // Should NOT have write tools
    expect(allowedTools).not.toContain('write_file');
    expect(allowedTools).not.toContain('edit_file');
    expect(allowedTools).not.toContain('bash');
  });

  it('plan agent should only allow read-only tools', () => {
    const config = createPlanAgent();
    const allowedTools = config.toolRestrictions?.allowOnly || [];

    expect(allowedTools).toContain('read_file');
    expect(allowedTools).toContain('glob');
    expect(allowedTools).not.toContain('bash');
    expect(allowedTools).not.toContain('write_file');
  });
});
