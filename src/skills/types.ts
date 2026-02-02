/**
 * Skills Types
 *
 * Type definitions for the skills system.
 */

/**
 * Skill definition
 */
export interface Skill {
  /** Skill name (used as command) */
  name: string;
  /** Short description */
  description: string;
  /** Full prompt template */
  prompt: string;
  /** Aliases */
  aliases?: string[];
  /** Required arguments */
  requiredArgs?: string[];
  /** Optional arguments */
  optionalArgs?: string[];
  /** Whether skill is built-in */
  builtin?: boolean;
  /** Category for organization */
  category?: SkillCategory;
}

/**
 * Skill categories
 */
export type SkillCategory = "git" | "code" | "docs" | "test" | "util" | "custom";

/**
 * Skill execution context
 */
export interface SkillContext {
  /** Working directory */
  cwd: string;
  /** Provider */
  provider: string;
  /** Model */
  model: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Skill execution result
 */
export interface SkillResult {
  /** Expanded prompt to send to agent */
  prompt: string;
  /** Any context to inject */
  context?: string;
}
