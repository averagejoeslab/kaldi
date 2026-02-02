/**
 * CLI Argument Parser
 *
 * Parses command line arguments.
 */

import type { CLIOptions, CLICommand } from "./types.js";

const SUBCOMMANDS: CLICommand[] = ["beans", "doctor", "roast", "refill"];

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  // Check for subcommand first
  if (args.length > 0 && SUBCOMMANDS.includes(args[0] as CLICommand)) {
    options.command = args[0] as CLICommand;
    args = args.slice(1);
  }

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
    } else if (arg === "-l" || arg === "--list") {
      options.list = true;
    } else if (arg === "-c" || arg === "--cwd") {
      options.cwd = args[++i];
    } else if (arg === "-p" || arg === "--provider") {
      options.provider = args[++i];
    } else if (arg === "-m" || arg === "--model") {
      options.model = args[++i];
    } else if (arg === "-k" || arg === "--key") {
      options.apiKey = args[++i];
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
  kaldi [command] [options] [prompt]

Commands:
  beans                   Configure LLM provider (pick your beans)
  doctor                  Check setup and health
  refill                  Resume previous session
  roast [path]            Review code

Options:
  -h, --help              Show this help message
  -v, --version           Show version
  -c, --cwd <dir>         Working directory
  -p, --provider <name>   LLM provider (anthropic, openai, openrouter, ollama)
  -m, --model <name>      Model to use
  -k, --key <key>         API key
  -r, --resume <id>       Resume a session
  -P, --plan              Start in plan mode (read-only)
  -V, --verbose           Enable verbose output
  -l, --list              List configurations
  --prompt <text>         Run with a prompt and exit

Examples:
  kaldi                              Start interactive session
  kaldi beans -p anthropic -k KEY    Configure Anthropic
  kaldi "explain this codebase"      Run with a prompt
  kaldi -r abc123                    Resume session abc123
  kaldi doctor                       Check setup

Commands (in interactive mode):
  /help                   Show available commands
  /config                 Show configuration
  /exit                   Exit Kaldi
`;
}
