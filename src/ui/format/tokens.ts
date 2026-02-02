/**
 * Token Display Formatting
 */

import { c, tokenColors } from "../theme/colors.js";

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextLimit: number;
}

/**
 * Format token count with color based on usage
 */
export function formatTokenCount(
  current: number,
  max: number
): string {
  const percentage = (current / max) * 100;
  const color =
    percentage > 80
      ? tokenColors.high
      : percentage > 60
        ? tokenColors.medium
        : tokenColors.low;

  return color(`${current.toLocaleString()}/${max.toLocaleString()}`);
}

/**
 * Format token stats for display
 */
export function formatTokenStats(stats: TokenStats): string {
  const percentage = (stats.totalTokens / stats.contextLimit) * 100;
  const color =
    percentage > 80
      ? tokenColors.high
      : percentage > 60
        ? tokenColors.medium
        : tokenColors.low;

  return [
    color(`${stats.totalTokens.toLocaleString()} tokens`),
    c.dim(` (${percentage.toFixed(0)}% of context)`),
  ].join("");
}

/**
 * Format usage summary
 */
export function formatUsageSummary(
  inputTokens: number,
  outputTokens: number
): string {
  return c.dim(
    `${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`
  );
}

/**
 * Format cost estimate (rough approximation)
 */
export function formatCostEstimate(
  inputTokens: number,
  outputTokens: number,
  model: string
): string {
  // Rough pricing per 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4": { input: 3, output: 15 },
    "claude-opus-4": { input: 15, output: 75 },
    "gpt-4o": { input: 2.5, output: 10 },
    default: { input: 3, output: 15 },
  };

  const modelKey = Object.keys(pricing).find((k) =>
    model.toLowerCase().includes(k.replace("-", ""))
  );
  const { input, output } = pricing[modelKey || "default"];

  const cost = (inputTokens * input + outputTokens * output) / 1_000_000;

  if (cost < 0.01) {
    return c.dim(`<$0.01`);
  }
  return c.dim(`~$${cost.toFixed(2)}`);
}
