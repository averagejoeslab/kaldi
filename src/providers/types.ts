// Provider abstraction for BYOK (Bring Your Own Key)

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

export type ContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompletionRequest {
  messages: Message[];
  tools?: Tool[];
  systemPrompt?: string;
  maxTokens?: number;
}

export interface CompletionResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (tool: ToolCall) => void;
}

export interface Provider {
  name: string;

  // Complete a message (supports tool use)
  complete(request: CompletionRequest, callbacks?: StreamCallbacks): Promise<CompletionResponse>;

  // List available models for this provider
  listModels(): Promise<string[]>;

  // Validate the API key
  validateKey(): Promise<boolean>;
}

export type ProviderType = "anthropic" | "openai" | "ollama" | "openrouter";
