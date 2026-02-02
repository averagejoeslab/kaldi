/**
 * Status Display Component
 */

import { c } from "../theme/colors.js";
import { sym } from "../theme/symbols.js";

export type StatusType = "info" | "success" | "warning" | "error" | "pending";

/**
 * Format a status message
 */
export function formatStatus(
  type: StatusType,
  message: string
): string {
  const icons: Record<StatusType, string> = {
    info: sym.info,
    success: sym.success,
    warning: sym.warning,
    error: sym.error,
    pending: sym.pending,
  };

  const colors: Record<StatusType, (s: string) => string> = {
    info: c.info,
    success: c.success,
    warning: c.warning,
    error: c.error,
    pending: c.dim,
  };

  return colors[type](`${icons[type]} ${message}`);
}

/**
 * Format a tool status
 */
export function formatToolStatus(
  tool: string,
  status: "running" | "done" | "error",
  detail?: string
): string {
  const statusText =
    status === "running"
      ? c.dim("...")
      : status === "done"
        ? c.success("✓")
        : c.error("✗");

  const detailText = detail ? c.dim(` ${detail}`) : "";

  return `  ${statusText} ${c.accent(tool)}${detailText}`;
}

/**
 * Format a progress indicator
 */
export function formatProgress(
  current: number,
  total: number,
  width = 20
): string {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = c.success("█".repeat(filled)) + c.dim("░".repeat(empty));
  const percent = c.dim(`${percentage.toFixed(0)}%`);

  return `${bar} ${percent}`;
}

/**
 * Format a mode indicator
 */
export function formatModeIndicator(mode: "safe" | "auto" | "plan"): string {
  const indicators: Record<string, { icon: string; color: (s: string) => string }> = {
    safe: { icon: "🛡", color: c.success },
    auto: { icon: "⚡", color: c.warning },
    plan: { icon: "📋", color: c.info },
  };

  const { icon, color } = indicators[mode];
  return color(`${icon} ${mode}`);
}
