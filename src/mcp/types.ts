/**
 * MCP Types
 *
 * Type definitions for Model Context Protocol integration.
 */

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Command to run the server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Whether the server is enabled */
  enabled?: boolean;
}

/**
 * MCP server status
 */
export type MCPServerStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * MCP server state
 */
export interface MCPServerState {
  /** Server configuration */
  config: MCPServerConfig;
  /** Current status */
  status: MCPServerStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Available tools from this server */
  tools: MCPTool[];
  /** Available resources from this server */
  resources: MCPResource[];
  /** Available prompts from this server */
  prompts: MCPPrompt[];
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Server that provides this tool */
  serverName: string;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** Server that provides this resource */
  serverName: string;
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: MCPPromptArgument[];
  /** Server that provides this prompt */
  serverName: string;
}

/**
 * MCP prompt argument
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether the argument is required */
  required?: boolean;
}

/**
 * MCP tool call request
 */
export interface MCPToolCallRequest {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * MCP tool call result
 */
export interface MCPToolCallResult {
  /** Whether the call succeeded */
  success: boolean;
  /** Result content */
  content?: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  /** Error message if call failed */
  error?: string;
  /** Whether this is an error result */
  isError?: boolean;
}

/**
 * MCP resource read result
 */
export interface MCPResourceReadResult {
  /** Resource contents */
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

/**
 * MCP prompt get result
 */
export interface MCPPromptGetResult {
  /** Prompt description */
  description?: string;
  /** Prompt messages */
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
  }>;
}

/**
 * MCP message types for JSON-RPC communication
 */
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}
