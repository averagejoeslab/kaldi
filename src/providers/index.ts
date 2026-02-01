import type { Provider, ProviderConfig, ProviderType } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";

export * from "./types.js";

export function createProvider(
  type: ProviderType,
  config: ProviderConfig
): Provider {
  switch (type) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "openrouter":
      // OpenRouter uses OpenAI-compatible API
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl ?? "https://openrouter.ai/api/v1",
      });
    case "ollama":
      // Ollama uses OpenAI-compatible API
      return new OpenAIProvider({
        ...config,
        apiKey: config.apiKey || "ollama",
        baseUrl: config.baseUrl ?? "http://localhost:11434/v1",
      });
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-3-5-haiku-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"],
  openrouter: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro"],
  ollama: ["llama3.2", "codellama", "mistral", "deepseek-coder"],
};
