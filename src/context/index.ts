/**
 * Context Module
 *
 * System prompt assembly from multiple sources.
 */

// Project context (KALDI.md like AGENTS.md)
export * from "./project/index.js";

// User memory (notes and preferences)
export * from "./memory/index.js";

// Base prompt
export { BASE_SYSTEM_PROMPT, TOOL_GUIDELINES } from "./base-prompt.js";

// Context builder
export {
  buildSystemPrompt,
  buildContextWithMCP,
  type ContextBuilderOptions,
} from "./builder.js";
