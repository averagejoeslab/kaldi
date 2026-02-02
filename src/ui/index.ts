export * from "./diff.js";
export {
  KaldiSpinner,
  createSpinner,
  type SpinnerOptions,
  status as spinnerStatus,
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
  formatDuration,
} from "./status.js";
export * from "./clipboard.js";
export * from "./input.js";
export * from "./terminal.js";
export * from "./keyboard.js";
export * from "./vim.js";
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
  formatTaskList,
  formatTaskStatus,
  formatTaskCompletion,
  isBackgroundKey,
  formatBackgroundHint,
  type BackgroundTaskUI,
  type BackgroundUIConfig,
} from "./background.js";

// Syntax highlighting
export {
  highlight,
  detectLanguage,
  formatCodeBlock,
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
  formatTokenCount,
  formatCost,
  formatInlineTokens,
  formatFullTokens,
  formatTokenSummary,
  formatStatusBarTokens,
  formatTokenProgress,
  calculateContextWindow,
  formatContextWindow,
  type TokenStats,
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
  notifyError,
  formatNotificationStatus,
  formatNotificationSettings,
  type NotificationConfig,
  type Notification,
} from "./notifications.js";
