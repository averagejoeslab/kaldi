/**
 * Commands Index
 *
 * Central entry point for the command system.
 * Registers all commands and exports the public API.
 */

import {
  registerCommand,
  getCommand,
  hasCommand,
  executeCommand,
  getAllCommands,
  isCommand,
} from "./registry.js";

// Import commands from domain modules
import { helpCommand, statusCommand } from "./help.js";
import {
  clearCommand,
  historyCommand,
  resumeCommand,
  exportCommand,
  deleteCommand,
} from "./session.js";
import { initCommand, memoryCommand } from "./context.js";
import { configCommand, providersCommand, modelCommand } from "./config.js";
import {
  doctorCommand,
  compactCommand,
  copyCommand,
  costCommand,
  versionCommand,
  exitCommand,
  modeCommand,
  contextCommand,
} from "./utility.js";
import { toolsCommand, permissionsCommand, mcpCommand } from "./tools.js";
import {
  gitStatusCommand,
  gitDiffCommand,
  gitCommitCommand,
  gitLogCommand,
  gitBranchCommand,
  prCommand,
} from "./git.js";

// Re-export types
export type {
  Command,
  CommandHandler,
  CommandContext,
  CommandResult,
} from "./types.js";

// Re-export registry functions
export {
  registerCommand,
  getCommand,
  hasCommand,
  executeCommand,
  getAllCommands,
  isCommand,
};

/**
 * Initialize all built-in commands
 */
export function initializeCommands(): void {
  // Core commands
  registerCommand(helpCommand);
  registerCommand(statusCommand);
  registerCommand(exitCommand);

  // Session commands
  registerCommand(clearCommand);
  registerCommand(historyCommand);
  registerCommand(resumeCommand);
  registerCommand(exportCommand);
  registerCommand(deleteCommand);

  // Context commands
  registerCommand(initCommand);
  registerCommand(memoryCommand);

  // Config commands
  registerCommand(configCommand);
  registerCommand(providersCommand);
  registerCommand(modelCommand);

  // Utility commands
  registerCommand(doctorCommand);
  registerCommand(compactCommand);
  registerCommand(copyCommand);
  registerCommand(costCommand);
  registerCommand(versionCommand);
  registerCommand(modeCommand);
  registerCommand(contextCommand);

  // Tools commands
  registerCommand(toolsCommand);
  registerCommand(permissionsCommand);
  registerCommand(mcpCommand);

  // Git commands
  registerCommand(gitStatusCommand);
  registerCommand(gitDiffCommand);
  registerCommand(gitCommitCommand);
  registerCommand(gitLogCommand);
  registerCommand(gitBranchCommand);
  registerCommand(prCommand);
}

// Auto-initialize commands on import
initializeCommands();
