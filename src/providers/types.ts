// Provider abstraction for BYOK (Bring Your Own Key)

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  result: string;
  isError?: boolean;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  error?: string;
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

export interface Provider {
  name: string;

  // Stream a completion response
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  // List available models for this provider
  listModels(): Promise<string[]>;

  // Validate the API key
  validateKey(): Promise<boolean>;
}

export type ProviderType = "anthropic" | "openai" | "ollama" | "openrouter";
