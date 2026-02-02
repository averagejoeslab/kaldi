/**
 * Permission Memory System
 *
 * Remembers user's permission decisions within a session.
 * "Yes, don't ask again for this tool" functionality.
 */

import { EventEmitter } from "events";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface PermissionRule {
  /** Tool name or pattern */
  tool: string;
  /** Action pattern (e.g., "read_file", "bash:git *") */
  action?: string;
  /** Path pattern (glob) */
  pathPattern?: string;
  /** Whether to allow or deny */
  decision: "allow" | "deny";
  /** When this rule was created */
  createdAt: Date;
  /** How many times this rule was used */
  usageCount: number;
  /** Session-only or persistent */
  persistent: boolean;
}

export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  rule?: PermissionRule;
  reason?: string;
}

export interface PermissionConfig {
  /** Default decision when no rule matches */
  defaultDecision?: "ask" | "allow" | "deny";
  /** Auto-allow read-only operations */
  allowReadOnly?: boolean;
  /** Tools that are always allowed */
  alwaysAllowed?: string[];
  /** Tools that always require confirmation */
  alwaysAsk?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const READ_ONLY_TOOLS = ["read_file", "glob", "grep", "list_dir", "web_fetch"];
const DANGEROUS_TOOLS = ["bash", "write_file", "edit_file", "delete_file"];

// ============================================================================
// PERMISSION MANAGER
// ============================================================================

export class PermissionManager extends EventEmitter {
  private rules: PermissionRule[] = [];
  private config: Required<PermissionConfig>;
  private sessionAllowed: Set<string> = new Set();
  private sessionDenied: Set<string> = new Set();

  constructor(config: PermissionConfig = {}) {
    super();
    this.config = {
      defaultDecision: config.defaultDecision ?? "ask",
      allowReadOnly: config.allowReadOnly ?? false,
      alwaysAllowed: config.alwaysAllowed ?? [],
      alwaysAsk: config.alwaysAsk ?? DANGEROUS_TOOLS,
    };
  }

  /**
   * Check if a permission request should be allowed
   */
  check(request: PermissionRequest): PermissionDecision {
    const key = this.buildKey(request);

    // Check session-level decisions first
    if (this.sessionAllowed.has(key)) {
      return { allowed: true, reason: "Session allow rule" };
    }
    if (this.sessionDenied.has(key)) {
      return { allowed: false, reason: "Session deny rule" };
    }

    // Check if tool is in always-allowed list
    if (this.config.alwaysAllowed.includes(request.tool)) {
      return { allowed: true, reason: "Always allowed" };
    }

    // Check if tool is read-only and auto-allowed
    if (this.config.allowReadOnly && READ_ONLY_TOOLS.includes(request.tool)) {
      return { allowed: true, reason: "Read-only operation" };
    }

    // Check explicit rules
    for (const rule of this.rules) {
      if (this.matchesRule(request, rule)) {
        rule.usageCount++;
        return {
          allowed: rule.decision === "allow",
          rule,
          reason: `Matched rule: ${rule.tool}`,
        };
      }
    }

    // Check if tool always requires asking
    if (this.config.alwaysAsk.includes(request.tool)) {
      return { allowed: false, reason: "Requires confirmation" };
    }

    // Default decision
    if (this.config.defaultDecision === "allow") {
      return { allowed: true, reason: "Default allow" };
    }
    if (this.config.defaultDecision === "deny") {
      return { allowed: false, reason: "Default deny" };
    }

    // Ask the user
    return { allowed: false, reason: "Ask user" };
  }

  /**
   * Record a permission decision
   */
  recordDecision(
    request: PermissionRequest,
    allowed: boolean,
    rememberForSession: boolean = false,
    persistent: boolean = false
  ): void {
    const key = this.buildKey(request);

    if (rememberForSession || persistent) {
      if (allowed) {
        this.sessionAllowed.add(key);
        this.sessionDenied.delete(key);
      } else {
        this.sessionDenied.add(key);
        this.sessionAllowed.delete(key);
      }

      if (persistent) {
        this.addRule({
          tool: request.tool,
          action: this.getAction(request),
          pathPattern: this.getPathPattern(request),
          decision: allowed ? "allow" : "deny",
          createdAt: new Date(),
          usageCount: 1,
          persistent: true,
        });
      }
    }

    this.emit("decisionRecorded", { request, allowed, rememberForSession, persistent });
  }

  /**
   * Add a permission rule
   */
  addRule(rule: PermissionRule): void {
    // Remove existing rules for the same tool/action
    this.rules = this.rules.filter(
      r => !(r.tool === rule.tool && r.action === rule.action && r.pathPattern === rule.pathPattern)
    );
    this.rules.push(rule);
    this.emit("ruleAdded", rule);
  }

