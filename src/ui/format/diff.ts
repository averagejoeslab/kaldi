/**
 * Diff Display Formatting
 */

import { c } from "../theme/colors.js";

/**
 * Format a simple unified diff
 */
export function formatDiff(
  oldContent: string,
  newContent: string,
  filename?: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const lines: string[] = [];

  if (filename) {
    lines.push(c.dim(`--- ${filename}`));
    lines.push(c.dim(`+++ ${filename}`));
  }

  // Simple line-by-line diff
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      lines.push(c.dim(`  ${oldLine || ""}`));
    } else if (oldLine === undefined) {
      lines.push(c.success(`+ ${newLine}`));
    } else if (newLine === undefined) {
      lines.push(c.error(`- ${oldLine}`));
    } else {
      lines.push(c.error(`- ${oldLine}`));
      lines.push(c.success(`+ ${newLine}`));
    }
  }

  return lines.join("\n");
}

/**
 * Format edit preview
 */
export function formatEditPreview(
  path: string,
  oldString: string,
  newString: string
): string {
  const lines: string[] = [];

  lines.push(c.accent(`  Edit: ${path}`));
  lines.push("");

  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");

  // Show context with changes
  for (const line of oldLines.slice(0, 5)) {
    lines.push(c.error(`  - ${line}`));
  }
  if (oldLines.length > 5) {
    lines.push(c.dim(`  ... (${oldLines.length - 5} more lines)`));
  }

  lines.push("");

  for (const line of newLines.slice(0, 5)) {
    lines.push(c.success(`  + ${line}`));
  }
  if (newLines.length > 5) {
    lines.push(c.dim(`  ... (${newLines.length - 5} more lines)`));
  }

  return lines.join("\n");
}

/**
 * Format file write preview
 */
export function formatWritePreview(path: string, content: string): string {
  const lines: string[] = [];
  const contentLines = content.split("\n");

  lines.push(c.accent(`  Write: ${path}`));
  lines.push(c.dim(`  ${contentLines.length} lines, ${content.length} characters`));

  return lines.join("\n");
}
