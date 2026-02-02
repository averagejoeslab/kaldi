/**
 * API Key Validation
 *
 * Test API keys before saving to ensure they work.
 */

import { c } from "../ui/theme/colors.js";
import { sym } from "../ui/theme/symbols.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  provider: string;
  model?: string;
  error?: string;
  latency?: number;
}

// ============================================================================
// VALIDATORS
// ============================================================================

export async function validateApiKey(
  provider: string,
  apiKey: string,
  timeout = 10000
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    switch (provider.toLowerCase()) {
      case "anthropic":
        return await validateAnthropic(apiKey, timeout);
      case "openai":
        return await validateOpenAI(apiKey, timeout);
      case "openrouter":
        return await validateOpenRouter(apiKey, timeout);
      case "ollama":
        return await validateOllama(timeout);
      default:
        return {
          valid: false,
          provider,
          error: `Unknown provider: ${provider}`,
        };
    }
  } catch (error) {
    return {
      valid: false,
      provider,
      error: error instanceof Error ? error.message : String(error),
      latency: Date.now() - startTime,
    };
  }
}

async function validateAnthropic(
  apiKey: string,
  timeout: number
): Promise<ValidationResult> {
  const startTime = Date.now();

  if (!apiKey.startsWith("sk-ant-")) {
    return {
      valid: false,
      provider: "anthropic",
      error: "Invalid key format. Anthropic keys start with 'sk-ant-'",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (response.ok || response.status === 429) {
      return {
        valid: true,
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        latency,
        ...(response.status === 429 && { error: "Rate limited" }),
      };
    }

    if (response.status === 401) {
      return {
        valid: false,
        provider: "anthropic",
        error: "Invalid API key",
        latency,
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      valid: false,
      provider: "anthropic",
      error: data.error?.message || `HTTP ${response.status}`,
      latency,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        provider: "anthropic",
        error: "Request timeout",
        latency: timeout,
      };
    }
    throw error;
  }
}

async function validateOpenAI(
  apiKey: string,
  timeout: number
): Promise<ValidationResult> {
  const startTime = Date.now();

  if (!apiKey.startsWith("sk-")) {
    return {
      valid: false,
      provider: "openai",
      error: "Invalid key format. OpenAI keys start with 'sk-'",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (response.ok || response.status === 429) {
      return { valid: true, provider: "openai", latency };
    }

    if (response.status === 401) {
      return {
        valid: false,
        provider: "openai",
        error: "Invalid API key",
        latency,
      };
    }

    return {
      valid: false,
      provider: "openai",
      error: `HTTP ${response.status}`,
      latency,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        provider: "openai",
        error: "Request timeout",
        latency: timeout,
      };
    }
    throw error;
  }
}

async function validateOpenRouter(
  apiKey: string,
  timeout: number
): Promise<ValidationResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (response.ok) {
      return { valid: true, provider: "openrouter", latency };
    }

    if (response.status === 401) {
      return {
        valid: false,
        provider: "openrouter",
        error: "Invalid API key",
        latency,
      };
    }

    return {
      valid: false,
      provider: "openrouter",
      error: `HTTP ${response.status}`,
      latency,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        provider: "openrouter",
        error: "Request timeout",
        latency: timeout,
      };
    }
    throw error;
  }
}

async function validateOllama(timeout: number): Promise<ValidationResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      const models = (data.models || []).map((m) => m.name);
      return {
        valid: true,
        provider: "ollama",
        model: models[0],
        latency,
      };
    }

    return {
      valid: false,
      provider: "ollama",
      error: "Ollama server not responding",
      latency,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        provider: "ollama",
        error: "Request timeout",
        latency: timeout,
      };
    }

    return {
      valid: false,
      provider: "ollama",
      error: "Ollama not running. Start with: ollama serve",
      latency: Date.now() - startTime,
    };
  }
}

// ============================================================================
// FORMAT CHECK (no API call)
// ============================================================================

export function validateKeyFormat(
  provider: string,
  apiKey: string
): { valid: boolean; error?: string } {
  switch (provider.toLowerCase()) {
    case "anthropic":
      if (!apiKey.startsWith("sk-ant-")) {
        return { valid: false, error: "Anthropic keys start with 'sk-ant-'" };
      }
      if (apiKey.length < 40) {
        return { valid: false, error: "API key seems too short" };
      }
      return { valid: true };

    case "openai":
      if (!apiKey.startsWith("sk-")) {
        return { valid: false, error: "OpenAI keys start with 'sk-'" };
      }
      return { valid: true };

    case "openrouter":
      if (!apiKey.startsWith("sk-or-")) {
        return { valid: false, error: "OpenRouter keys start with 'sk-or-'" };
      }
      return { valid: true };

    case "ollama":
      return { valid: true };

    default:
      return { valid: true };
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(c.success(`  ${sym.success} API key is valid`));
    lines.push(c.dim(`    Provider: ${result.provider}`));
    if (result.model) lines.push(c.dim(`    Model: ${result.model}`));
    if (result.latency) lines.push(c.dim(`    Latency: ${result.latency}ms`));
    if (result.error === "Rate limited") {
      lines.push(c.warning(`    ${sym.warning} Currently rate limited`));
    }
  } else {
    lines.push(c.error(`  ${sym.error} Validation failed`));
    lines.push(c.dim(`    Provider: ${result.provider}`));
    if (result.error) lines.push(c.error(`    Error: ${result.error}`));
    if (result.latency) lines.push(c.dim(`    Latency: ${result.latency}ms`));
  }

  return lines.join("\n");
}
