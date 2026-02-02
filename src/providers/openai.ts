/**
 * OpenAI Provider
 *
 * Implementation for GPT models via OpenAI SDK.
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

const DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider implements Provider {
  name = "openai";
  private client: OpenAI;
  private model: string;
  private apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey || "";
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: config.baseUrl,
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
    let totalTokens = 0;

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const usage = chunk.usage;

        if (usage) {
          totalTokens = usage.total_tokens || 0;
        }

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

      // Add text content if present
      if (textContent) {
        contentBlocks.push({ type: "text", text: textContent });
      }

      // Add tool calls
      for (const tc of toolCalls.values()) {
        let input: Record<string, unknown> = {};
        try {
          input = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          // Invalid JSON, use empty object
        }

        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input,
        });

        callbacks?.onToolUse?.({
          id: tc.id,
          name: tc.name,
          input,
        });
      }

      const stopReason = toolCalls.size > 0 ? "tool_use" : "end_turn";

      return {
        id: `openai-${Date.now()}`,
        model: request.model || this.model,
        content: contentBlocks,
        stopReason,
        usage: {
          inputTokens: 0, // OpenAI streaming doesn't provide this easily
          outputTokens: totalTokens,
        },
      };
    } catch (error) {
      callbacks?.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.apiKey) return [];

    try {
      const models = await this.client.models.list();
      return models.data
        .filter((m) => m.id.includes("gpt") || m.id.includes("o1"))
        .map((m) => m.id)
        .sort();
    } catch {
      return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];
    }
  }

  async validateKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      await this.client.models.list();
      return true;
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
        // Handle content blocks
        if (msg.role === "assistant") {
          const textParts = msg.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { type: "text"; text: string }).text)
            .join("");

          const toolCalls = msg.content
            .filter((b) => b.type === "tool_use")
            .map((b) => {
              const tu = b as {
                type: "tool_use";
                id: string;
                name: string;
                input: Record<string, unknown>;
              };
              return {
                id: tu.id,
                type: "function" as const,
                function: {
                  name: tu.name,
                  arguments: JSON.stringify(tu.input),
                },
              };
            });

          result.push({
            role: "assistant",
            content: textParts || null,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          });
        } else if (msg.role === "user") {
          // Tool results go in separate tool messages
          const toolResults = msg.content.filter(
            (b) => b.type === "tool_result"
          );
          const textParts = msg.content.filter((b) => b.type === "text");

          for (const tr of toolResults) {
            const toolResult = tr as {
              type: "tool_result";
              tool_use_id: string;
              content: string;
              is_error?: boolean;
            };
            result.push({
              role: "tool",
              tool_call_id: toolResult.tool_use_id,
              content: toolResult.content,
            });
          }

          if (textParts.length > 0) {
            result.push({
              role: "user",
              content: textParts
                .map((b) => (b as { type: "text"; text: string }).text)
                .join(""),
            });
          }
        }
      }
    }

    return result;
  }
}

export function createOpenAIProvider(config?: ProviderConfig): Provider {
  return new OpenAIProvider(config);
}
