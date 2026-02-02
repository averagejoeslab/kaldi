/**
 * Markdown Export
 */

import type { Session } from "../store.js";
import type { Message, ContentBlock } from "../../providers/types.js";
import type { ExportOptions, ExportResult } from "./types.js";

export function exportToMarkdown(
  session: Session,
  options: ExportOptions = {}
): ExportResult {
  const { includeMetadata = true, includeToolCalls = true } = options;

  const lines: string[] = [];

  // Header
  lines.push(`# Conversation Export`);
  lines.push("");

  // Metadata
  if (includeMetadata) {
    lines.push(`## Session Info`);
    lines.push("");
    lines.push(`- **ID**: ${session.metadata.id}`);
    lines.push(`- **Created**: ${session.metadata.createdAt}`);
    lines.push(`- **Directory**: ${session.metadata.workingDirectory}`);
    lines.push(`- **Model**: ${session.metadata.model}`);
    lines.push(`- **Messages**: ${session.messages.length}`);
    lines.push(
      `- **Tokens**: ${session.totalInputTokens} in / ${session.totalOutputTokens} out`
    );
    lines.push("");
  }

  lines.push(`## Conversation`);
  lines.push("");

  // Messages
  for (const message of session.messages) {
    const role = message.role === "user" ? "User" : "Assistant";
    lines.push(`### ${role}`);
    lines.push("");

    if (typeof message.content === "string") {
      lines.push(message.content);
    } else {
      for (const block of message.content) {
        lines.push(formatBlock(block, includeToolCalls));
      }
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return {
    content: lines.join("\n"),
    format: "markdown",
    filename: `kaldi-${session.metadata.id}.md`,
  };
}

function formatBlock(block: ContentBlock, includeTools: boolean): string {
  switch (block.type) {
    case "text":
      return block.text;

    case "tool_use":
      if (!includeTools) return "";
      return `\n**Tool Call**: \`${block.name}\`\n\`\`\`json\n${JSON.stringify(block.input, null, 2)}\n\`\`\`\n`;

    case "tool_result":
      if (!includeTools) return "";
      return `\n**Tool Result**:\n\`\`\`\n${block.content.slice(0, 1000)}${block.content.length > 1000 ? "\n...(truncated)" : ""}\n\`\`\`\n`;

    case "thinking":
      return `\n*Thinking: ${block.thinking.slice(0, 200)}...*\n`;

    default:
      return "";
  }
}
