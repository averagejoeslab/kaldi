/**
 * Command Types
 */

export interface CommandContext {
  cwd: string;
  provider: string;
  model: string;
  sessionId?: string;
}

export interface CommandResult {
  output?: string;
  error?: string;
  exit?: boolean;
}

export type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<CommandResult> | CommandResult;

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  handler: CommandHandler;
}
