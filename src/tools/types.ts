/**
 * Tool System Types
 *
 * Common interfaces for the tool system.
 */

import type { ToolDefinition as ProviderToolDefinition } from "../providers/types.js";

// ============================================================================
// PARAMETER TYPES
// ============================================================================

export interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolContext {
  cwd: string;
  env: Record<string, string | undefined>;
  abortSignal?: AbortSignal;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  requiresPermission?: boolean;
  execute: (
    args: Record<string, unknown>,
    context?: ToolContext
  ) => Promise<ToolExecutionResult>;
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  get(name: string): ToolDefinition | undefined;
  has(name: string): boolean;
  list(): ToolDefinition[];
  execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolExecutionResult>;
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Convert tool parameters to JSON Schema format for providers
 */
export function parametersToJsonSchema(
  parameters: Record<string, ParameterDefinition>
): ProviderToolDefinition["input_schema"] {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, param] of Object.entries(parameters)) {
    properties[name] = {
      type: param.type,
      description: param.description,
      ...(param.enum && { enum: param.enum }),
      ...(param.default !== undefined && { default: param.default }),
    };

    if (param.required) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Convert tool definition to provider format
 */
export function toolToProviderFormat(tool: ToolDefinition): ProviderToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: parametersToJsonSchema(tool.parameters),
  };
}
