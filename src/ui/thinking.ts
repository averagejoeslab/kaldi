/**
 * Extended Thinking Display
 *
 * Real-time streaming display of model's thinking process.
 * Shows the model's reasoning in a collapsible, styled format.
 */

import chalk from "chalk";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

export interface ThinkingConfig {
  /** Whether to show thinking by default */
  showByDefault?: boolean;
  /** Maximum lines to show before collapsing */
  maxVisibleLines?: number;
  /** Whether to animate the thinking indicator */
  animate?: boolean;
  /** Collapse after completion */
  collapseOnComplete?: boolean;
}

export interface ThinkingBlock {
  id: string;
  content: string;
  startTime: number;
  endTime?: number;
  collapsed: boolean;
}

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  thinking: chalk.hex("#87CEEB"),      // Sky blue for thinking
  thinkingDim: chalk.hex("#5A9BC7"),   // Dimmer blue
  border: chalk.hex("#5A5A5A"),        // Gray border
  dim: chalk.hex("#888888"),
  accent: chalk.hex("#C9A66B"),
};

// ============================================================================
// THINKING DISPLAY
// ============================================================================

export class ThinkingDisplay extends EventEmitter {
  private config: ThinkingConfig;
  private currentBlock: ThinkingBlock | null = null;
  private blocks: ThinkingBlock[] = [];
  private isVisible: boolean;
  private animationFrame = 0;
  private animationInterval: NodeJS.Timeout | null = null;

  // Animation frames for the thinking indicator
  private readonly spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  constructor(config: ThinkingConfig = {}) {
    super();
    this.config = {
      showByDefault: true,
      maxVisibleLines: 10,
      animate: true,
      collapseOnComplete: true,
      ...config,
    };
    this.isVisible = this.config.showByDefault ?? true;
  }

  /**
   * Start a new thinking block
   */
  startThinking(id?: string): void {
    if (this.currentBlock) {
      this.endThinking();
    }

    this.currentBlock = {
      id: id || `thinking_${Date.now()}`,
      content: "",
      startTime: Date.now(),
      collapsed: false,
    };

    if (this.config.animate) {
      this.startAnimation();
    }

    this.emit("thinkingStart", this.currentBlock);
  }

  /**
   * Append content to the current thinking block
   */
  appendThinking(content: string): void {
    if (!this.currentBlock) {
      this.startThinking();
    }

    this.currentBlock!.content += content;
    this.emit("thinkingUpdate", this.currentBlock);

    if (this.isVisible) {
      this.renderThinkingLine(content);
    }
  }

  /**
   * End the current thinking block
   */
  endThinking(): void {
    if (!this.currentBlock) return;

    this.currentBlock.endTime = Date.now();

    if (this.config.collapseOnComplete) {
      this.currentBlock.collapsed = true;
    }

    this.blocks.push(this.currentBlock);
    this.stopAnimation();

    this.emit("thinkingEnd", this.currentBlock);

    if (this.isVisible && this.currentBlock.content) {
      this.renderThinkingSummary(this.currentBlock);
    }

    this.currentBlock = null;
  }

  /**
   * Toggle visibility of thinking blocks
   */
  toggleVisibility(): boolean {
    this.isVisible = !this.isVisible;
    this.emit("visibilityChange", this.isVisible);
    return this.isVisible;
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.emit("visibilityChange", this.isVisible);
  }

  /**
   * Get current visibility state
   */
  getVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Clear all thinking blocks
   */
  clear(): void {
    this.blocks = [];
    this.currentBlock = null;
    this.stopAnimation();
  }

  /**
   * Get all thinking blocks
   */
  getBlocks(): ThinkingBlock[] {
    return [...this.blocks];
  }

  /**
   * Get current thinking block
   */
  getCurrentBlock(): ThinkingBlock | null {
    return this.currentBlock;
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  /**
   * Render the thinking header
   */
  renderThinkingHeader(): string {
    const spinner = this.config.animate
      ? this.spinnerFrames[this.animationFrame % this.spinnerFrames.length]
      : "◆";

    return colors.thinking(`${spinner} Thinking...`);
  }

  /**
   * Render a line of thinking content
   */
  private renderThinkingLine(content: string): void {
    // Stream thinking content with special formatting
    const lines = content.split("\n");

    for (const line of lines) {
      if (line.trim()) {
        process.stdout.write(colors.thinkingDim(`│ ${line}\n`));
      }
    }
  }

  /**
   * Render thinking summary after completion
   */
  private renderThinkingSummary(block: ThinkingBlock): void {
    const duration = block.endTime! - block.startTime;
    const lines = block.content.split("\n").filter(l => l.trim()).length;

    // Clear the current thinking display
    process.stdout.write("\r\x1b[K");

    // Show collapsed summary
    const durationStr = duration < 1000
      ? `${duration}ms`
      : `${(duration / 1000).toFixed(1)}s`;

    console.log(colors.dim(`◆ Thought for ${durationStr} (${lines} lines) — ctrl+t to expand`));
  }

  /**
   * Render full thinking block (expanded)
   */
  renderFullBlock(block: ThinkingBlock): string {
    const lines: string[] = [];
    const duration = (block.endTime || Date.now()) - block.startTime;
    const durationStr = duration < 1000
      ? `${duration}ms`
      : `${(duration / 1000).toFixed(1)}s`;

    lines.push(colors.border("┌─ Thinking " + "─".repeat(50)));

    const contentLines = block.content.split("\n");
    const maxLines = this.config.maxVisibleLines || 10;
    const displayLines = block.collapsed
      ? contentLines.slice(0, maxLines)
      : contentLines;

    for (const line of displayLines) {
      lines.push(colors.border("│ ") + colors.thinkingDim(line));
    }

    if (block.collapsed && contentLines.length > maxLines) {
      lines.push(colors.border("│ ") + colors.dim(`... +${contentLines.length - maxLines} more lines`));
    }

    lines.push(colors.border("└─ ") + colors.dim(`${durationStr}`));

    return lines.join("\n");
  }

  // ============================================================================
  // ANIMATION
  // ============================================================================

  private startAnimation(): void {
    if (this.animationInterval) return;

    this.animationInterval = setInterval(() => {
      this.animationFrame++;
      this.emit("animationFrame", this.animationFrame);
    }, 80);
  }

  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let thinkingDisplayInstance: ThinkingDisplay | null = null;

export function getThinkingDisplay(config?: ThinkingConfig): ThinkingDisplay {
  if (!thinkingDisplayInstance) {
    thinkingDisplayInstance = new ThinkingDisplay(config);
  }
  return thinkingDisplayInstance;
}

export function resetThinkingDisplay(): void {
  if (thinkingDisplayInstance) {
    thinkingDisplayInstance.clear();
    thinkingDisplayInstance = null;
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format thinking for export/display
 */
export function formatThinkingForExport(blocks: ThinkingBlock[]): string {
  const sections: string[] = [];

  for (const block of blocks) {
    const duration = (block.endTime || Date.now()) - block.startTime;
    sections.push(`## Thinking (${duration}ms)\n\n${block.content}`);
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Parse thinking from a response
 */
export function extractThinking(response: string): {
  thinking: string;
  content: string;
} {
  // Look for <thinking> tags
  const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);

  if (thinkingMatch) {
    const thinking = thinkingMatch[1].trim();
    const content = response.replace(/<thinking>[\s\S]*?<\/thinking>/, "").trim();
    return { thinking, content };
  }

  return { thinking: "", content: response };
}
