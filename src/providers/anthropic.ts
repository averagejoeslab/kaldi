import Anthropic from "@anthropic-ai/sdk";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallbacks,
  Tool,
  ContentBlock,
  Message,
} from "./types.js";

export class AnthropicProvider implements Provider {
  name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? "claude-sonnet-4-20250514";
  }

  async complete(
    request: CompletionRequest,
    callbacks?: StreamCallbacks
  ): Promise<CompletionResponse> {
    const tools = request.tools?.map((tool) => this.convertTool(tool));

    // Convert messages to Anthropic format
    const messages = request.messages.map((m) => this.convertMessage(m));

    // Use streaming for text output but collect full response
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 8192,
      system: request.systemPrompt,
      messages,
      tools: tools?.length ? (tools as Anthropic.Tool[]) : undefined,
    });

    const contentBlocks: ContentBlock[] = [];
    let currentTextBlock: { type: "text"; text: string } | null = null;
    let currentToolBlock: {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    } | null = null;
    let toolInputJson = "";

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          currentTextBlock = { type: "text", text: "" };
        } else if (event.content_block.type === "tool_use") {
          currentToolBlock = {
            type: "tool_use",
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
        } else if (event.delta.type === "input_json_delta" && currentToolBlock) {
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
            currentToolBlock.input = toolInputJson ? JSON.parse(toolInputJson) : {};
          } catch {
            currentToolBlock.input = {};
          }
          contentBlocks.push(currentToolBlock);
          callbacks?.onToolUse?.({
            id: currentToolBlock.id,
            name: currentToolBlock.name,
            input: currentToolBlock.input,
          });
          currentToolBlock = null;
          toolInputJson = "";
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    return {
      content: contentBlocks,
      stopReason: this.mapStopReason(finalMessage.stop_reason),
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    };
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-5-haiku-20241022",
    ];
  }

  async validateKey(): Promise<boolean> {
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

  private convertTool(tool: Tool): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: tool.parameters,
        required: Object.keys(tool.parameters),
      },
    };
  }

  private convertMessage(message: Message): Anthropic.MessageParam {
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: message.content,
      };
    }

    // Convert content blocks
    const content: Anthropic.ContentBlockParam[] = message.content.map((block) => {
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
    });

    return {
      role: message.role,
      content,
    };
  }

  private mapStopReason(
    reason: string | null
  ): "end_turn" | "tool_use" | "max_tokens" | "error" {
    switch (reason) {
      case "end_turn":
        return "end_turn";
      case "tool_use":
        return "tool_use";
      case "max_tokens":
        return "max_tokens";
      default:
        return "error";
    }
  }
}
