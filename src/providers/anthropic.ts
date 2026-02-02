/**
 * Anthropic Provider
 *
 * Implementation for Claude models via Anthropic SDK.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallbacks,
  ToolDefinition,
  ContentBlock,
  Message,
  ToolCall,
} from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class AnthropicProvider implements Provider {
  name = "anthropic";
  private client: Anthropic;
  private model: string;
  private apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey || "";
    this.client = new Anthropic({
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
    const messages = request.messages.map((m) => this.convertMessage(m));

    const stream = this.client.messages.stream({
      model: request.model || this.model,
      max_tokens: request.maxTokens ?? 8192,
      system: request.systemPrompt,
      messages,
      tools: tools?.length ? (tools as Anthropic.Tool[]) : undefined,
    });

    const contentBlocks: ContentBlock[] = [];
    let currentTextBlock: { type: "text"; text: string } | null = null;
    let currentToolBlock: ToolCall | null = null;
    let toolInputJson = "";

    try {
      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "text") {
            currentTextBlock = { type: "text", text: "" };
          } else if (event.content_block.type === "tool_use") {
            currentToolBlock = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            };
            toolInputJson = "";
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta" && currentTextBlock) {
            currentTextBlock.text += event.delta.text;
            callbacks?.onText?.(event.delta.text);
          } else if (
            event.delta.type === "input_json_delta" &&
            currentToolBlock
          ) {
            toolInputJson += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          if (currentTextBlock) {
            if (currentTextBlock.text) {
              contentBlocks.push(currentTextBlock);
            }
            currentTextBlock = null;
          } else if (currentToolBlock) {
            try {
              currentToolBlock.input = toolInputJson
                ? JSON.parse(toolInputJson)
                : {};
            } catch {
              currentToolBlock.input = {};
            }
            contentBlocks.push({
              type: "tool_use",
              id: currentToolBlock.id,
              name: currentToolBlock.name,
              input: currentToolBlock.input,
            });
            callbacks?.onToolUse?.(currentToolBlock);
            currentToolBlock = null;
            toolInputJson = "";
          }
        }
      }

      const finalMessage = await stream.finalMessage();

      return {
        id: finalMessage.id,
        model: finalMessage.model,
        content: contentBlocks,
        stopReason: this.mapStopReason(finalMessage.stop_reason),
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
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
    return [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-haiku-3-5-20241022",
    ];
  }

  async validateKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private convertTool(tool: ToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: tool.input_schema.properties,
        required: tool.input_schema.required || [],
      },
    };
  }

  private convertMessage(message: Message): Anthropic.MessageParam {
    if (typeof message.content === "string") {
      return {
        role: message.role as "user" | "assistant",
        content: message.content,
      };
    }

    const content: Anthropic.ContentBlockParam[] = message.content.map(
      (block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        } else if (block.type === "image") {
          return {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: block.source.media_type,
              data: block.source.data,
            },
          };
        } else if (block.type === "tool_use") {
          return {
            type: "tool_use" as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
        } else if (block.type === "tool_result") {
          return {
            type: "tool_result" as const,
            tool_use_id: block.tool_use_id,
            content: block.content,
            is_error: block.is_error,
          };
        }
        throw new Error(`Unknown content block type`);
      }
    );

    return {
      role: message.role as "user" | "assistant",
      content,
    };
  }

  private mapStopReason(
    reason: string | null
  ): "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "error" {
    switch (reason) {
      case "end_turn":
        return "end_turn";
      case "tool_use":
        return "tool_use";
      case "max_tokens":
        return "max_tokens";
      case "stop_sequence":
        return "stop_sequence";
      default:
        return "error";
    }
  }
}

export function createAnthropicProvider(config?: ProviderConfig): Provider {
  return new AnthropicProvider(config);
}
