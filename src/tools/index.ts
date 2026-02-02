/**
 * Tools Module
 *
 * Tool system for the agent.
 */

export * from "./types.js";
export { DefaultToolRegistry, getToolRegistry, resetToolRegistry } from "./registry.js";
export { bashTool } from "./bash.js";
export { readFileTool, writeFileTool, editFileTool } from "./file.js";
export { globTool, grepTool } from "./search.js";
export { listDirTool } from "./list-dir.js";
export { webFetchTool } from "./web.js";

import { DefaultToolRegistry, getToolRegistry } from "./registry.js";
import { bashTool } from "./bash.js";
import { readFileTool, writeFileTool, editFileTool } from "./file.js";
import { globTool, grepTool } from "./search.js";
import { listDirTool } from "./list-dir.js";
import { webFetchTool } from "./web.js";

/**
 * Create a registry with all default tools registered
 */
export function createDefaultRegistry(): DefaultToolRegistry {
  const registry = new DefaultToolRegistry();

  // File operations
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);

  // Directory
  registry.register(listDirTool);

  // Shell
  registry.register(bashTool);

  // Search
  registry.register(globTool);
  registry.register(grepTool);

  // Web
  registry.register(webFetchTool);

  return registry;
}

/**
 * Initialize the global tool registry with default tools
 */
export function initializeTools(): DefaultToolRegistry {
  const registry = getToolRegistry();

  // Register all default tools
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(listDirTool);
  registry.register(bashTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(webFetchTool);

  return registry;
}
