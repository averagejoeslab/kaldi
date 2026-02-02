/**
 * Permission Manager
 *
 * Handles permission requests and decisions.
 */

import type {
  PermissionRule,
  PermissionRequest,
  PermissionDecision,
  PermissionConfig,
  PermissionScope,
} from "./types.js";
import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private sessionPermissions: Map<string, boolean> = new Map();
  private defaultScope: PermissionScope = "session";

  constructor(config?: Partial<PermissionConfig>) {
    if (config?.rules) {
      this.rules = config.rules;
    }
    if (config?.defaultScope) {
      this.defaultScope = config.defaultScope;
    }
  }

  /**
   * Check if an action is permitted
   */
  check(request: PermissionRequest): PermissionDecision {
    // Check explicit rules first
    for (const rule of this.rules) {
      if (this.ruleMatches(rule, request)) {
        if (rule.scope === "always") {
          return { granted: true, scope: "always", reason: rule.description };
        }
        if (rule.scope === "never") {
          return { granted: false, scope: "never", reason: rule.description };
        }
      }
    }

    // Check session permissions
    const sessionKey = this.getSessionKey(request);
    if (this.sessionPermissions.has(sessionKey)) {
      const granted = this.sessionPermissions.get(sessionKey)!;
      return { granted, scope: "session" };
    }

    // Default: not granted (need to ask)
    return { granted: false, scope: this.defaultScope };
  }

  /**
   * Grant permission for this session
   */
  grantSession(request: PermissionRequest): void {
    const key = this.getSessionKey(request);
    this.sessionPermissions.set(key, true);
  }

  /**
   * Deny permission for this session
   */
  denySession(request: PermissionRequest): void {
    const key = this.getSessionKey(request);
    this.sessionPermissions.set(key, false);
  }

  /**
   * Add a permanent rule
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule
   */
  removeRule(tool: string, pattern?: string): void {
    this.rules = this.rules.filter(
      (r) => !(r.tool === tool && r.pattern === pattern)
    );
  }

  /**
   * Get all rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Clear session permissions
   */
  clearSession(): void {
    this.sessionPermissions.clear();
  }

  /**
   * Get session permission count
   */
  getSessionCount(): number {
    return this.sessionPermissions.size;
  }

  private ruleMatches(rule: PermissionRule, request: PermissionRequest): boolean {
    if (rule.tool !== request.tool && rule.tool !== "*") {
      return false;
    }

    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern);
        const argsStr = JSON.stringify(request.args);
        return regex.test(argsStr);
      } catch {
        return false;
      }
    }

    return true;
  }

  private getSessionKey(request: PermissionRequest): string {
    // Create a key based on tool and relevant args
    const relevantArgs = this.getRelevantArgs(request);
    return `${request.tool}:${JSON.stringify(relevantArgs)}`;
  }

  private getRelevantArgs(request: PermissionRequest): Record<string, unknown> {
    // For file operations, include the path
    // For bash, include the command pattern (first word)
    const args = request.args;

    switch (request.tool) {
      case "write_file":
      case "edit_file":
        return { path: args.path };
      case "bash": {
        const cmd = (args.command as string) || "";
        const firstWord = cmd.split(/\s+/)[0];
        return { command: firstWord };
      }
      default:
        return {};
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let manager: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!manager) {
    manager = new PermissionManager();
  }
  return manager;
}

export function resetPermissionManager(): void {
  manager = null;
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatPermissionRequest(request: PermissionRequest): string {
  const lines: string[] = [];

  lines.push(c.warning(`  ${sym.warning} Permission Required`));
  lines.push("");
  lines.push(`  ${c.accent("Tool:")} ${request.tool}`);
  lines.push(`  ${c.accent("Action:")} ${request.description}`);

  if (Object.keys(request.args).length > 0) {
    lines.push("");
    lines.push(`  ${c.dim("Arguments:")}`);
    for (const [key, value] of Object.entries(request.args)) {
      const valueStr = typeof value === "string"
        ? value.length > 50 ? value.slice(0, 50) + "..." : value
        : JSON.stringify(value).slice(0, 50);
      lines.push(`    ${key}: ${valueStr}`);
    }
  }

  lines.push("");
  lines.push(c.dim("  [y] Yes  [n] No  [a] Always  [s] Session"));

  return lines.join("\n");
}

export function formatPermissionRules(rules: PermissionRule[]): string {
  if (rules.length === 0) {
    return c.dim("  No permission rules configured");
  }

  const lines: string[] = [c.accent("  Permission Rules"), ""];

  for (const rule of rules) {
    const scope = rule.scope === "always"
      ? c.success("always")
      : rule.scope === "never"
        ? c.error("never")
        : c.warning("session");

    lines.push(`  ${rule.tool}${rule.pattern ? ` (${rule.pattern})` : ""}`);
    lines.push(`    Scope: ${scope}`);
    if (rule.description) {
      lines.push(`    ${c.dim(rule.description)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
