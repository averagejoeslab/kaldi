/**
 * Status Line for Kaldi CLI
 *
 * Shows:
 * - Current state (thinking, flowing, etc.)
 * - Duration
 * - Token usage
 * - Mode indicator
 * - Image references
 */

import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface StatusLineConfig {
  /** Current state */
  state: StatusState;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
  /** Current mode */
  mode?: "chat" | "plan" | "execute" | "auto";
  /** Accept edits mode */
  acceptEditsOn?: boolean;
  /** Attached images */
  images?: ImageRef[];
  /** Show keyboard hints */
  showHints?: boolean;
  /** Custom spinner text */
  spinnerText?: string;
}

export type StatusState =
  | "idle"
  | "thinking"
  | "flowing"
  | "reading"
  | "writing"
  | "searching"
  | "running"
  | "waiting"
  | "done"
  | "error";

export interface ImageRef {
  id: number;
  name?: string;
  selected?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const colors = {
  primary: chalk.hex("#C9A66B"),    // Latte
  secondary: chalk.hex("#DAA520"),  // Golden honey
  success: chalk.hex("#7CB342"),    // Green
  warning: chalk.hex("#FFB74D"),    // Orange
  error: chalk.hex("#E57373"),      // Red
  info: chalk.hex("#64B5F6"),       // Blue
  dim: chalk.hex("#A09080"),        // Muted
  text: chalk.hex("#F5F0E6"),       // Cream
  muted: chalk.hex("#6B5B4F"),      // Dark coffee
};

const STATE_CONFIG: Record<StatusState, { icon: string; color: (s: string) => string; text: string }> = {
  idle: { icon: "◯", color: colors.dim, text: "" },
  thinking: { icon: "+", color: colors.secondary, text: "thinking" },
  flowing: { icon: "+", color: colors.primary, text: "Flowing..." },
  reading: { icon: "◉", color: colors.info, text: "Reading..." },
  writing: { icon: "◉", color: colors.warning, text: "Writing..." },
  searching: { icon: "◎", color: colors.info, text: "Searching..." },
  running: { icon: "⚡", color: colors.secondary, text: "Running..." },
  waiting: { icon: "◯", color: colors.dim, text: "Waiting..." },
  done: { icon: "✓", color: colors.success, text: "Done" },
  error: { icon: "✗", color: colors.error, text: "Error" },
};

const MODE_LABELS: Record<string, string> = {
  chat: "chat",
  plan: "plan mode",
  execute: "executing",
  auto: "accept edits on",
};

// ============================================================================
// STATUS LINE RENDERER
// ============================================================================

/**
 * Render the status line
 */
export function renderStatusLine(config: StatusLineConfig): string {
  const parts: string[] = [];

  // State indicator with spinner text
  const stateConfig = STATE_CONFIG[config.state];
  if (config.state !== "idle") {
    const spinnerText = config.spinnerText || stateConfig.text;
    parts.push(stateConfig.color(`${stateConfig.icon} ${spinnerText}`));
  }

  // Duration
  if (config.durationMs !== undefined && config.durationMs > 0) {
    parts.push(formatDuration(config.durationMs));
  }

  // Token usage
  if (config.inputTokens !== undefined || config.outputTokens !== undefined) {
    const tokens = formatTokens(config.inputTokens, config.outputTokens);
    parts.push(tokens);
  }

  // Thinking indicator (separate from state)
  if (config.state === "thinking" || config.state === "flowing") {
    parts.push(colors.dim("thinking"));
  }

  // Build main status
  let statusLine = parts.length > 0 ? parts.join(colors.dim(" · ")) : "";

  // Image references on separate line if present
  const imageLineItems: string[] = [];
  if (config.images && config.images.length > 0) {
    const imageRefs = config.images
      .map((img) => {
        const label = `[Image #${img.id}]`;
        return img.selected ? colors.primary(label) : colors.dim(label);
      })
      .join(" ");
    imageLineItems.push(imageRefs);
    imageLineItems.push(colors.muted("(↑ to select)"));
  }

  // Mode line at the bottom
  const modeItems: string[] = [];

  // Accept edits or mode indicator
  if (config.acceptEditsOn || config.mode === "auto") {
    modeItems.push(colors.secondary("▸▸") + " " + colors.primary(MODE_LABELS.auto));
  } else if (config.mode && config.mode !== "chat") {
    modeItems.push(colors.secondary("▸") + " " + colors.primary(MODE_LABELS[config.mode]));
  }

  // Keyboard hints
  if (config.showHints) {
    if (config.mode === "auto" || config.acceptEditsOn) {
      modeItems.push(colors.muted("(shift+tab to cycle)"));
    }
    if (config.state !== "idle" && config.state !== "done") {
      modeItems.push(colors.muted("esc to interrupt"));
    }
  }

  // Combine all lines
  const lines: string[] = [];

  if (statusLine) {
    lines.push(statusLine);
  }

  if (imageLineItems.length > 0) {
    lines.push(imageLineItems.join(" "));
  }

  if (modeItems.length > 0) {
    lines.push(modeItems.join(" · "));
  }

  return lines.join("\n");
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return colors.dim(`${ms}ms`);
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes === 0) {
    return colors.dim(`${seconds}s`);
  }

