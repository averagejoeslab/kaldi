/**
 * Conversation Auto-Compaction System
 *
 * Automatically summarizes and compacts conversation history when
 * the context window is filling up, preserving important information.
 */

import { EventEmitter } from "events";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface CompactionConfig {
  /** Token threshold to trigger compaction (percentage of max) */
  threshold?: number;
  /** Maximum tokens for the context window */
  maxTokens?: number;
  /** Minimum messages to keep uncompacted */
  minRecentMessages?: number;
  /** Whether to auto-compact */
  autoCompact?: boolean;
  /** Show notification when compacting */
  showNotification?: boolean;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string | ContentBlock[];
  timestamp?: number;
  tokens?: number;
}

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface CompactionResult {
  originalMessageCount: number;
  compactedMessageCount: number;
  originalTokens: number;
  estimatedTokens: number;
  summary: string;
  compactedAt: Date;
}

export interface ConversationState {
  messages: Message[];
  totalTokens: number;
  compactionHistory: CompactionResult[];
  isCompacted: boolean;
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
    return estimateTokens(message.content) + 4; // +4 for role overhead
  }

  let total = 4; // role overhead
  for (const block of message.content) {
    if (block.type === "text" && block.text) {
      total += estimateTokens(block.text);
    } else if (block.type === "image") {
      total += 1000; // rough estimate for images
    } else {
      total += 100; // other block types
    }
  }

  return total;
}

/**
 * Estimate total tokens for messages
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// ============================================================================
// COMPACTION MANAGER
// ============================================================================

export class CompactionManager extends EventEmitter {
  private config: Required<CompactionConfig>;
  private state: ConversationState;

  constructor(config: CompactionConfig = {}) {
    super();
    this.config = {
      threshold: config.threshold ?? 0.75,
      maxTokens: config.maxTokens ?? 200000,
      minRecentMessages: config.minRecentMessages ?? 4,
      autoCompact: config.autoCompact ?? true,
      showNotification: config.showNotification ?? true,
    };

    this.state = {
      messages: [],
      totalTokens: 0,
      compactionHistory: [],
      isCompacted: false,
    };
  }

  /**
   * Set the current messages
   */
  setMessages(messages: Message[]): void {
    this.state.messages = messages;
    this.state.totalTokens = estimateTotalTokens(messages);

    // Check if compaction is needed
    if (this.config.autoCompact && this.shouldCompact()) {
      this.emit("compactionNeeded", this.getContextUsage());
    }
  }

  /**
   * Check if compaction is needed
   */
  shouldCompact(): boolean {
    const usage = this.getContextUsage();
    return usage >= this.config.threshold;
  }

  /**
   * Get current context usage (0-1)
   */
  getContextUsage(): number {
    return this.state.totalTokens / this.config.maxTokens;
  }

  /**
   * Get context stats
   */
  getContextStats(): {
    used: number;
    max: number;
    percentage: number;
    remaining: number;
  } {
    const used = this.state.totalTokens;
    const max = this.config.maxTokens;
    return {
      used,
      max,
      percentage: Math.round((used / max) * 100),
      remaining: max - used,
    };
  }

  /**
   * Perform compaction
   */
  async compact(summarizer: (messages: Message[]) => Promise<string>): Promise<CompactionResult> {
    const originalCount = this.state.messages.length;
    const originalTokens = this.state.totalTokens;

    // Keep recent messages uncompacted
    const keepCount = Math.max(this.config.minRecentMessages, 2);
    const toCompact = this.state.messages.slice(0, -keepCount);
    const toKeep = this.state.messages.slice(-keepCount);

    if (toCompact.length === 0) {
      throw new Error("Not enough messages to compact");
    }

    this.emit("compactionStart", { messageCount: toCompact.length });

    // Generate summary of older messages
    const summary = await summarizer(toCompact);

    // Create compacted state
    const summaryMessage: Message = {
      role: "system",
      content: `[Conversation Summary]\n${summary}\n\n[End of Summary - Recent messages follow]`,
      timestamp: Date.now(),
      tokens: estimateTokens(summary),
    };

    // Build new message list
    const newMessages = [summaryMessage, ...toKeep];
    const newTokens = estimateTotalTokens(newMessages);

    // Create result
    const result: CompactionResult = {
      originalMessageCount: originalCount,
      compactedMessageCount: newMessages.length,
      originalTokens,
      estimatedTokens: newTokens,
      summary,
      compactedAt: new Date(),
    };

    // Update state
    this.state.messages = newMessages;
    this.state.totalTokens = newTokens;
    this.state.compactionHistory.push(result);
    this.state.isCompacted = true;

    this.emit("compactionComplete", result);

    return result;
  }

  /**
   * Get compacted messages
   */
  getMessages(): Message[] {
    return this.state.messages;
  }

  /**
   * Get compaction history
   */
  getHistory(): CompactionResult[] {
    return this.state.compactionHistory;
  }

  /**
   * Check if conversation has been compacted
   */
  isCompacted(): boolean {
    return this.state.isCompacted;
  }

  /**
   * Reset compaction state
   */
  reset(): void {
    this.state = {
      messages: [],
      totalTokens: 0,
      compactionHistory: [],
      isCompacted: false,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompactionConfig>): void {
    Object.assign(this.config, config);
  }
}

