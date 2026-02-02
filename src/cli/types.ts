/**
 * CLI Types
 *
 * Type definitions for the CLI.
 */

/**
 * CLI subcommands
 */
export type CLICommand = "beans" | "doctor" | "roast" | "refill" | null;

/**
 * CLI options from command line arguments
 */
export interface CLIOptions {
  /** Subcommand */
  command?: CLICommand;
  /** Working directory */
  cwd?: string;
  /** Provider to use */
  provider?: string;
  /** Model to use */
  model?: string;
  /** API key */
  apiKey?: string;
  /** Session ID to resume */
  resume?: string;
  /** Enable plan mode */
  plan?: boolean;
  /** Run in non-interactive mode with a prompt */
  prompt?: string;
  /** Print version and exit */
  version?: boolean;
  /** Print help and exit */
  help?: boolean;
  /** Enable verbose/debug output */
  verbose?: boolean;
  /** List configs */
  list?: boolean;
}

/**
 * CLI state
 */
export interface CLIState {
  /** Whether CLI is running */
  running: boolean;
  /** Current input */
  input: string;
  /** Is processing a message */
  processing: boolean;
  /** Current session ID */
  sessionId?: string;
  /** Error message if any */
  error?: string;
}
