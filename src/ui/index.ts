/**
 * UI Module
 *
 * All user interface components and formatting.
 */

// Theme (single source of truth for colors)
export * from "./theme/index.js";

// Format functions
export * from "./format/index.js";

// Dynamic UI components (spinners, thinking display, etc.)
export * from "./dynamic/index.js";

// Desktop notifications
export { notify, notifyComplete, notifyError } from "./notifications.js";

// Core exports
export * from "./clipboard.js";
export * from "./terminal.js";
export * from "./tool-tree.js";
export * from "./statusline.js";
export * from "./enhanced-input.js";
export * from "./keyboard.js";

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

// Token display
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

// Notifications
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