  const remainingSeconds = seconds % 60;
  return colors.dim(`${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`);
}

/**
 * Format token usage
 */
function formatTokens(input?: number, output?: number): string {
  const parts: string[] = [];

  if (input !== undefined && input > 0) {
    parts.push(`↓ ${formatNumber(input)}`);
  }

  if (output !== undefined && output > 0) {
    parts.push(`↑ ${formatNumber(output)}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return colors.dim(parts.join(" ") + " tokens");
}

/**
 * Format number with K/M suffix
 */
function formatNumber(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + "M";
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + "k";
  }
  return n.toString();
}

// ============================================================================
// COMPACT STATUS
// ============================================================================

/**
 * Render a compact status for narrow terminals
 */
export function renderCompactStatus(config: StatusLineConfig): string {
  const stateConfig = STATE_CONFIG[config.state];
  const parts: string[] = [];

  if (config.state !== "idle") {
    parts.push(stateConfig.color(stateConfig.icon));
  }

  if (config.durationMs && config.durationMs > 1000) {
    parts.push(formatDuration(config.durationMs));
  }

  if (config.inputTokens) {
    parts.push(colors.dim(`${formatNumber(config.inputTokens)}t`));
  }

  return parts.join(" ");
}

// ============================================================================
// CONVERSATION COMPACTION INDICATOR
// ============================================================================

/**
 * Render the conversation compacted indicator
 */
export function renderCompactionIndicator(expandHint: string = "ctrl+o"): string {
  return `${colors.dim("✱")} ${colors.text("Conversation compacted")} ${colors.muted(`(${expandHint} for history)`)}`;
}

// ============================================================================
// PROMPT RENDERER
// ============================================================================

export interface PromptConfig {
  mode: "chat" | "plan" | "execute" | "auto";
  acceptEditsOn?: boolean;
  showModeHint?: boolean;
}

/**
 * Render the input prompt
 */
export function renderPrompt(config: PromptConfig): string {
  const promptChar = "›";

  let prompt = colors.text(promptChar);

  return prompt + " ";
}

/**
 * Render the prompt hint line
 */
export function renderPromptHint(config: PromptConfig): string {
  const hints: string[] = [];

  if (config.acceptEditsOn || config.mode === "auto") {
    hints.push(colors.secondary("▸▸") + " " + colors.primary("accept edits on"));
    hints.push(colors.muted("(shift+tab to cycle)"));
    hints.push(colors.muted("esc to interrupt"));
  } else if (config.mode === "plan") {
    hints.push(colors.secondary("▸") + " " + colors.primary("plan mode"));
    hints.push(colors.muted("(shift+tab to cycle)"));
  }

  return hints.join(" · ");
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  colors as statusLineColors,
  STATE_CONFIG,
  MODE_LABELS,
};
