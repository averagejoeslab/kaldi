/**
 * Hooks Types
 *
 * Type definitions for the hooks system.
 */

/**
 * Hook events that can trigger hooks
 */
export type HookEvent =
  | "pre-tool-call"
  | "post-tool-call"
  | "pre-response"
  | "post-response"
  | "session-start"
  | "session-end"
  | "user-prompt-submit";

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Hook name */
  name: string;
  /** Event to trigger on */
  event: HookEvent;
  /** Command to execute */
  command: string;
  /** Whether hook is enabled */
  enabled?: boolean;
  /** Timeout in ms */
  timeout?: number;
  /** Only run for specific tools */
  tools?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Hook execution context
 */
export interface HookContext {
  /** Event that triggered the hook */
  event: HookEvent;
  /** Working directory */
  cwd: string;
  /** Session ID */
  sessionId?: string;
  /** Tool name (for tool-related events) */
  toolName?: string;
  /** Tool arguments (for pre-tool-call) */
  toolArgs?: Record<string, unknown>;
  /** Tool result (for post-tool-call) */
  toolResult?: unknown;
  /** User message (for user-prompt-submit) */
  userMessage?: string;
  /** Assistant response (for post-response) */
  response?: string;
}

/**
 * Hook execution result
 */
export interface HookResult {
  /** Whether hook executed successfully */
  success: boolean;
  /** Hook output (stdout) */
  output?: string;
  /** Hook error output (stderr) */
  error?: string;
  /** Exit code */
  exitCode?: number;
  /** Whether the action should be blocked */
  blocked?: boolean;
  /** Block reason */
  blockReason?: string;
  /** Modified context (for pre-* hooks) */
  modifiedContext?: Partial<HookContext>;
}
