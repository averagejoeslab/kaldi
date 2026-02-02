/**
 * Streaming Token Count Display
 *
 * Real-time token counter during response generation.
 */

import chalk from "chalk";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  tokensPerSecond: number;
}

export interface TokenDisplayConfig {
  /** Show cost estimate */
  showCost?: boolean;
  /** Show tokens per second */
  showSpeed?: boolean;
  /** Update interval in ms */
  updateInterval?: number;
  /** Position: 'inline' or 'statusbar' */
  position?: "inline" | "statusbar";
  /** Pricing per million tokens [input, output] */
  pricing?: { input: number; output: number };
}

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  input: chalk.hex("#87CEEB"),     // Blue for input
  output: chalk.hex("#7CB342"),    // Green for output
  cost: chalk.hex("#DAA520"),      // Gold for cost
  speed: chalk.hex("#C9A66B"),     // Latte for speed
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
};

// ============================================================================
// TOKEN COUNTER
// ============================================================================

export class TokenCounter extends EventEmitter {
  private config: Required<TokenDisplayConfig>;
  private stats: TokenStats;
  private startTime: number = 0;
  private lastUpdate: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  // Default pricing (Claude Sonnet)
  private static readonly DEFAULT_PRICING = {
    input: 3.00,   // $3 per million input tokens
    output: 15.00, // $15 per million output tokens
  };

  constructor(config: TokenDisplayConfig = {}) {
    super();
    this.config = {
      showCost: config.showCost ?? true,
      showSpeed: config.showSpeed ?? true,
      updateInterval: config.updateInterval ?? 100,
      position: config.position ?? "inline",
      pricing: config.pricing ?? TokenCounter.DEFAULT_PRICING,
    };

    this.stats = this.createEmptyStats();
  }

  /**
   * Start counting tokens
   */
  start(initialInputTokens: number = 0): void {
    this.stats = this.createEmptyStats();
    this.stats.inputTokens = initialInputTokens;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.isActive = true;

    this.intervalId = setInterval(() => {
      this.updateSpeed();
      this.emit("update", this.stats);
    }, this.config.updateInterval);

    this.emit("start", this.stats);
  }

  /**
   * Add input tokens
   */
  addInputTokens(count: number): void {
    this.stats.inputTokens += count;
    this.recalculate();
  }

  /**
   * Add output tokens (during streaming)
   */
  addOutputTokens(count: number): void {
    this.stats.outputTokens += count;
    this.recalculate();
    this.emit("output", count);
  }

  /**
   * Set total tokens (when response is complete)
   */
  setTotals(input: number, output: number): void {
    this.stats.inputTokens = input;
    this.stats.outputTokens = output;
    this.recalculate();
  }

  /**
   * Stop counting
   */
  stop(): TokenStats {
    this.isActive = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.updateSpeed();
    this.emit("stop", this.stats);

    return { ...this.stats };
  }

  /**
   * Get current stats
   */
  getStats(): TokenStats {
    return { ...this.stats };
  }

