/**
 * Core module exports for Kaldi CLI
 */

export {
  // Classes
  BackgroundTask,
  TaskManager,
  ToolHistory,
  // Singletons
  taskManager,
  toolHistory,
  // Types
  type TaskStatus,
  type ToolUse,
  type BackgroundTaskConfig,
  type TaskOutput,
  // Helpers
  createBackgroundableOperation,
  toggleVerboseMode,
  formatKeyboardHints,
  // Theme constants
  taskColors,
  taskSymbols,
} from "./tasks.js";

export {
  // Classes
  SubAgent,
  SubAgentManager,
  // Factory functions
  createExploreAgent,
  createPlanAgent,
  createTaskTool,
  // Singletons
  subAgentManager,
  getSubAgentManager,
  resetSubAgentManager,
  // Types
  type SubAgentConfig,
  type SubAgentResult,
  type SubAgentRunOptions,
  type ExploreSpeed,
  type PermissionMode,
  type ExecutionMode,
  type ToolRestrictions,
  type BackgroundTask as SubAgentBackgroundTask,
} from "./subagents.js";

export {
  // Types
  type Skill,
  type SkillConfig,
  type SkillExecutionResult,
  type MemoryFile,
  type MemoryResult,

  // Memory functions
  loadKaldiMemory,
  editMemory,
  saveMemory,
  formatMemoryInfo,

  // Skills manager class
  SkillsManager,
  getSkillsManager,
  createSkillsManager,
  skillsManager,

  // Skill utilities
  isSkillCommand,
  executeSkillCommand,
  installBuiltinSkills,
} from "./skills.js";

export {
  // Types
  type HookEvent,
  type HookConfig,
  type HookInput,
  type HookResult,
  type HooksConfig,

  // Hooks manager
  HooksManager,
  getHooksManager,
  resetHooksManager,
  hooksManager,

  // Helpers
  createDefaultHooksConfig,
  validateHookConfig,
} from "./hooks.js";

export {
  // Types
  type AgentMode,
  type PlanTrigger,
  type StepStatus,
  type PlanStep,
  type Plan,
  type PlannerConfig,

  // Planner class
  Planner,
  getPlanner,
  resetPlanner,

  // Constants
  plannerColors,
  MODE_ICONS,
  STATUS_ICONS,
  PLANNING_PATTERNS,
  IMMEDIATE_PATTERNS,
} from "./planner.js";

export {
  // Types
  type MemoryFile,
  type MemoryConfig,
  type MemoryResult,

  // Functions
  loadMemory,
  hasMemory,
  getMemoryPath,
  createMemory,
  ensureGlobalMemory,
  updateMemory,
  appendToMemory,
  formatMemoryInfo,
  buildMemoryPrompt,

  // Constants
  DEFAULT_KALDI_MD,
  DEFAULT_GLOBAL_MD,
  MEMORY_FILENAMES,
  GLOBAL_MEMORY_PATH,
  USER_MEMORY_PATH,
} from "./memory.js";

export {
  // Types
  type MCPServerConfig,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type MCPServerState,
  type MCPConfig,

  // Classes
  MCPClient,

  // Functions
  loadMCPConfig,
  saveMCPConfig,
  addMCPServer,
  removeMCPServer,
  getMCPClient,
  resetMCPClient,
  initializeMCPServers,
  formatMCPStatus,
} from "./mcp.js";

export {
  // Types
  type CompactionConfig,
  type CompactionResult,
  type ConversationState,

  // Classes
  CompactionManager,

  // Functions
  estimateTokens,
  estimateMessageTokens,
  estimateTotalTokens,
  getCompactionManager,
  resetCompactionManager,
  buildSummarizationPrompt,
  formatCompactionNotification,
  formatContextBar,
  formatCompactionHistory,

  // Constants
  COMPACTION_PROMPT,
} from "./compaction.js";

export {
  // Types
  type PermissionRule,
  type PermissionRequest,
  type PermissionDecision,
  type PermissionConfig,

  // Classes
  PermissionManager,

  // Functions
  getPermissionManager,
  resetPermissionManager,
  formatPermissionRules,
  formatSessionPermissions,
  formatPermissionOptions,
} from "./permissions.js";

export {
  // Types
  type ExportMessage,
  type ToolCallExport,
  type ExportMetadata,
  type ExportConfig,
  type ExportResult,

  // Functions
  exportToMarkdown,
  exportToJSON,
  exportToHTML,
  exportToFile,
  formatExportResult,
  formatExportOptions,
} from "./export.js";

export {
  // Types
  type ValidationResult,
  type ValidationConfig,

  // Functions
  validateApiKey,
  validateKeyFormat,
  formatValidationResult,
  formatValidationProgress,
} from "./validation.js";
