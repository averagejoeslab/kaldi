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
