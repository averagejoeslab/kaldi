import ora, { Ora } from "ora";
import chalk from "chalk";

// Coffee-themed spinner frames
const coffeeFrames = ["☕", "🫖", "☕", "🫖"];
const beanFrames = ["🫘", "☕", "🫘", "☕"];

export interface SpinnerOptions {
  text?: string;
  theme?: "coffee" | "bean" | "default";
}

export class KaldiSpinner {
  private spinner: Ora;

  constructor(options: SpinnerOptions = {}) {
    const frames = options.theme === "bean" ? beanFrames :
                   options.theme === "coffee" ? coffeeFrames :
                   undefined;

    this.spinner = ora({
      text: options.text || "Brewing...",
      spinner: frames ? { frames, interval: 200 } : "dots",
      color: "yellow",
    });
  }

  start(text?: string): this {
    this.spinner.start(text);
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  succeed(text?: string): this {
    this.spinner.succeed(text);
    return this;
  }

  fail(text?: string): this {
    this.spinner.fail(text);
    return this;
  }

  info(text?: string): this {
    this.spinner.info(text);
    return this;
  }

  warn(text?: string): this {
    this.spinner.warn(text);
    return this;
  }

  text(text: string): this {
    this.spinner.text = text;
    return this;
  }
}

export function createSpinner(options?: SpinnerOptions): KaldiSpinner {
  return new KaldiSpinner(options);
}

// Status messages with coffee theme
export const status = {
  thinking: () => chalk.dim("☕ Brewing thoughts..."),
  reading: (file: string) => chalk.dim(`📖 Reading ${file}...`),
  writing: (file: string) => chalk.dim(`✏️ Writing ${file}...`),
  running: (cmd: string) => chalk.dim(`⚡ Running: ${cmd.slice(0, 50)}...`),
  searching: () => chalk.dim(`🔍 Sniffing around...`),
  fetching: (url: string) => chalk.dim(`🌐 Fetching ${url}...`),
  done: () => chalk.green("✓ Done!"),
  error: (msg: string) => chalk.red(`✗ ${msg}`),
};
