/**
 * Ollama Provider
 *
 * Implementation for local models via Ollama.
 * Uses OpenAI-compatible API format.
 */

import OpenAI from "openai";
import type {
  Provider,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamCallbacks,
  ContentBlock,
  Message,
} from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODEL = "llama3.2";

export class OllamaProvider implements Provider {
  name = "ollama";
  private client: OpenAI;
  private model: string;
  private baseUrl: string;

  constructor(config: ProviderConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.client = new OpenAI({
      apiKey: "ollama", // Ollama doesn't need a real key
      baseURL: this.baseUrl,
    });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    // Ollama is configured if the server is reachable
    return true;
  }

  async complete(
    request: CompletionRequest,
    callbacks?: StreamCallbacks
  ): Promise<CompletionResponse> {
    const messages = this.convertMessages(
      request.messages,
      request.systemPrompt
    );

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model || this.model,
        messages,
        stream: true,
      });

      const contentBlocks: ContentBlock[] = [];
      let textContent = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          textContent += delta.content;
          callbacks?.onText?.(delta.content);
        }
      }

      if (textContent) {
        contentBlocks.push({ type: "text", text: textContent });
      }

      return {
        id: `ollama-${Date.now()}`,
        model: request.model || this.model,
        content: contentBlocks,
        stopReason: "end_turn",
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
    try {
      // Use Ollama's native API for listing models
      const response = await fetch(
        this.baseUrl.replace("/v1", "") + "/api/tags"
      );
      if (!response.ok) return this.defaultModels();

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return (data.models || []).map((m) => m.name);
    } catch {
      return this.defaultModels();
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await fetch(
        this.baseUrl.replace("/v1", "") + "/api/tags"
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private defaultModels(): string[] {
    return ["llama3.2", "codellama", "mistral", "deepseek-coder"];
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

export function createOllamaProvider(config?: ProviderConfig): Provider {
  return new OllamaProvider(config);
}
