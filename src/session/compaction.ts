/**
 * Session Compaction
 *
 * Summarize conversation history to reduce context size.
 */

import type { Message, ContentBlock } from "../providers/types.js";
import type { Session } from "./store.js";
import { c } from "../ui/theme/colors.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CompactionConfig {
  maxTokens: number;
  targetTokens: number;
  preserveRecent: number;
}

export interface CompactionResult {
  originalMessages: number;
  compactedMessages: number;
  summary: string;
  tokensRemoved: number;
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Rough token estimation (4 chars per token average)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a message
 */
export function estimateMessageTokens(message: Message): number {
  if (typeof message.content === "string") {
    return estimateTokens(message.content);
  }

  return message.content.reduce((sum, block) => {
    if (block.type === "text") {
      return sum + estimateTokens(block.text);
    }
    if (block.type === "tool_use") {
      return sum + estimateTokens(JSON.stringify(block.input));
    }
    if (block.type === "tool_result") {
      return sum + estimateTokens(block.content);
    }
    return sum + 100; // Default for other types
  }, 0);
}

/**
 * Estimate total tokens for conversation
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// ============================================================================
// COMPACTION
// ============================================================================

const DEFAULT_CONFIG: CompactionConfig = {
  maxTokens: 100000,
  targetTokens: 50000,
  preserveRecent: 10,
};

/**
 * Check if compaction is needed
 */
export function needsCompaction(
  messages: Message[],
  config: CompactionConfig = DEFAULT_CONFIG
): boolean {
  const totalTokens = estimateTotalTokens(messages);
  return totalTokens > config.maxTokens;
}

/**
 * Generate a summary prompt for the LLM
 */
export function buildSummaryPrompt(messages: Message[]): string {
  const conversationText = messages
    .map((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter((b) => b.type === "text")
              .map((b) => (b as { text: string }).text)
              .join("\n");
      return `${msg.role.toUpperCase()}: ${content.slice(0, 500)}`;
    })
    .join("\n\n");

  return `Summarize this conversation concisely, preserving key decisions, code changes, and context needed to continue the work:

${conversationText}

Provide a concise summary (2-3 paragraphs) that captures:
1. What the user was trying to accomplish
2. Key decisions made and actions taken
3. Current state and any pending items`;
}

/**
 * Create compacted messages with summary
 */
export function createCompactedMessages(
  messages: Message[],
  summary: string,
  config: CompactionConfig = DEFAULT_CONFIG
): Message[] {
  // Keep the most recent messages
  const recentMessages = messages.slice(-config.preserveRecent);

  // Create a summary message
  const summaryMessage: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `[Conversation Summary]\n\n${summary}\n\n[End Summary - Continuing conversation...]`,
      },
    ],
  };

  return [summaryMessage, ...recentMessages];
}

/**
 * Apply compaction to a session
 */
export function applyCompaction(
  session: Session,
  summary: string,
  config: CompactionConfig = DEFAULT_CONFIG
): CompactionResult {
  const originalCount = session.messages.length;
  const originalTokens = estimateTotalTokens(session.messages);

  session.messages = createCompactedMessages(
    session.messages,
    summary,
    config
  );

  session.metadata.compactionCount =
    (session.metadata.compactionCount || 0) + 1;
  session.metadata.summary = summary;

  const newTokens = estimateTotalTokens(session.messages);

  return {
    originalMessages: originalCount,
    compactedMessages: session.messages.length,
    summary,
    tokensRemoved: originalTokens - newTokens,
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatCompactionNotice(result: CompactionResult): string {
  const lines: string[] = [];

  lines.push(c.warning("  Context Compacted"));
  lines.push("");
  lines.push(
    c.dim(
      `  ${result.originalMessages} messages → ${result.compactedMessages} messages`
    )
  );
  lines.push(c.dim(`  ~${result.tokensRemoved} tokens freed`));

  return lines.join("\n");
}

export function formatTokenStatus(
  current: number,
  max: number
): string {
  const percentage = (current / max) * 100;
  const color = percentage > 80 ? c.error : percentage > 60 ? c.warning : c.dim;

  return color(`${current.toLocaleString()}/${max.toLocaleString()} tokens (${percentage.toFixed(0)}%)`);
}
