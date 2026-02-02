/**
 * Providers Module
 *
 * LLM provider abstraction layer.
 */

export * from "./types.js";
export { AnthropicProvider, createAnthropicProvider } from "./anthropic.js";
export { OpenAIProvider, createOpenAIProvider } from "./openai.js";
export { OpenRouterProvider, createOpenRouterProvider } from "./openrouter.js";
export { OllamaProvider, createOllamaProvider } from "./ollama.js";
export {
  validateApiKey,
  validateKeyFormat,
  formatValidationResult,
  type ValidationResult,
} from "./validation.js";

import type { Provider, ProviderConfig, ProvidersConfig, ProviderType } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import { OllamaProvider } from "./ollama.js";

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

const providers: Map<string, Provider> = new Map();

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
      return new OpenRouterProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

export function getProvider(name: string, config?: ProvidersConfig): Provider {
  const cached = providers.get(name);
  if (cached) return cached;

  const providerConfig = config?.[name as ProviderType];
  const provider = createProvider(name as ProviderType, providerConfig || {});

  providers.set(name, provider);
  return provider;
}

export function initializeProviders(config: ProvidersConfig): void {
  providers.clear();

  if (config.anthropic?.apiKey) {
    providers.set("anthropic", new AnthropicProvider(config.anthropic));
  }
  if (config.openai?.apiKey) {
    providers.set("openai", new OpenAIProvider(config.openai));
  }
  if (config.openrouter?.apiKey) {
    providers.set("openrouter", new OpenRouterProvider(config.openrouter));
  }
  // Ollama doesn't need API key
  providers.set("ollama", new OllamaProvider(config.ollama));
}

export function getConfiguredProviders(): string[] {
  return Array.from(providers.entries())
    .filter(([_, p]) => p.isConfigured())
    .map(([name]) => name);
}

export function getDefaultProvider(config: ProvidersConfig): Provider | null {
  const name = config.default;
  if (!name) return null;

  try {
    return getProvider(name, config);
  } catch {
    return null;
  }
}

export function resetProviders(): void {
  providers.clear();
}
