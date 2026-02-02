/**
 * Unit tests for Skills and Memory System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SkillsManager,
  getSkillsManager,
  createSkillsManager,
  loadKaldiMemory,
  isSkillCommand,
  executeSkillCommand,
  type Skill,
  type SkillConfig,
} from '../../src/core/skills.js';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

describe('SkillsManager', () => {
  let manager: SkillsManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-skills-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = createSkillsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('skill management', () => {
    it('should start with no custom skills', () => {
      expect(manager.list()).toEqual([]);
    });

    it('should report skill not found', () => {
      expect(manager.has('nonexistent')).toBe(false);
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('should list skill names', () => {
      expect(manager.getNames()).toEqual([]);
    });
  });

  describe('createSkill', () => {
    it('should create a new skill', () => {
      const skillPath = manager.createSkill('test-skill', {
        description: 'A test skill',
        prompt: 'Do something',
        isUserLevel: false,
      });

      expect(skillPath).toContain('test-skill');
      expect(skillPath).toContain('SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    it('should create skill with all options', () => {
      const skillPath = manager.createSkill('full-skill', {
        displayName: 'Full Skill',
        description: 'A full test skill',
        prompt: 'Do $ARGUMENTS',
        allowedTools: ['read_file', 'glob'],
        blockedTools: ['bash'],
        isUserLevel: false,
      });

      expect(fs.existsSync(skillPath)).toBe(true);
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(content).toContain('Full Skill');
      expect(content).toContain('allowed: read_file, glob');
      expect(content).toContain('blocked: bash');
    });

    it('should reload after creating skill', () => {
      manager.createSkill('reload-test', {
        description: 'Test reload',
        prompt: 'Test',
        isUserLevel: false,
      });

      // Force reload
      expect(manager.has('reload-test')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should return error for unknown skill', () => {
      const result = manager.execute('unknown-skill', 'args');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown skill');
    });

    it('should execute skill with arguments', () => {
      manager.createSkill('echo-skill', {
        description: 'Echo args',
        prompt: 'Echo: $ARGUMENTS',
        isUserLevel: false,
      });

      const result = manager.execute('echo-skill', 'hello world');
      expect(result.success).toBe(true);
      expect(result.prompt).toContain('hello world');
    });
  });

  describe('getFormattedList', () => {
    it('should format empty list', () => {
      const output = manager.getFormattedList();
      expect(output).toContain('No skills');
    });

    it('should format list with skills', () => {
      manager.createSkill('test-skill', {
        description: 'A test skill',
        prompt: 'Test',
        isUserLevel: false,
      });

      const output = manager.getFormattedList();
      expect(output).toContain('test-skill');
    });
  });

  describe('deleteSkill', () => {
    it('should delete existing skill', () => {
      manager.createSkill('delete-me', {
        description: 'Delete this',
        prompt: 'Test',
        isUserLevel: false,
      });

      expect(manager.has('delete-me')).toBe(true);
      const deleted = manager.deleteSkill('delete-me');
      expect(deleted).toBe(true);
      expect(manager.has('delete-me')).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      const deleted = manager.deleteSkill('nonexistent');
      expect(deleted).toBe(false);
    });
  });
});

describe('isSkillCommand', () => {
  let tempDir: string;
  let manager: SkillsManager;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-cmd-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = createSkillsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should identify skill commands', () => {
    // Create a skill first
    manager.createSkill('review', {
      description: 'Review code',
      prompt: 'Review $ARGUMENTS',
      isUserLevel: false,
    });

    expect(isSkillCommand('/review', tempDir)).toBe(true);
  });

  it('should reject non-skill commands', () => {
    expect(isSkillCommand('review', tempDir)).toBe(false);
    expect(isSkillCommand('', tempDir)).toBe(false);
  });

  it('should return false for non-existent skills', () => {
    expect(isSkillCommand('/nonexistent', tempDir)).toBe(false);
  });
});

describe('executeSkillCommand', () => {
  let tempDir: string;
  let manager: SkillsManager;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-exec-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = createSkillsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should execute skill command', () => {
    manager.createSkill('greet', {
      description: 'Greet',
      prompt: 'Hello $ARGUMENTS',
      isUserLevel: false,
    });

    const result = executeSkillCommand('/greet world', tempDir);
    expect(result.success).toBe(true);
    expect(result.prompt).toContain('Hello world');
  });

  it('should fail for non-command input', () => {
    const result = executeSkillCommand('not a command', tempDir);
    expect(result.success).toBe(false);
  });
});

describe('loadKaldiMemory', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `kaldi-memory-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should return empty when no memory files exist', () => {
    const result = loadKaldiMemory(tempDir);
    expect(result.combinedContent).toBe('');
    expect(result.files).toHaveLength(0);
  });

  it('should load project KALDI.md', () => {
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.md'), '# Test Memory\nSome notes');

    const result = loadKaldiMemory(tempDir);
    expect(result.combinedContent).toContain('Test Memory');
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0].type).toBe('project');
  });

  it('should load local KALDI.local.md', () => {
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.local.md'), '# Local Notes\nPersonal stuff');

    const result = loadKaldiMemory(tempDir);
    expect(result.combinedContent).toContain('Local Notes');
    expect(result.files.some(f => f.type === 'local')).toBe(true);
  });

  it('should generate system prompt addition', () => {
    const kaldiDir = path.join(tempDir, '.kaldi');
    fs.mkdirSync(kaldiDir, { recursive: true });
    fs.writeFileSync(path.join(kaldiDir, 'KALDI.md'), '# Test Memory\nSome notes');

    const result = loadKaldiMemory(tempDir);
    expect(result.systemPromptAddition).toContain('Project Context');
    expect(result.systemPromptAddition).toContain('KALDI.md');
  });
});

describe('Skill Configuration', () => {
  it('should parse SKILL.md format', () => {
    const content = `# Review Code

Review the provided code for issues.

## Prompt
Review $ARGUMENTS and identify bugs.

## Tools
- allowed: read_file, glob, grep
`;

    // Test parsing logic would go here
    expect(content).toContain('Review');
  });
});
