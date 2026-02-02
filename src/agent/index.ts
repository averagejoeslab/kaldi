/**
 * Agent Module
 *
 * Core agentic loop and orchestration.
 */

export * from "./types.js";
export { AgentOrchestrator, createAgent } from "./orchestrator.js";

// Re-export the legacy Agent class for backwards compatibility
export { Agent } from "./loop.js";
export { buildSystemPrompt, SYSTEM_PROMPT } from "./prompt.js";
