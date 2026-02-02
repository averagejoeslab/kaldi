/**
 * Unit tests for Hooks System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HooksManager,
  getHooksManager,
  resetHooksManager,
  validateHookConfig,
  createDefaultHooksConfig,
  type HookConfig,
  type HookEvent
} from '../../src/core/hooks.js';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

describe('HooksManager', () => {
  let manager: HooksManager;
  let tempDir: string;

  beforeEach(() => {
    resetHooksManager();
    tempDir = path.join(tmpdir(), `kaldi-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    manager = new HooksManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('validateHookConfig', () => {
    it('should validate a correct hook config', () => {
      const config: HookConfig = {
        event: 'PreToolUse',
        command: 'echo "test"',
      };
      expect(validateHookConfig(config)).toBe(true);
    });

    it('should reject invalid event types', () => {
      const config = {
        event: 'InvalidEvent',
        command: 'echo "test"',
      };
      expect(validateHookConfig(config)).toBe(false);
    });

    it('should reject missing command', () => {
      const config = {
        event: 'PreToolUse',
      };
      expect(validateHookConfig(config)).toBe(false);
    });

    it('should accept optional fields', () => {
      const config: HookConfig = {
        event: 'PostToolUse',
        command: 'echo "test"',
        matcher: '.*bash.*',
        timeout: 5000,
        enabled: true,
      };
      expect(validateHookConfig(config)).toBe(true);
    });
  });

  describe('createDefaultHooksConfig', () => {
    it('should create empty hooks config', () => {
      const config = createDefaultHooksConfig();
      expect(config.version).toBe(1);
      expect(config.hooks).toEqual([]);
    });
  });

  describe('getHooksForEvent', () => {
    it('should return empty array when no hooks', () => {
      const hooks = manager.getHooksForEvent('PreToolUse');
      expect(hooks).toEqual([]);
    });
  });

  describe('setEnabled/isEnabled', () => {
    it('should be enabled by default', () => {
      expect(manager.isEnabled()).toBe(true);
    });

    it('should toggle enabled state', () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe('trigger', () => {
    it('should proceed when disabled', async () => {
      manager.setEnabled(false);
      const result = await manager.trigger('PreToolUse', { tool: 'bash' });
      expect(result.proceed).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should proceed when no matching hooks', async () => {
      const result = await manager.trigger('PreToolUse', { tool: 'bash' });
      expect(result.proceed).toBe(true);
    });
  });

  describe('listHooks', () => {
    it('should return empty array initially', () => {
      expect(manager.listHooks()).toEqual([]);
    });
  });

  describe('formatHooksList', () => {
    it('should show "No hooks configured" when empty', () => {
      const output = manager.formatHooksList();
      expect(output).toContain('No hooks configured');
    });
  });
});

describe('Hook Events', () => {
  const validEvents: HookEvent[] = [
    'SessionStart',
    'SessionEnd',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Stop',
    'PreCompact',
    'Notification',
  ];

  it.each(validEvents)('should accept %s as valid event', (event) => {
    const config: HookConfig = {
      event,
      command: 'echo "test"',
    };
    expect(validateHookConfig(config)).toBe(true);
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetHooksManager();
  });

  it('should return same instance', () => {
    const m1 = getHooksManager();
    const m2 = getHooksManager();
    expect(m1).toBe(m2);
  });

  it('should create new instance after reset', () => {
    const m1 = getHooksManager();
    resetHooksManager();
    const m2 = getHooksManager();
    expect(m1).not.toBe(m2);
  });
});
