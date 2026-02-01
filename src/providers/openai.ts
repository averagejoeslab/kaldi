import OpenAI from "openai";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  StreamChunk,
  Tool,
} from "./types.js";

export class OpenAIProvider implements Provider {
  name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? "gpt-4o";
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const tools = request.tools?.map((tool) => this.convertTool(tool));

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    for (const m of request.messages) {
      messages.push({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      });
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 8192,
      messages,
      tools: tools?.length ? tools : undefined,
      stream: true,
    });

    let currentToolCall: { id: string; name: string; arguments: string } | null =
      null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.function?.name) {
            currentToolCall = {
              id: toolCall.id ?? `tool_${Date.now()}`,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments ?? "",
            };
          } else if (toolCall.function?.arguments && currentToolCall) {
            currentToolCall.arguments += toolCall.function.arguments;
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolCall) {
        yield {
          type: "tool_call",
          toolCall: {
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: JSON.parse(currentToolCall.arguments),
          },
        };
        currentToolCall = null;
      }

      if (chunk.choices[0]?.finish_reason === "stop") {
        yield { type: "done" };
      }
    }
  }

  async listModels(): Promise<string[]> {
    const models = await this.client.models.list();
    return models.data
      .filter((m) => m.id.includes("gpt"))
      .map((m) => m.id)
      .sort();
  }

  async validateKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private convertTool(tool: Tool): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.parameters,
          required: Object.keys(tool.parameters),
        },
      },
    };
  }
}
