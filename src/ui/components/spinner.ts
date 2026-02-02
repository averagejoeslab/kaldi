/**
 * Spinner Component
 */

import { c } from "../theme/colors.js";
import { spinner as spinnerFrames } from "../theme/symbols.js";

export interface SpinnerOptions {
  text?: string;
  frames?: string[];
  interval?: number;
}

export class Spinner {
  private text: string;
  private frames: string[];
  private interval: number;
  private frameIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private isSpinning = false;

  constructor(options: SpinnerOptions = {}) {
    this.text = options.text || "";
    this.frames = options.frames || spinnerFrames.dots;
    this.interval = options.interval || 80;
  }

  start(text?: string): this {
    if (text) this.text = text;
    if (this.isSpinning) return this;

    this.isSpinning = true;
    this.render();

    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.interval);

    return this;
  }

  stop(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isSpinning = false;
    this.clear();
    return this;
  }

  succeed(text?: string): this {
    this.stop();
    const msg = text || this.text;
    process.stdout.write(`\r${c.success("✓")} ${msg}\n`);
    return this;
  }

  fail(text?: string): this {
    this.stop();
    const msg = text || this.text;
    process.stdout.write(`\r${c.error("✗")} ${msg}\n`);
    return this;
  }

  setText(text: string): this {
    this.text = text;
    if (this.isSpinning) {
      this.render();
    }
    return this;
  }

  private render(): void {
    const frame = c.accent(this.frames[this.frameIndex]);
    process.stdout.write(`\r${frame} ${c.dim(this.text)}`);
  }

  private clear(): void {
    process.stdout.write("\r\x1b[K");
  }
}

export function createSpinner(options?: SpinnerOptions): Spinner {
  return new Spinner(options);
}
