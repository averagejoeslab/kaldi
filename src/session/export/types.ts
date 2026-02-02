/**
 * Export Types
 */

import type { Session } from "../store.js";

export interface ExportOptions {
  includeMetadata?: boolean;
  includeToolCalls?: boolean;
  includeTimestamps?: boolean;
}

export interface ExportResult {
  content: string;
  format: "markdown" | "json" | "html";
  filename: string;
}
