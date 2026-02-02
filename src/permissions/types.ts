/**
 * Permission Types
 *
 * Security boundary for tool execution.
 */

export type PermissionScope = "session" | "always" | "never";

export interface PermissionRule {
  tool: string;
  pattern?: string; // Regex pattern for args
  scope: PermissionScope;
  description?: string;
}

export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface PermissionDecision {
  granted: boolean;
  scope: PermissionScope;
  reason?: string;
}

export interface PermissionConfig {
  rules: PermissionRule[];
  defaultScope: PermissionScope;
}
