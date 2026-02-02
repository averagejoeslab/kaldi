/**
 * Hooks Manager
 *
 * Manages hook configuration and execution.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { HookConfig, HookEvent, HookContext, HookResult } from "./types.js";
import { executeHook } from "./executor.js";

/**
 * Hooks configuration file structure
 */
interface HooksConfig {
  hooks: HookConfig[];
}

/**
 * Hooks Manager - manages hook configuration and execution
 */
export class HooksManager {
  private configPath: string;
  private hooks: HookConfig[] = [];

  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), ".kaldi", "hooks.json");
    this.loadConfig();
  }

  /**
   * Load hooks configuration
   */
  loadConfig(): void {
    if (!existsSync(this.configPath)) {
      this.hooks = [];
      return;
    }

    try {
      const content = readFileSync(this.configPath, "utf-8");
      const config = JSON.parse(content) as HooksConfig;
      this.hooks = config.hooks || [];
    } catch {
      this.hooks = [];
    }
  }

  /**
   * Save hooks configuration
   */
  saveConfig(): void {
    const config: HooksConfig = { hooks: this.hooks };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Add a hook
   */
  addHook(hook: HookConfig): void {
    // Remove existing hook with same name
    this.hooks = this.hooks.filter((h) => h.name !== hook.name);
    this.hooks.push(hook);
    this.saveConfig();
  }

  /**
   * Remove a hook
   */
  removeHook(name: string): boolean {
    const initialLength = this.hooks.length;
    this.hooks = this.hooks.filter((h) => h.name !== name);

    if (this.hooks.length < initialLength) {
      this.saveConfig();
      return true;
    }

    return false;
  }

  /**
   * Enable a hook
   */
  enableHook(name: string): boolean {
    const hook = this.hooks.find((h) => h.name === name);
    if (hook) {
      hook.enabled = true;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Disable a hook
   */
  disableHook(name: string): boolean {
    const hook = this.hooks.find((h) => h.name === name);
    if (hook) {
      hook.enabled = false;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Get all hooks
   */
  getAllHooks(): HookConfig[] {
    return [...this.hooks];
  }

  /**
   * Get hooks for an event
   */
  getHooksForEvent(event: HookEvent, toolName?: string): HookConfig[] {
    return this.hooks.filter((hook) => {
      if (hook.enabled === false) return false;
      if (hook.event !== event) return false;

      // Check tool filter for tool-related events
      if (
        toolName &&
        hook.tools?.length &&
        !hook.tools.includes(toolName)
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Run hooks for an event
   */
  async runHooks(context: HookContext): Promise<HookResult[]> {
    const hooks = this.getHooksForEvent(context.event, context.toolName);
    const results: HookResult[] = [];

    for (const hook of hooks) {
      const result = await executeHook(hook, context);
      results.push(result);

      // Stop if hook blocks
      if (result.blocked) {
        break;
      }
    }

    return results;
  }

  /**
   * Check if any hook blocks an action
   */
  async checkBlock(context: HookContext): Promise<{ blocked: boolean; reason?: string }> {
    const results = await this.runHooks(context);

    for (const result of results) {
      if (result.blocked) {
        return { blocked: true, reason: result.blockReason };
      }
    }

    return { blocked: false };
  }
}

// Singleton instance
let managerInstance: HooksManager | null = null;

/**
 * Get the hooks manager singleton
 */
export function getHooksManager(): HooksManager {
  if (!managerInstance) {
    managerInstance = new HooksManager();
  }
  return managerInstance;
}
