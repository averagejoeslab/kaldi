/**
 * CLI Argument Parser
 *
 * Parses command line arguments.
 */

import type { CLIOptions } from "./types.js";

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-v" || arg === "--version") {
      options.version = true;
    } else if (arg === "--verbose" || arg === "-V") {
      options.verbose = true;
    } else if (arg === "--plan" || arg === "-P") {
      options.plan = true;
    } else if (arg === "-c" || arg === "--cwd") {
      options.cwd = args[++i];
    } else if (arg === "-p" || arg === "--provider") {
      options.provider = args[++i];
    } else if (arg === "-m" || arg === "--model") {
      options.model = args[++i];
    } else if (arg === "-r" || arg === "--resume") {
      options.resume = args[++i];
    } else if (arg === "--prompt") {
      // Everything after --prompt is the prompt
      options.prompt = args.slice(i + 1).join(" ");
      break;
    } else if (!arg.startsWith("-")) {
      // Positional argument is treated as prompt
      options.prompt = args.slice(i).join(" ");
      break;
    }
  }

  return options;
}

/**
 * Get help text
 */
export function getHelpText(): string {
  return `
Kaldi - Your Loyal AI Coding Companion

Usage:
  kaldi [options] [prompt]

Options:
  -h, --help              Show this help message
  -v, --version           Show version
  -c, --cwd <dir>         Working directory
  -p, --provider <name>   LLM provider (anthropic, openai, openrouter, ollama)
  -m, --model <name>      Model to use
  -r, --resume <id>       Resume a session
  -P, --plan              Start in plan mode (read-only)
  -V, --verbose           Enable verbose output
  --prompt <text>         Run with a prompt and exit

Examples:
  kaldi                           Start interactive session
  kaldi "explain this codebase"   Run with a prompt
  kaldi -r abc123                 Resume session abc123
  kaldi -p openai -m gpt-4o       Use OpenAI with GPT-4o

Commands (in interactive mode):
  /help                   Show available commands
  /config                 Show configuration
  /exit                   Exit Kaldi
`;
}
