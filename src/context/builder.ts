/**
 * Context Builder
 *
 * Assembles the full system prompt from all sources.
 */

import { BASE_SYSTEM_PROMPT, TOOL_GUIDELINES } from "./base-prompt.js";
import { loadProjectContext } from "./project/index.js";
import { loadNotes, buildNotesPrompt } from "./memory/index.js";

export interface ContextBuilderOptions {
  projectPath?: string;
  includeProjectContext?: boolean;
  includeMemory?: boolean;
  includeToolGuidelines?: boolean;
  additionalContext?: string[];
}

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(
  options: ContextBuilderOptions = {}
): string {
  const {
    projectPath = process.cwd(),
    includeProjectContext = true,
    includeMemory = true,
    includeToolGuidelines = true,
    additionalContext = [],
  } = options;

  const parts: string[] = [BASE_SYSTEM_PROMPT];

  // Add tool guidelines
  if (includeToolGuidelines) {
    parts.push(TOOL_GUIDELINES);
  }

  // Add project context (KALDI.md / AGENTS.md)
  if (includeProjectContext) {
    const projectContext = loadProjectContext({ projectPath });
    if (projectContext) {
      parts.push(`
<project-context>
The following is project-specific context from ${projectContext.path}:

${projectContext.content}
</project-context>
`);
    }
  }

  // Add user memory (notes/preferences)
  if (includeMemory) {
    const notes = loadNotes(projectPath);
    const notesPrompt = buildNotesPrompt(notes);
    if (notesPrompt) {
      parts.push(notesPrompt);
    }
  }

  // Add any additional context
  for (const ctx of additionalContext) {
    parts.push(ctx);
  }

  return parts.join("\n\n");
}

/**
 * Build context with MCP resources
 */
export function buildContextWithMCP(
  options: ContextBuilderOptions,
  mcpResources?: Array<{ name: string; content: string }>
): string {
  const basePrompt = buildSystemPrompt(options);

  if (!mcpResources?.length) {
    return basePrompt;
  }

  const mcpSection = [
    "<mcp-resources>",
    "The following resources are available from MCP servers:",
    "",
  ];

  for (const resource of mcpResources) {
    mcpSection.push(`## ${resource.name}`);
    mcpSection.push(resource.content);
    mcpSection.push("");
  }

  mcpSection.push("</mcp-resources>");

  return basePrompt + "\n\n" + mcpSection.join("\n");
}
