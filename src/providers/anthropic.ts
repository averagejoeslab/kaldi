import Anthropic from "@anthropic-ai/sdk";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  StreamChunk,
  Tool,
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

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const tools = request.tools?.map((tool) => this.convertTool(tool));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 8192,
      system: request.systemPrompt,
      messages: request.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      tools: tools as Anthropic.Tool[],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if ("text" in delta) {
          yield { type: "text", content: delta.text };
        } else if ("partial_json" in delta) {
          // Tool input streaming - we'll collect this
          yield { type: "text", content: delta.partial_json };
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield {
            type: "tool_call",
            toolCall: {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: {},
            },
          };
        }
      } else if (event.type === "message_stop") {
        yield { type: "done" };
      }
    }
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
        type: "object",
        properties: tool.parameters,
        required: Object.keys(tool.parameters),
      },
    };
  }
}
