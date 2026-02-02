/**
 * Animated Spinner
 *
 * Beautiful animated spinners for loading states.
 */

import { c } from "../theme/colors.js";

// Spinner frame sets
export const spinnerFrames = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  circle: ["◐", "◓", "◑", "◒"],
  bounce: ["⠁", "⠂", "⠄", "⠂"],
  line: ["-", "\\", "|", "/"],
  dots2: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  dots3: ["⠋", "⠙", "⠚", "⠞", "⠖", "⠦", "⠴", "⠲", "⠳", "⠓"],
  pulse: ["█", "▓", "▒", "░", "▒", "▓"],
  arrows: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
  bouncingBar: [
    "[    ]",
    "[=   ]",
    "[==  ]",
    "[=== ]",
    "[ ===]",
    "[  ==]",
    "[   =]",
    "[    ]",
  ],
  thinking: ["∴", "∵", "∴", "∵"],
  coffee: ["☕", "☕", "☕", "🐕"],
  dog: ["🐕", "🐕‍🦺", "🦮", "🐩"],
};

export interface AnimatedSpinnerOptions {
  frames?: string[];
  interval?: number;
  color?: (s: string) => string;
  prefix?: string;
  suffix?: string;
}

/**
 * Animated Spinner class
 */
export class AnimatedSpinner {
  private frames: string[];
  private interval: number;
  private color: (s: string) => string;
  private prefix: string;
  private suffix: string;
  private frameIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private text = "";
  private isSpinning = false;
  private stream = process.stderr;

  constructor(options: AnimatedSpinnerOptions = {}) {
    this.frames = options.frames || spinnerFrames.dots;
    this.interval = options.interval || 80;
    this.color = options.color || c.honey;
    this.prefix = options.prefix || "";
    this.suffix = options.suffix || "";
  }

  /**
   * Start the spinner
   */
  start(text = ""): void {
    if (this.isSpinning) return;

    this.text = text;
    this.isSpinning = true;
    this.frameIndex = 0;

    // Hide cursor
    this.stream.write("\x1B[?25l");

    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.interval);
  }

  /**
   * Update spinner text
   */
  update(text: string): void {
    this.text = text;
    if (this.isSpinning) {
      this.render();
    }
  }

  /**
   * Stop the spinner
   */
  stop(finalText?: string): void {
    if (!this.isSpinning) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isSpinning = false;

    // Clear line and show cursor
    this.clearLine();
    this.stream.write("\x1B[?25h");

    if (finalText) {
      this.stream.write(finalText + "\n");
    }
  }

  /**
   * Stop with success
   */
  success(text?: string): void {
    this.stop(`${c.success("✓")} ${text || this.text}`);
  }

  /**
   * Stop with error
   */
  error(text?: string): void {
    this.stop(`${c.error("✗")} ${text || this.text}`);
  }

  /**
   * Stop with warning
   */
  warn(text?: string): void {
    this.stop(`${c.warning("⚠")} ${text || this.text}`);
  }

  /**
   * Render current frame
   */
  private render(): void {
    const frame = this.color(this.frames[this.frameIndex]);
    const line = `${this.prefix}${frame} ${this.text}${this.suffix}`;

    this.clearLine();
    this.stream.write(line);
  }

  /**
   * Clear current line
   */
  private clearLine(): void {
    this.stream.write("\r\x1B[K");
  }
}

/**
 * Create a spinner instance
 */
export function createAnimatedSpinner(options?: AnimatedSpinnerOptions): AnimatedSpinner {
  return new AnimatedSpinner(options);
}

/**
 * Create a thinking spinner
 */
export function createThinkingSpinner(): AnimatedSpinner {
  return new AnimatedSpinner({
    frames: spinnerFrames.thinking,
    color: c.dim,
    interval: 300,
  });
}

/**
 * Create a tool execution spinner
 */
export function createToolSpinner(): AnimatedSpinner {
  return new AnimatedSpinner({
    frames: spinnerFrames.dots,
    color: c.honey,
    interval: 80,
  });
}
