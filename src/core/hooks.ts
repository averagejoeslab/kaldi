/**
 * Hooks System for Kaldi CLI
 *
 * Allows users to execute custom commands at various lifecycle events.
 * Inspired by Claude Code's hooks system.
 */

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

// Pyrenees + Coffee colors
const colors = {
  primary: chalk.hex("#C9A66B"),
  accent: chalk.hex("#DAA520"),
  dim: chalk.hex("#A09080"),
  text: chalk.hex("#F5F0E6"),
  success: chalk.hex("#7CB342"),
  error: chalk.hex("#CD5C5C"),
  info: chalk.hex("#87CEEB"),
};

// ============================================================================
// TYPES
// ============================================================================

export type HookEvent =
  | "SessionStart"
  | "SessionEnd"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Stop"
  | "PreCompact"
  | "Notification";

export interface HookConfig {
  event: HookEvent;
  command: string;
  matcher?: string; // regex to match tool name or args
  timeout?: number; // in ms, default 30000
  enabled?: boolean;
}

export interface HookInput {
  event: HookEvent;
  sessionId?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  prompt?: string;
  timestamp: string;
}

export interface HookResult {
  success: boolean;
  blocked: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface HooksConfig {
  version?: number;
  hooks: HookConfig[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const KALDI_DIR = join(homedir(), ".kaldi");
const USER_HOOKS_FILE = join(KALDI_DIR, "hooks.json");
const PROJECT_HOOKS_DIR = ".kaldi";
const PROJECT_HOOKS_FILE = "hooks.json";
const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// HOOKS MANAGER
// ============================================================================

export class HooksManager {
  private hooks: HookConfig[] = [];
  private projectDir: string = process.cwd();
  private enabled: boolean = true;

  constructor() {
    this.load();
  }

  /**
   * Load hooks from user and project config files
   */
  load(projectDir?: string): void {
    this.hooks = [];
    if (projectDir) {
      this.projectDir = projectDir;
    }

    // Load user-level hooks
    if (existsSync(USER_HOOKS_FILE)) {
      try {
        const content = readFileSync(USER_HOOKS_FILE, "utf-8");
        const config: HooksConfig = JSON.parse(content);
        if (config.hooks) {
          this.hooks.push(...config.hooks);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Load project-level hooks (override user-level)
    const projectHooksPath = join(this.projectDir, PROJECT_HOOKS_DIR, PROJECT_HOOKS_FILE);
    if (existsSync(projectHooksPath)) {
      try {
        const content = readFileSync(projectHooksPath, "utf-8");
        const config: HooksConfig = JSON.parse(content);
        if (config.hooks) {
          this.hooks.push(...config.hooks);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  /**
   * Save hooks to user config
   */
  saveUserHooks(hooks: HookConfig[]): void {
    if (!existsSync(KALDI_DIR)) {
      mkdirSync(KALDI_DIR, { recursive: true });
    }
    const config: HooksConfig = { version: 1, hooks };
    writeFileSync(USER_HOOKS_FILE, JSON.stringify(config, null, 2), "utf-8");
    this.load();
  }

  /**
   * Save hooks to project config
   */
  saveProjectHooks(hooks: HookConfig[]): void {
    const projectDir = join(this.projectDir, PROJECT_HOOKS_DIR);
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    const config: HooksConfig = { version: 1, hooks };
    writeFileSync(join(projectDir, PROJECT_HOOKS_FILE), JSON.stringify(config, null, 2), "utf-8");
    this.load();
  }

  /**
   * Get hooks for a specific event
   */
  getHooksForEvent(event: HookEvent): HookConfig[] {
    return this.hooks.filter(h => h.event === event && h.enabled !== false);
  }

  /**
   * Check if a hook matches the given context
   */
  private matchesContext(hook: HookConfig, input: HookInput): boolean {
    if (!hook.matcher) return true;

    try {
      const regex = new RegExp(hook.matcher);

      // Match against tool name
      if (input.tool && regex.test(input.tool)) return true;

      // Match against args
      if (input.args) {
        const argsStr = JSON.stringify(input.args);
        if (regex.test(argsStr)) return true;
      }

      // Match against prompt
      if (input.prompt && regex.test(input.prompt)) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Execute a hook command
   */
  private async executeHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    const startTime = Date.now();
    const timeout = hook.timeout || DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      try {
        const child = spawn("sh", ["-c", hook.command], {
          stdio: ["pipe", "pipe", "pipe"],
          timeout,
          env: {
            ...process.env,
            KALDI_HOOK_EVENT: input.event,
            KALDI_HOOK_TOOL: input.tool || "",
            KALDI_SESSION_ID: input.sessionId || "",
          },
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        // Send input as JSON via stdin
        child.stdin?.write(JSON.stringify(input));
        child.stdin?.end();

        child.on("close", (code) => {
          const duration = Date.now() - startTime;

          // Exit code 2 means block the operation
          const blocked = code === 2;

          resolve({
            success: code === 0 || code === 2,
            blocked,
            output: stdout.trim(),
            error: stderr.trim() || undefined,
            duration,
          });
        });

        child.on("error", (err) => {
          resolve({
            success: false,
            blocked: false,
            error: err.message,
            duration: Date.now() - startTime,
          });
        });

      } catch (err) {
        resolve({
          success: false,
          blocked: false,
          error: err instanceof Error ? err.message : String(err),
          duration: Date.now() - startTime,
        });
      }
    });
  }

  /**
   * Trigger hooks for an event
   * Returns true if operation should proceed, false if blocked
   */
  async trigger(event: HookEvent, context: Partial<HookInput> = {}): Promise<{
    proceed: boolean;
    results: HookResult[];
  }> {
    if (!this.enabled) {
      return { proceed: true, results: [] };
    }

    const input: HookInput = {
      event,
      timestamp: new Date().toISOString(),
      ...context,
    };

    const hooks = this.getHooksForEvent(event);
    const matchingHooks = hooks.filter(h => this.matchesContext(h, input));

    if (matchingHooks.length === 0) {
      return { proceed: true, results: [] };
    }

    const results: HookResult[] = [];
    let blocked = false;

    for (const hook of matchingHooks) {
      const result = await this.executeHook(hook, input);
      results.push(result);

      if (result.blocked) {
        blocked = true;
        break; // Stop executing further hooks if blocked
      }
    }

    return { proceed: !blocked, results };
  }

  /**
   * Convenience methods for specific events
   */
  async onSessionStart(sessionId: string): Promise<boolean> {
    const { proceed } = await this.trigger("SessionStart", { sessionId });
    return proceed;
  }

  async onSessionEnd(sessionId: string): Promise<void> {
    await this.trigger("SessionEnd", { sessionId });
  }

  async onUserPromptSubmit(prompt: string): Promise<boolean> {
    const { proceed } = await this.trigger("UserPromptSubmit", { prompt });
    return proceed;
  }

  async onPreToolUse(tool: string, args: Record<string, unknown>): Promise<boolean> {
    const { proceed } = await this.trigger("PreToolUse", { tool, args });
    return proceed;
  }

  async onPostToolUse(tool: string, args: Record<string, unknown>, result: string): Promise<void> {
    await this.trigger("PostToolUse", { tool, args, result });
  }

  async onPostToolUseFailure(tool: string, args: Record<string, unknown>, error: string): Promise<void> {
    await this.trigger("PostToolUseFailure", { tool, args, error });
  }

  async onStop(): Promise<void> {
    await this.trigger("Stop", {});
  }

  async onPreCompact(): Promise<boolean> {
    const { proceed } = await this.trigger("PreCompact", {});
    return proceed;
  }

  /**
   * Enable/disable hooks
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * List all hooks
   */
  listHooks(): HookConfig[] {
    return [...this.hooks];
  }

  /**
   * Add a hook
   */
  addHook(hook: HookConfig, scope: "user" | "project" = "user"): void {
    const existingHooks = scope === "user"
      ? this.getUserHooks()
      : this.getProjectHooks();

    existingHooks.push(hook);

    if (scope === "user") {
      this.saveUserHooks(existingHooks);
    } else {
      this.saveProjectHooks(existingHooks);
    }
  }

  /**
   * Remove a hook by index
   */
  removeHook(index: number, scope: "user" | "project" = "user"): boolean {
    const hooks = scope === "user"
      ? this.getUserHooks()
      : this.getProjectHooks();

    if (index < 0 || index >= hooks.length) return false;

    hooks.splice(index, 1);

    if (scope === "user") {
      this.saveUserHooks(hooks);
    } else {
      this.saveProjectHooks(hooks);
    }

    return true;
  }

  private getUserHooks(): HookConfig[] {
    if (!existsSync(USER_HOOKS_FILE)) return [];
    try {
      const content = readFileSync(USER_HOOKS_FILE, "utf-8");
      const config: HooksConfig = JSON.parse(content);
      return config.hooks || [];
    } catch {
      return [];
    }
  }

  private getProjectHooks(): HookConfig[] {
    const path = join(this.projectDir, PROJECT_HOOKS_DIR, PROJECT_HOOKS_FILE);
    if (!existsSync(path)) return [];
    try {
      const content = readFileSync(path, "utf-8");
      const config: HooksConfig = JSON.parse(content);
      return config.hooks || [];
    } catch {
      return [];
    }
  }

  /**
   * Format hooks list for display
   */
  formatHooksList(): string {
    if (this.hooks.length === 0) {
      return colors.dim("  No hooks configured");
    }

    const lines: string[] = [];
    lines.push(colors.primary("  Configured Hooks"));
    lines.push("");

    this.hooks.forEach((hook, i) => {
      const status = hook.enabled === false ? colors.dim("disabled") : colors.success("active");
      const matcher = hook.matcher ? colors.dim(` [${hook.matcher}]`) : "";
      lines.push(`  ${colors.accent(`${i + 1}.`)} ${colors.text(hook.event)}${matcher}`);
      lines.push(`     ${colors.dim(hook.command)} ${status}`);
    });

    return lines.join("\n");
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _hooksManager: HooksManager | null = null;

export function getHooksManager(): HooksManager {
  if (!_hooksManager) {
    _hooksManager = new HooksManager();
  }
  return _hooksManager;
}

export function resetHooksManager(): void {
  _hooksManager = null;
}

export const hooksManager = getHooksManager();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createDefaultHooksConfig(): HooksConfig {
  return {
    version: 1,
    hooks: [],
  };
}

export function validateHookConfig(config: unknown): config is HookConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;

  const validEvents: HookEvent[] = [
    "SessionStart", "SessionEnd", "UserPromptSubmit",
    "PreToolUse", "PostToolUse", "PostToolUseFailure",
    "Stop", "PreCompact", "Notification"
  ];

  if (!validEvents.includes(c.event as HookEvent)) return false;
  if (typeof c.command !== "string") return false;

  return true;
}
