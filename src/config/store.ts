import Conf from "conf";
import type { ProviderType } from "../providers/types.js";

export interface KaldiConfig {
  provider: ProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface ConfigSchema {
  provider: ProviderType;
  apiKeys: Record<ProviderType, string>;
  models: Record<ProviderType, string>;
  baseUrls: Record<ProviderType, string>;
}

const defaults: ConfigSchema = {
  provider: "anthropic",
  apiKeys: {
    anthropic: "",
    openai: "",
    ollama: "",
    openrouter: "",
  },
  models: {
    anthropic: "claude-sonnet-4-20250514",
    openai: "gpt-4o",
    ollama: "llama3.2",
    openrouter: "anthropic/claude-3.5-sonnet",
  },
  baseUrls: {
    anthropic: "",
    openai: "",
    ollama: "http://localhost:11434/v1",
    openrouter: "https://openrouter.ai/api/v1",
  },
};

const config = new Conf<ConfigSchema>({
  projectName: "kaldi",
  defaults,
});

export function getConfig(): KaldiConfig {
  const provider = config.get("provider");
  return {
    provider,
    apiKey: config.get(`apiKeys.${provider}`) || getEnvApiKey(provider),
    model: config.get(`models.${provider}`),
    baseUrl: config.get(`baseUrls.${provider}`) || undefined,
  };
}

export function setProvider(provider: ProviderType): void {
  config.set("provider", provider);
}

export function setApiKey(provider: ProviderType, apiKey: string): void {
  config.set(`apiKeys.${provider}`, apiKey);
}

export function setModel(provider: ProviderType, model: string): void {
  config.set(`models.${provider}`, model);
}

export function setBaseUrl(provider: ProviderType, baseUrl: string): void {
  config.set(`baseUrls.${provider}`, baseUrl);
}

export function getAllProviderConfigs(): Record<ProviderType, { apiKey: string; model: string }> {
  const providers: ProviderType[] = ["anthropic", "openai", "ollama", "openrouter"];
  const result: Record<string, { apiKey: string; model: string }> = {};

  for (const provider of providers) {
    result[provider] = {
      apiKey: config.get(`apiKeys.${provider}`) ? "****" : getEnvApiKey(provider) ? "(env)" : "(not set)",
      model: config.get(`models.${provider}`),
    };
  }

  return result as Record<ProviderType, { apiKey: string; model: string }>;
}

function getEnvApiKey(provider: ProviderType): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || "";
    case "openai":
      return process.env.OPENAI_API_KEY || "";
    case "openrouter":
      return process.env.OPENROUTER_API_KEY || "";
    case "ollama":
      return "ollama"; // Ollama doesn't need an API key
    default:
      return "";
  }
}

export function isConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.apiKey);
}

export function getConfigPath(): string {
  return config.path;
}
