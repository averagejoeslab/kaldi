/**
 * Box Drawing Utilities
 *
 * Create beautiful box-drawn UI elements.
 */

import { c } from "../theme/colors.js";

// Box drawing characters
export const box = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeRight: "├",
  teeLeft: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",
};

/**
 * Get terminal width
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Create a horizontal line
 */
export function horizontalLine(width?: number, char = box.horizontal): string {
  const w = width || getTerminalWidth();
  return char.repeat(w);
}

/**
 * Create a box top border
 */
export function boxTop(width?: number): string {
  const w = (width || getTerminalWidth()) - 2;
  return box.topLeft + box.horizontal.repeat(w) + box.topRight;
}

/**
 * Create a box bottom border
 */
export function boxBottom(width?: number): string {
  const w = (width || getTerminalWidth()) - 2;
  return box.bottomLeft + box.horizontal.repeat(w) + box.bottomRight;
}

/**
 * Create a box row with content
 */
export function boxRow(content: string, width?: number): string {
  const w = width || getTerminalWidth();
  const innerWidth = w - 4; // Account for borders and padding
  const visibleLength = stripAnsi(content).length;
  const padding = Math.max(0, innerWidth - visibleLength);

  return `${box.vertical} ${content}${" ".repeat(padding)} ${box.vertical}`;
}

/**
 * Create a box row with two columns
 */
export function boxRowTwoColumn(left: string, right: string, width?: number, dividerPos?: number): string {
  const w = width || getTerminalWidth();
  const divider = dividerPos || Math.floor(w / 2);

  const leftWidth = divider - 3;
  const rightWidth = w - divider - 3;

  const leftVisible = stripAnsi(left).length;
  const rightVisible = stripAnsi(right).length;

  const leftPadding = Math.max(0, leftWidth - leftVisible);
  const rightPadding = Math.max(0, rightWidth - rightVisible);

  return `${box.vertical} ${left}${" ".repeat(leftPadding)}${box.vertical} ${right}${" ".repeat(rightPadding)} ${box.vertical}`;
}

/**
 * Create a box divider (middle horizontal line)
 */
export function boxDivider(width?: number): string {
  const w = (width || getTerminalWidth()) - 2;
  return box.teeRight + box.horizontal.repeat(w) + box.teeLeft;
}

/**
 * Create a two-column box divider
 */
export function boxDividerTwoColumn(width?: number, dividerPos?: number): string {
  const w = width || getTerminalWidth();
  const divider = dividerPos || Math.floor(w / 2);

  const leftWidth = divider - 1;
  const rightWidth = w - divider - 1;

  return box.teeRight + box.horizontal.repeat(leftWidth) + box.teeDown + box.horizontal.repeat(rightWidth) + box.teeLeft;
}

/**
 * Create a complete box around content
 */
export function createBox(lines: string[], width?: number): string {
  const w = width || getTerminalWidth();
  const result: string[] = [];

  result.push(boxTop(w));
  for (const line of lines) {
    result.push(boxRow(line, w));
  }
  result.push(boxBottom(w));

  return result.join("\n");
}

/**
 * Strip ANSI escape codes from string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Pad string to width (accounting for ANSI)
 */
export function padEnd(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLength);
  return str + " ".repeat(padding);
}

/**
 * Center string within width
 */
export function center(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  const totalPadding = Math.max(0, width - visibleLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return " ".repeat(leftPadding) + str + " ".repeat(rightPadding);
}

/**
 * Truncate string to width with ellipsis
 */
export function truncate(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  if (visibleLength <= width) return str;

  // Simple truncation (doesn't handle ANSI perfectly but works for most cases)
  return str.slice(0, width - 1) + "…";
}
