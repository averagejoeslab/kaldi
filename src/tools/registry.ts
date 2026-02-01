import type {
  ToolDefinition,
  ToolRegistry,
  ToolExecutionResult,
} from "./types.js";

export class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(
    name: string,
    args: Record<string, unknown>
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
      return await tool.execute(args);
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
