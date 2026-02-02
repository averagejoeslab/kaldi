/**
 * Export Module
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import type { Session } from "../store.js";
import type { ExportOptions, ExportResult } from "./types.js";
import { exportToMarkdown } from "./markdown.js";
import { exportToJson } from "./json.js";
import { exportToHtml } from "./html.js";
import { c } from "../../ui/theme/colors.js";
import { sym } from "../../ui/theme/symbols.js";

export * from "./types.js";
export { exportToMarkdown } from "./markdown.js";
export { exportToJson } from "./json.js";
export { exportToHtml } from "./html.js";

export type ExportFormat = "markdown" | "json" | "html";

/**
 * Export session to specified format
 */
export function exportSession(
  session: Session,
  format: ExportFormat,
  options: ExportOptions = {}
): ExportResult {
  switch (format) {
    case "markdown":
      return exportToMarkdown(session, options);
    case "json":
      return exportToJson(session, options);
    case "html":
      return exportToHtml(session, options);
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

/**
 * Export session to file
 */
export async function exportToFile(
  session: Session,
  format: ExportFormat,
  directory: string = process.cwd(),
  options: ExportOptions = {}
): Promise<string> {
  const result = exportSession(session, format, options);
  const filePath = join(directory, result.filename);

  await writeFile(filePath, result.content, "utf-8");

  return filePath;
}

/**
 * Format export success message
 */
export function formatExportSuccess(path: string, format: ExportFormat): string {
  return c.success(`  ${sym.success} Exported to ${path} (${format})`);
}
