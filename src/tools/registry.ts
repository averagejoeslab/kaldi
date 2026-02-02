/**
 * Tool Registry
 *
 * Central registry for all available tools.
 */

import type {
  ToolDefinition,
  ToolRegistry,
  ToolExecutionResult,
  ToolContext,
} from "./types.js";
import { toolToProviderFormat } from "./types.js";
import type { ToolDefinition as ProviderToolDefinition } from "../providers/types.js";

export class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        output: "",
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      return await tool.execute(args, context);
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get tools in provider format
   */
  toProviderFormat(): ProviderToolDefinition[] {
    return this.list().map(toolToProviderFormat);
  }

  /**
   * Get tools that require permission
   */
  getPermissionRequired(): ToolDefinition[] {
    return this.list().filter((t) => t.requiresPermission);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let registry: DefaultToolRegistry | null = null;

export function getToolRegistry(): DefaultToolRegistry {
  if (!registry) {
    registry = new DefaultToolRegistry();
  }
  return registry;
}

export function resetToolRegistry(): void {
  registry = null;
}