  /**
   * Remove a permission rule
   */
  removeRule(index: number): void {
    if (index >= 0 && index < this.rules.length) {
      const rule = this.rules.splice(index, 1)[0];
      this.emit("ruleRemoved", rule);
    }
  }

  /**
   * Clear all session permissions
   */
  clearSession(): void {
    this.sessionAllowed.clear();
    this.sessionDenied.clear();
    this.emit("sessionCleared");
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules = [];
    this.emit("rulesCleared");
  }

  /**
   * Get all rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Get session permissions
   */
  getSessionPermissions(): { allowed: string[]; denied: string[] } {
    return {
      allowed: Array.from(this.sessionAllowed),
      denied: Array.from(this.sessionDenied),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PermissionConfig>): void {
    Object.assign(this.config, config);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private buildKey(request: PermissionRequest): string {
    const parts = [request.tool];

    if (request.args.command) {
      // For bash, include the command prefix
      const cmd = String(request.args.command).split(" ")[0];
      parts.push(cmd);
    } else if (request.args.path) {
      // For file operations, include the path pattern
      parts.push(String(request.args.path));
    }

    return parts.join(":");
  }

  private getAction(request: PermissionRequest): string | undefined {
    if (request.args.command) {
      return String(request.args.command).split(" ")[0];
    }
    return undefined;
  }

  private getPathPattern(request: PermissionRequest): string | undefined {
    if (request.args.path) {
      return String(request.args.path);
    }
    return undefined;
  }

  private matchesRule(request: PermissionRequest, rule: PermissionRule): boolean {
    // Tool must match
    if (rule.tool !== request.tool && rule.tool !== "*") {
      return false;
    }

    // Action must match if specified
    if (rule.action) {
      const action = this.getAction(request);
      if (!action || !this.matchesPattern(action, rule.action)) {
        return false;
      }
    }

    // Path must match if specified
    if (rule.pathPattern) {
      const path = request.args.path as string | undefined;
      if (!path || !this.matchesPattern(path, rule.pathPattern)) {
        return false;
      }
    }

    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // Simple glob matching
    if (pattern === "*") return true;

    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      );
      return regex.test(value);
    }

    return value === pattern || value.startsWith(pattern);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let permissionManagerInstance: PermissionManager | null = null;

export function getPermissionManager(config?: PermissionConfig): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager(config);
  }
  return permissionManagerInstance;
}

export function resetPermissionManager(): void {
  permissionManagerInstance = null;
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  allow: chalk.hex("#7CB342"),
  deny: chalk.hex("#E57373"),
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
};

/**
 * Format permission rules for display
 */
export function formatPermissionRules(rules: PermissionRule[]): string {
  if (rules.length === 0) {
    return colors.dim("  No permission rules configured");
  }

  const lines: string[] = [colors.accent("  Permission Rules"), ""];

  for (const [i, rule] of rules.entries()) {
    const icon = rule.decision === "allow" ? colors.allow("✓") : colors.deny("✗");
    const action = rule.action ? `:${rule.action}` : "";
    const path = rule.pathPattern ? ` ${rule.pathPattern}` : "";
    const persistent = rule.persistent ? " (persistent)" : " (session)";

    lines.push(`  ${i + 1}. ${icon} ${rule.tool}${action}${path}${colors.dim(persistent)}`);
    lines.push(colors.dim(`      Used ${rule.usageCount} times`));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format session permissions for display
 */
export function formatSessionPermissions(perms: { allowed: string[]; denied: string[] }): string {
  const lines: string[] = [colors.accent("  Session Permissions"), ""];

  if (perms.allowed.length > 0) {
    lines.push(colors.allow("  Allowed:"));
    for (const p of perms.allowed) {
      lines.push(`    ${colors.allow("✓")} ${p}`);
    }
  }

  if (perms.denied.length > 0) {
    lines.push(colors.deny("  Denied:"));
    for (const p of perms.denied) {
      lines.push(`    ${colors.deny("✗")} ${p}`);
    }
  }

  if (perms.allowed.length === 0 && perms.denied.length === 0) {
    lines.push(colors.dim("  No session permissions recorded"));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format permission prompt options
 */
export function formatPermissionOptions(): string {
  return [
    `${colors.accent("1.")} Yes`,
    `${colors.accent("2.")} Yes, don't ask again for this session`,
    `${colors.accent("3.")} Yes, always allow this`,
    `${colors.accent("4.")} No`,
    `${colors.accent("5.")} No, always deny this`,
  ].join("\n");
}
