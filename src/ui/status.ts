import chalk from "chalk";

// Coffee-themed status messages
const THINKING_MESSAGES = [
  "Brewing thoughts",
  "Percolating",
  "Steeping on this",
  "Grinding through",
  "Letting it steep",
  "Warming up",
];

const READING_MESSAGES = [
  "Sniffing through",
  "Fetching",
  "Nosing around",
  "Digging into",
  "Tracking down",
];

const SEARCHING_MESSAGES = [
  "On the scent",
  "Sniffing around",
  "Following the trail",
  "Tracking",
  "Hunting for",
];

const RUNNING_MESSAGES = [
  "Running the grind",
  "Brewing up",
  "Percolating",
  "Working the beans",
];

const WRITING_MESSAGES = [
  "Pouring out",
  "Serving up",
  "Dripping fresh",
  "Crafting",
];

const COMPLETION_VERBS = [
  "Brewed",
  "Fetched",
  "Served",
  "Poured",
  "Ground",
  "Roasted",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getThinkingMessage(): string {
  return randomFrom(THINKING_MESSAGES);
}

export function getReadingMessage(file?: string): string {
  const verb = randomFrom(READING_MESSAGES);
  return file ? `${verb} ${file}` : verb;
}

export function getSearchingMessage(pattern?: string): string {
  const verb = randomFrom(SEARCHING_MESSAGES);
  return pattern ? `${verb} ${pattern}` : verb;
}

export function getRunningMessage(): string {
  return randomFrom(RUNNING_MESSAGES);
}

export function getWritingMessage(file?: string): string {
  const verb = randomFrom(WRITING_MESSAGES);
  return file ? `${verb} ${file}` : verb;
}

export function getCompletionMessage(duration: number): string {
  const verb = randomFrom(COMPLETION_VERBS);
  return `${verb} in ${formatDuration(duration)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// Pyrenees + Coffee themed colors
const colors = {
  dim: chalk.hex("#A09080"),           // Muted brown-gray
  accent: chalk.hex("#DAA520"),        // Golden honey
  warning: chalk.hex("#DAA520"),       // Golden honey (for thinking)
  primary: chalk.hex("#C9A66B"),       // Latte
  text: chalk.hex("#F5F0E6"),          // Cream
};

// Spinner frames - coffee cup and dog animation
const SPINNER_FRAMES = ["☕", "🫖", "☕", "🫖"];
const DOG_FRAMES = ["🐕", "🐕‍🦺", "🦮", "🐕"];

// Star symbol for thinking (like Claude Code)
const STAR = "✦";

export class StatusManager {
  private interval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private currentMessage: string = "";
  private frameIndex: number = 0;
  private usedog: boolean = false;
  private isActive: boolean = false;
  private isThinking: boolean = false;

  start(message: string, useDog: boolean = false, thinking: boolean = true) {
    this.stop();
    this.startTime = Date.now();
    this.currentMessage = message;
    this.frameIndex = 0;
    this.usedog = useDog;
    this.isActive = true;
    this.isThinking = thinking;
    this.render();

    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % 4;
      this.render();
    }, 200);
  }

  update(message: string) {
    this.currentMessage = message;
    if (this.isActive) {
      this.render();
    }
  }

  private render() {
    if (!this.isActive) return;
    const elapsed = formatDuration(Date.now() - this.startTime);

    let line: string;
    if (this.isThinking) {
      // Claude Code style: ✦ Wandering... (thought for 1s)
      line = `${colors.accent(STAR)} ${colors.warning(`${this.currentMessage}...`)} ${colors.dim(`(thought for ${elapsed})`)}`;
    } else {
      // Tool operation style with emoji
      const frames = this.usedog ? DOG_FRAMES : SPINNER_FRAMES;
      const frame = frames[this.frameIndex];
      line = colors.dim(`  ${frame} ${this.currentMessage} · ${elapsed}`);
    }

    process.stdout.write(`\r\x1b[K${line}`);
  }

  stop(): string {
    const wasActive = this.isActive;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isActive = false;

    // Only clear line if spinner was actually showing
    if (wasActive) {
      process.stdout.write("\r\x1b[K");
    }

    const duration = Date.now() - this.startTime;
    return getCompletionMessage(duration);
  }

  clear() {
    const wasActive = this.isActive;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isActive = false;

    // Only clear line if spinner was actually showing
    if (wasActive) {
      process.stdout.write("\r\x1b[K");
    }
  }
}

// Singleton instance
export const status = new StatusManager();

// Tool-specific status starters
export function startToolStatus(tool: string, args: Record<string, unknown>) {
  switch (tool) {
    case "read_file":
      const file = (args.path as string)?.split("/").pop() || "file";
      status.start(getReadingMessage(file), true);
      break;
    case "glob":
      status.start(getSearchingMessage(args.pattern as string), true);
      break;
    case "grep":
      status.start(getSearchingMessage(args.pattern as string), true);
      break;
    case "list_dir":
      const dir = (args.path as string)?.split("/").pop() || "directory";
      status.start(getReadingMessage(dir), true);
      break;
    case "bash":
      status.start(getRunningMessage(), false);
      break;
    case "write_file":
      const writeFile = (args.path as string)?.split("/").pop() || "file";
      status.start(getWritingMessage(writeFile), false);
      break;
    case "edit_file":
      const editFile = (args.path as string)?.split("/").pop() || "file";
      status.start(getWritingMessage(editFile), false);
      break;
    case "web_fetch":
      status.start("Fetching from the web", false);
      break;
    default:
      status.start(getThinkingMessage(), false);
  }
}
