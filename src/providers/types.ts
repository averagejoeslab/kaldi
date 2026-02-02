/**
 * Provider Types
 *
 * Common interface for all LLM providers.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string;
  };
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

export type ContentBlock =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent;

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CompletionRequest {
  model?: string;
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface CompletionResponse {
  id: string;
  model: string;
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "error";
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onThinking?: (thinking: string) => void;
  onToolUse?: (tool: ToolCall) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface Provider {
  name: string;

  /**
   * Complete a message with streaming support
   */
  complete(
    request: CompletionRequest,
    callbacks?: StreamCallbacks
  ): Promise<CompletionResponse>;

  /**
   * List available models for this provider
   */
  listModels(): Promise<string[]>;

  /**
   * Validate the API key
   */
  validateKey(): Promise<boolean>;

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean;
}

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface ProvidersConfig {
  default: ProviderType;
  anthropic?: ProviderConfig;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
  ollama?: ProviderConfig;
}

export type ProviderType = "anthropic" | "openai" | "openrouter" | "ollama";

// ============================================================================
// MODEL LISTS
// ============================================================================

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-3-5-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"],
  openrouter: [
    "anthropic/claude-sonnet-4-20250514",
    "openai/gpt-4o",
    "google/gemini-2.0-flash-001",
  ],
  ollama: ["llama3.2", "codellama", "mistral", "deepseek-coder"],
};
