/**
 * OpenRouter Provider
 *
 * Implementation for multiple models via OpenRouter API.
 * Uses OpenAI-compatible API format.
 */

import OpenAI from "openai";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallbacks,
  ToolDefinition,
  ContentBlock,
  Message,
} from "./types.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

export class OpenRouterProvider implements Provider {
  name = "openrouter";
  private client: OpenAI;
  private model: string;
  private apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey || "";
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://kaldi.dev",
        "X-Title": "Kaldi CLI",
      },
    });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(
    request: CompletionRequest,
    callbacks?: StreamCallbacks
  ): Promise<CompletionResponse> {
    const tools = request.tools?.map((tool) => this.convertTool(tool));
    const messages = this.convertMessages(
      request.messages,
      request.systemPrompt
    );

    const stream = await this.client.chat.completions.create({
      model: request.model || this.model,
      max_tokens: request.maxTokens ?? 8192,
      messages,
      tools: tools?.length ? tools : undefined,
      stream: true,
    });

    const contentBlocks: ContentBlock[] = [];
    let textContent = "";
    const toolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          textContent += delta.content;
          callbacks?.onText?.(delta.content);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCalls.get(tc.index);
            if (existing) {
              if (tc.function?.arguments) {
                existing.arguments += tc.function.arguments;
              }
            } else {
              toolCalls.set(tc.index, {
                id: tc.id ?? `tool_${Date.now()}_${tc.index}`,
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            }
          }
        }
      }

      if (textContent) {
        contentBlocks.push({ type: "text", text: textContent });
      }

      for (const tc of toolCalls.values()) {
        let input: Record<string, unknown> = {};
        try {
          input = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          // Invalid JSON
        }

        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input,
        });

        callbacks?.onToolUse?.({ id: tc.id, name: tc.name, input });
      }

      return {
        id: `openrouter-${Date.now()}`,
        model: request.model || this.model,
        content: contentBlocks,
        stopReason: toolCalls.size > 0 ? "tool_use" : "end_turn",
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    } catch (error) {
      callbacks?.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    return [
      "anthropic/claude-sonnet-4-20250514",
      "anthropic/claude-opus-4-20250514",
      "openai/gpt-4o",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct",
    ];
  }

  async validateKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private convertTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.input_schema.properties,
          required: tool.input_schema.required || [],
        },
      },
    };
  }

  private convertMessages(
    messages: Message[],
    systemPrompt?: string
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        result.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      } else {
        const textParts = msg.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        if (textParts) {
          result.push({
            role: msg.role as "user" | "assistant",
            content: textParts,
          });
        }
      }
    }

    return result;
  }
}

export function createOpenRouterProvider(config?: ProviderConfig): Provider {
  return new OpenRouterProvider(config);
}
