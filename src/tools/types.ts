// Tool system types

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  execute: (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
}

export interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  list(): ToolDefinition[];
  execute(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult>;
}
