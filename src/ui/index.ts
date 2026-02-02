/**
 * UI Module
 *
 * All user interface components and formatting.
 */

// Theme (single source of truth for colors)
export * from "./theme/index.js";

// New format functions
export * from "./format/index.js";

// New components
export * from "./components/index.js";

// New input handling
export * from "./input/index.js";

// Dynamic UI components (spinners, thinking display, etc.)
export * from "./dynamic/index.js";

// Desktop notifications
export { notify, notifyComplete, notifyError } from "./notifications.js";

// Legacy exports for backwards compatibility
export * from "./diff.js";
export {
  KaldiSpinner,
  createSpinner as createLegacySpinner,
  type SpinnerOptions as LegacySpinnerOptions,
} from "./spinner.js";
export * from "./autocomplete.js";
export {
  StatusManager,
  status,
  startToolStatus,
  getThinkingMessage,
  getReadingMessage,
  getSearchingMessage,
  getRunningMessage,
  getWritingMessage,
  getCompletionMessage,
  formatDuration as formatDurationLegacy,
} from "./status.js";
export * from "./clipboard.js";
export * from "./terminal.js";
export * from "./welcome.js";
export * from "./tool-tree.js";
export * from "./statusline.js";

// Thinking display
export {
  ThinkingDisplay,
  getThinkingDisplay,
  resetThinkingDisplay,
  formatThinkingForExport,
  extractThinking,
  type ThinkingConfig,
  type ThinkingBlock,
} from "./thinking.js";

// Background tasks UI
export {
  BackgroundUIManager,
  getBackgroundUI,
  resetBackgroundUI,
  formatBackgroundIndicator,
  formatTaskList as formatBackgroundTaskList,
  formatTaskStatus as formatBackgroundTaskStatus,
  formatTaskCompletion,
  isBackgroundKey,
  formatBackgroundHint,
  type BackgroundTaskUI,
  type BackgroundUIConfig,
} from "./background.js";

// Syntax highlighting
export {
  highlight as highlightLegacy,
  detectLanguage as detectLanguageLegacy,
  formatCodeBlock as formatCodeBlockLegacy,
  highlightCodeBlocks,
  coffeeTheme,
  defaultTheme as highlightTheme,
  type HighlightTheme,
  type LanguageRules,
} from "./highlight.js";

// Fuzzy search and autocomplete
export {
  fuzzyScore,
  fuzzyMatchIndices,
  fuzzySearch,
  getCommandSuggestions,
  getPathSuggestions,
  searchHistory,
  highlightMatches,
  formatAutocompleteDropdown,
  formatInlineSuggestion,
  getAutocompleteSuggestions,
  type FuzzyMatch,
  type AutocompleteItem,
  type AutocompleteConfig,
} from "./fuzzy.js";

// Multi-line input
export {
  MultilineInput,
  getMultilineInput,
  resetMultilineInput,
  formatMultilineHint,
  isMultilineString,
  formatMultilineDisplay,
  type MultilineConfig,
  type MultilineState,
} from "./multiline.js";

// Token display (legacy)
export {
  TokenCounter,
  getTokenCounter,
  resetTokenCounter,
  formatTokenCount as formatTokenCountLegacy,
  formatCost,
  formatInlineTokens,
  formatFullTokens,
  formatTokenSummary,
  formatStatusBarTokens,
  formatTokenProgress,
  calculateContextWindow,
  formatContextWindow,
  type TokenStats as LegacyTokenStats,
  type TokenDisplayConfig,
  type ContextWindow,
} from "./tokens.js";

// Legacy notifications
export {
  NotificationSender,
  getNotificationSender,
  resetNotificationSender,
  notifyTaskComplete,
  notifyResponseReady,
  notifyError as notifyErrorLegacy,
  formatNotificationStatus,
  formatNotificationSettings,
  type NotificationConfig,
  type Notification,
} from "./notifications.js";
