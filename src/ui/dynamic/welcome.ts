/**
 * Dynamic Welcome Screen
 *
 * Beautiful box-drawn welcome with two-panel layout.
 */

import { c } from "../theme/colors.js";
import { mascot, welcomeBanner } from "../theme/ascii-art.js";
import { box, boxTop, boxBottom, boxRow, boxDivider, getTerminalWidth, stripAnsi, center } from "./box.js";
import type { WelcomeConfig, RecentActivity } from "./types.js";

/**
 * Format a timestamp as relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Create the welcome screen
 */
export function createWelcomeScreen(config: WelcomeConfig): string {
  const width = Math.min(getTerminalWidth(), 80);
  const lines: string[] = [];

  // Top border
  lines.push(c.cream(boxTop(width)));

  // Empty line
  lines.push(c.cream(boxRow("", width)));

  // Kaldi banner centered
  const bannerLine = center(`${c.honey("☕")} ${c.bold(c.cream("K A L D I"))} ${c.honey("☕")}`, width - 4);
  lines.push(c.cream(box.vertical) + bannerLine + c.cream(box.vertical));

  // Tagline
  const tagline = center(c.dim("Your Loyal Coding Companion"), width - 4);
  lines.push(c.cream(box.vertical) + tagline + c.cream(box.vertical));

  // Empty line
  lines.push(c.cream(boxRow("", width)));

  // Dog ASCII art (centered)
  const dogLines = mascot.small.split("\n");
  for (const dogLine of dogLines) {
    const centeredDog = center(c.cream(dogLine), width - 4);
    lines.push(c.cream(box.vertical) + centeredDog + c.cream(box.vertical));
  }

  // Empty line
  lines.push(c.cream(boxRow("", width)));

  // Divider
  lines.push(c.cream(boxDivider(width)));

  // Info section
  lines.push(c.cream(boxRow("", width)));

  // Provider and model
  const providerLine = `  ${c.dim("Provider:")} ${c.honey(config.provider)}`;
  lines.push(formatBoxRow(providerLine, width));

  const modelLine = `  ${c.dim("Model:")} ${c.honey(config.model)}`;
  lines.push(formatBoxRow(modelLine, width));

  // Working directory
  const cwdLine = `  ${c.dim("Directory:")} ${c.cream(truncatePath(config.workingDir, width - 20))}`;
  lines.push(formatBoxRow(cwdLine, width));

  // Version
  const versionLine = `  ${c.dim("Version:")} ${c.dim(config.version)}`;
  lines.push(formatBoxRow(versionLine, width));

  lines.push(c.cream(boxRow("", width)));

  // Recent activity if available
  if (config.recentActivity && config.recentActivity.length > 0) {
    lines.push(c.cream(boxDivider(width)));
    lines.push(c.cream(boxRow("", width)));

    const activityHeader = `  ${c.dim("Recent Activity:")}`;
    lines.push(formatBoxRow(activityHeader, width));

    for (const activity of config.recentActivity.slice(0, 3)) {
      const activityLine = `    ${c.dim("•")} ${activity.description} ${c.dim(`(${formatRelativeTime(activity.timestamp)})`)}`;
      lines.push(formatBoxRow(activityLine, width));
    }

    lines.push(c.cream(boxRow("", width)));
  }

  // Shortcuts section
  lines.push(c.cream(boxDivider(width)));
  lines.push(c.cream(boxRow("", width)));

  const shortcutsHeader = `  ${c.dim("Shortcuts:")}`;
  lines.push(formatBoxRow(shortcutsHeader, width));

  const shortcuts = [
    [`${c.honey("/help")}`, "Show commands"],
    [`${c.honey("/clear")}`, "Clear screen"],
    [`${c.honey("/exit")}`, "Exit Kaldi"],
  ];

  for (const [key, desc] of shortcuts) {
    const shortcutLine = `    ${key} ${c.dim("-")} ${c.dim(desc)}`;
    lines.push(formatBoxRow(shortcutLine, width));
  }

  lines.push(c.cream(boxRow("", width)));

  // Bottom border
  lines.push(c.cream(boxBottom(width)));

  // Ready prompt
  lines.push("");
  lines.push(`${c.honey(mascot.icon)} ${c.cream("Ready to help!")} ${c.dim("What would you like to build today?")}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format a box row with proper padding
 */
function formatBoxRow(content: string, width: number): string {
  const innerWidth = width - 4;
  const visibleLength = stripAnsi(content).length;
  const padding = Math.max(0, innerWidth - visibleLength);
  return `${c.cream(box.vertical)} ${content}${" ".repeat(padding)} ${c.cream(box.vertical)}`;
}

/**
 * Truncate a path for display
 */
function truncatePath(path: string, maxWidth: number): string {
  if (path.length <= maxWidth) return path;

  const parts = path.split("/");
  if (parts.length <= 2) {
    return "..." + path.slice(-(maxWidth - 3));
  }

  // Try to show first and last parts
  const first = parts[0] || "";
  const last = parts[parts.length - 1];

  if (first.length + last.length + 5 <= maxWidth) {
    return `${first}/.../${last}`;
  }

  return "..." + path.slice(-(maxWidth - 3));
}

/**
 * Print the welcome screen
 */
export function printWelcomeScreen(config: WelcomeConfig): void {
  console.log(createWelcomeScreen(config));
}
