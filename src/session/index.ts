/**
 * Session Module
 *
 * Conversation persistence, compaction, and export.
 */

// Store
export {
  type Session,
  type SessionMetadata,
  generateSessionId,
  createSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  getLatestSession,
  getSessionForDirectory,
  searchSessions,
  getSessionsDir,
} from "./store.js";

// Compaction
export {
  type CompactionConfig,
  type CompactionResult,
  estimateTokens,
  estimateMessageTokens,
  estimateTotalTokens,
  needsCompaction,
  buildSummaryPrompt,
  createCompactedMessages,
  applyCompaction,
  formatCompactionNotice,
  formatTokenStatus,
} from "./compaction.js";

// Export
export {
  type ExportOptions,
  type ExportResult,
  type ExportFormat,
  exportSession,
  exportToFile,
  exportToMarkdown,
  exportToJson,
  exportToHtml,
  formatExportSuccess,
} from "./export/index.js";