// ============================================================================
// SUMMARIZATION PROMPTS
// ============================================================================

export const COMPACTION_PROMPT = `Summarize the following conversation, preserving:
1. Key decisions made
2. Important context about the project/task
3. Files that were modified or discussed
4. Any outstanding tasks or issues

Be concise but comprehensive. This summary will be used to continue the conversation.

Conversation to summarize:
`;

/**
 * Build summarization prompt for messages
 */
export function buildSummarizationPrompt(messages: Message[]): string {
  const parts: string[] = [COMPACTION_PROMPT];

  for (const msg of messages) {
    const role = msg.role.toUpperCase();
    let content = "";

    if (typeof msg.content === "string") {
      content = msg.content;
    } else {
      content = msg.content
        .filter((b): b is ContentBlock & { text: string } => b.type === "text" && !!b.text)
        .map(b => b.text)
        .join("\n");
    }

    // Truncate very long messages
    if (content.length > 2000) {
      content = content.slice(0, 2000) + "\n[... truncated ...]";
    }

    parts.push(`\n${role}:\n${content}`);
  }

  return parts.join("\n");
}

// ============================================================================
// SINGLETON
// ============================================================================

let compactionManagerInstance: CompactionManager | null = null;

export function getCompactionManager(config?: CompactionConfig): CompactionManager {
  if (!compactionManagerInstance) {
    compactionManagerInstance = new CompactionManager(config);
  }
  return compactionManagerInstance;
}

export function resetCompactionManager(): void {
  compactionManagerInstance = null;
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  accent: chalk.hex("#C9A66B"),
  dim: chalk.hex("#888888"),
  warning: chalk.hex("#DAA520"),
  info: chalk.hex("#87CEEB"),
};

/**
 * Format compaction notification
 */
export function formatCompactionNotification(result: CompactionResult): string {
  const savedTokens = result.originalTokens - result.estimatedTokens;
  const savedPercent = Math.round((savedTokens / result.originalTokens) * 100);

  return [
    "",
    colors.info("  ◆ Conversation compacted"),
    colors.dim(`    ${result.originalMessageCount} → ${result.compactedMessageCount} messages`),
    colors.dim(`    Saved ~${formatTokenCount(savedTokens)} tokens (${savedPercent}%)`),
    colors.dim("    ctrl+h to view history"),
    "",
  ].join("\n");
}

/**
 * Format context usage bar
 */
export function formatContextBar(used: number, max: number, width: number = 30): string {
  const percentage = used / max;
  const filled = Math.round(percentage * width);

  let color = chalk.green;
  if (percentage > 0.75) color = chalk.red;
  else if (percentage > 0.5) color = chalk.yellow;

  const bar = color("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
  const label = `${Math.round(percentage * 100)}%`;

  return `${bar} ${label}`;
}

/**
 * Format token count
 */
function formatTokenCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

/**
 * Format compaction history
 */
export function formatCompactionHistory(history: CompactionResult[]): string {
  if (history.length === 0) {
    return colors.dim("  No compaction history");
  }

  const lines: string[] = [colors.accent("  Compaction History"), ""];

  for (const [i, result] of history.entries()) {
    const date = result.compactedAt.toLocaleString();
    const saved = result.originalTokens - result.estimatedTokens;

    lines.push(`  ${i + 1}. ${colors.dim(date)}`);
    lines.push(`     ${result.originalMessageCount} → ${result.compactedMessageCount} messages`);
    lines.push(`     Saved ${formatTokenCount(saved)} tokens`);
    lines.push("");
  }

  return lines.join("\n");
}
