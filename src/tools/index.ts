import { DefaultToolRegistry } from "./registry.js";
import { readFileTool, writeFileTool, editFileTool } from "./file.js";
import { bashTool } from "./bash.js";
import { globTool, grepTool } from "./search.js";

export * from "./types.js";
export * from "./registry.js";

export function createDefaultRegistry(): DefaultToolRegistry {
  const registry = new DefaultToolRegistry();

  // File operations
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);

  // Shell
  registry.register(bashTool);

  // Search
  registry.register(globTool);
  registry.register(grepTool);

  return registry;
}

// Convert registry tools to provider format
export function toolsToProviderFormat(
  registry: DefaultToolRegistry
): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: Object.fromEntries(
      Object.entries(tool.parameters).map(([key, param]) => [
        key,
        {
          type: param.type,
          description: param.description,
        },
      ])
    ),
  }));
}
