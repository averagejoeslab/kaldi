/**
 * API Key Validation
 *
 * Test API keys before saving to ensure they work.
 */

import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  provider: string;
  model?: string;
  error?: string;
  latency?: number;
  rateLimit?: {
    remaining?: number;
    reset?: Date;
  };
}

export interface ValidationConfig {
  timeout?: number;
  testPrompt?: string;
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(
  provider: string,
  apiKey: string,
  config: ValidationConfig = {}
): Promise<ValidationResult> {
  const { timeout = 10000 } = config;

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

/**
 * Validate Anthropic API key
 */
async function validateAnthropic(apiKey: string, timeout: number): Promise<ValidationResult> {
  const startTime = Date.now();

  // Check key format first
  if (!apiKey.startsWith("sk-ant-")) {
    return {
      valid: false,
      provider: "anthropic",
      error: "Invalid key format. Anthropic keys start with 'sk-ant-'",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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

    if (response.ok) {
      return {
        valid: true,
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        latency,
      };
    }

    // Handle specific error codes
    if (response.status === 401) {
      return {
        valid: false,
        provider: "anthropic",
        error: "Invalid API key",
        latency,
      };
    }

    if (response.status === 429) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      return {
        valid: true, // Key is valid but rate limited
        provider: "anthropic",
        error: "Rate limited",
        latency,
        rateLimit: {
          reset: resetHeader ? new Date(resetHeader) : undefined,
        },
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      provider: "anthropic",
      error: (errorData as any).error?.message || `HTTP ${response.status}`,
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

/**
 * Validate OpenAI API key
 */
async function validateOpenAI(apiKey: string, timeout: number): Promise<ValidationResult> {
  const startTime = Date.now();

  // Check key format
  if (!apiKey.startsWith("sk-")) {
    return {
      valid: false,
      provider: "openai",
      error: "Invalid key format. OpenAI keys start with 'sk-'",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        valid: true,
        provider: "openai",
        latency,
      };
    }

    if (response.status === 401) {
      return {
        valid: false,
        provider: "openai",
        error: "Invalid API key",
        latency,
      };
    }

    if (response.status === 429) {
      return {
        valid: true,
        provider: "openai",
        error: "Rate limited",
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

/**
 * Validate OpenRouter API key
 */
async function validateOpenRouter(apiKey: string, timeout: number): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        provider: "openrouter",
        latency,
        rateLimit: {
          remaining: (data as any).data?.rate_limit?.remaining,
        },
      };
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

/**
 * Validate Ollama connection (no API key needed)
 */
async function validateOllama(timeout: number): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = ((data as any).models || []).map((m: any) => m.name);

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
      error: "Ollama server not running. Start it with: ollama serve",
      latency: Date.now() - startTime,
    };
  }
}

// ============================================================================
// KEY FORMAT VALIDATION
// ============================================================================

/**
 * Quick format check without making API call
 */
export function validateKeyFormat(provider: string, apiKey: string): { valid: boolean; error?: string } {
  switch (provider.toLowerCase()) {
    case "anthropic":
      if (!apiKey.startsWith("sk-ant-")) {
        return { valid: false, error: "Anthropic keys should start with 'sk-ant-'" };
      }
      if (apiKey.length < 40) {
        return { valid: false, error: "API key seems too short" };
      }
      return { valid: true };

    case "openai":
      if (!apiKey.startsWith("sk-")) {
        return { valid: false, error: "OpenAI keys should start with 'sk-'" };
      }
      return { valid: true };

    case "openrouter":
      if (!apiKey.startsWith("sk-or-")) {
        return { valid: false, error: "OpenRouter keys should start with 'sk-or-'" };
      }
      return { valid: true };

    case "ollama":
      // Ollama doesn't need an API key
      return { valid: true };

    default:
      return { valid: true }; // Unknown provider, allow any format
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  success: chalk.hex("#7CB342"),
  error: chalk.hex("#E57373"),
  warning: chalk.hex("#DAA520"),
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
};

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(colors.success(`  ✓ API key is valid`));
    lines.push(colors.dim(`    Provider: ${result.provider}`));

    if (result.model) {
      lines.push(colors.dim(`    Model: ${result.model}`));
    }

    if (result.latency) {
      lines.push(colors.dim(`    Latency: ${result.latency}ms`));
    }

    if (result.error === "Rate limited") {
      lines.push(colors.warning(`    ⚠ Currently rate limited`));
    }
  } else {
    lines.push(colors.error(`  ✗ API key validation failed`));
    lines.push(colors.dim(`    Provider: ${result.provider}`));

    if (result.error) {
      lines.push(colors.error(`    Error: ${result.error}`));
    }

    if (result.latency) {
      lines.push(colors.dim(`    Latency: ${result.latency}ms`));
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format validation progress
 */
export function formatValidationProgress(provider: string): string {
  return colors.dim(`  Validating ${provider} API key...`);
}