  /**
   * Check if counter is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TokenDisplayConfig>): void {
    Object.assign(this.config, config);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createEmptyStats(): TokenStats {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      tokensPerSecond: 0,
    };
  }

  private recalculate(): void {
    this.stats.totalTokens = this.stats.inputTokens + this.stats.outputTokens;
    this.stats.estimatedCost = this.calculateCost();
  }

  private calculateCost(): number {
    const inputCost = (this.stats.inputTokens / 1_000_000) * this.config.pricing.input;
    const outputCost = (this.stats.outputTokens / 1_000_000) * this.config.pricing.output;
    return inputCost + outputCost;
  }

  private updateSpeed(): void {
    const elapsed = Date.now() - this.startTime;
    if (elapsed > 0) {
      this.stats.tokensPerSecond = Math.round(
        (this.stats.outputTokens / elapsed) * 1000
      );
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let tokenCounterInstance: TokenCounter | null = null;

export function getTokenCounter(config?: TokenDisplayConfig): TokenCounter {
  if (!tokenCounterInstance) {
    tokenCounterInstance = new TokenCounter(config);
  }
  return tokenCounterInstance;
}

export function resetTokenCounter(): void {
  if (tokenCounterInstance) {
    tokenCounterInstance.stop();
    tokenCounterInstance = null;
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format token count for display
 */
export function formatTokenCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format inline token display (during streaming)
 */
export function formatInlineTokens(stats: TokenStats, config: TokenDisplayConfig = {}): string {
  const parts: string[] = [];

  // Output tokens (most relevant during streaming)
  parts.push(colors.output(`↓${formatTokenCount(stats.outputTokens)}`));

  // Tokens per second
  if (config.showSpeed !== false && stats.tokensPerSecond > 0) {
    parts.push(colors.speed(`${stats.tokensPerSecond} tok/s`));
  }

  return parts.join(colors.dim(" · "));
}

/**
 * Format full token display (after completion)
 */
export function formatFullTokens(stats: TokenStats, config: TokenDisplayConfig = {}): string {
  const parts: string[] = [];

  // Input/output breakdown
  parts.push(colors.input(`↑${formatTokenCount(stats.inputTokens)}`));
  parts.push(colors.output(`↓${formatTokenCount(stats.outputTokens)}`));

  // Cost estimate
  if (config.showCost !== false) {
    parts.push(colors.cost(formatCost(stats.estimatedCost)));
  }

  return parts.join(colors.dim(" · "));
}

/**
 * Format token stats as a summary line
 */
export function formatTokenSummary(stats: TokenStats): string {
  return [
    colors.dim("  Tokens:"),
    `    ${colors.input("↑ Input:")}  ${formatTokenCount(stats.inputTokens)}`,
    `    ${colors.output("↓ Output:")} ${formatTokenCount(stats.outputTokens)}`,
    `    ${colors.dim("Total:")}   ${formatTokenCount(stats.totalTokens)}`,
    "",
    colors.dim("  Cost:"),
    `    ${colors.cost("~" + formatCost(stats.estimatedCost))}`,
    "",
  ].join("\n");
}

/**
 * Format compact token display for status bar
 */
export function formatStatusBarTokens(stats: TokenStats): string {
  return colors.dim(
    `${formatTokenCount(stats.inputTokens)}↑ ${formatTokenCount(stats.outputTokens)}↓`
  );
}

/**
 * Format token progress indicator
 */
export function formatTokenProgress(current: number, max: number): string {
  const percentage = Math.min(100, Math.round((current / max) * 100));
  const width = 20;
  const filled = Math.round((percentage / 100) * width);

  let barColor = colors.output;
  if (percentage > 75) barColor = chalk.red;
  else if (percentage > 50) barColor = chalk.yellow;

  const bar = barColor("█".repeat(filled)) + colors.dim("░".repeat(width - filled));

  return `${bar} ${percentage}% (${formatTokenCount(current)}/${formatTokenCount(max)})`;
}

// ============================================================================
// CONTEXT WINDOW TRACKING
// ============================================================================

export interface ContextWindow {
  maxTokens: number;
  usedTokens: number;
  reservedTokens: number; // For system prompt, etc.
  availableTokens: number;
}

/**
 * Calculate context window usage
 */
export function calculateContextWindow(
  inputTokens: number,
  outputTokens: number,
  maxTokens: number = 200000,
  reservedTokens: number = 4000
): ContextWindow {
  const usedTokens = inputTokens + outputTokens;
  const availableTokens = Math.max(0, maxTokens - usedTokens - reservedTokens);

  return {
    maxTokens,
    usedTokens,
    reservedTokens,
    availableTokens,
  };
}

/**
 * Format context window display
 */
export function formatContextWindow(ctx: ContextWindow): string {
  const percentage = Math.round((ctx.usedTokens / ctx.maxTokens) * 100);
  const availableK = (ctx.availableTokens / 1000).toFixed(0);

  let status = colors.output("●");
  if (percentage > 75) status = chalk.red("●");
  else if (percentage > 50) status = chalk.yellow("●");

  return `${status} ${percentage}% used · ${availableK}k available`;
}
