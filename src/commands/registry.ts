/**
 * Command Registry
 */

import type { Command, CommandContext, CommandResult } from "./types.js";

const commands: Map<string, Command> = new Map();
const aliases: Map<string, string> = new Map();

/**
 * Register a command
 */
export function registerCommand(command: Command): void {
  commands.set(command.name, command);

  if (command.aliases) {
    for (const alias of command.aliases) {
      aliases.set(alias, command.name);
    }
  }
}

/**
 * Get a command by name or alias
 */
export function getCommand(name: string): Command | undefined {
  const resolvedName = aliases.get(name) || name;
  return commands.get(resolvedName);
}

/**
 * Check if a command exists
 */
export function hasCommand(name: string): boolean {
  return commands.has(name) || aliases.has(name);
}

/**
 * Execute a command
 */
export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/);
  const name = parts[0].slice(1); // Remove leading /
  const args = parts.slice(1);

  const command = getCommand(name);

  if (!command) {
    return { error: `Unknown command: /${name}. Try /help for a list of commands.` };
  }

  try {
    return await command.handler(args, context);
  } catch (error) {
    return {
      error: `Command failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Get all registered commands
 */
export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}

/**
 * Check if input is a command
 */
export function isCommand(input: string): boolean {
  return input.trim().startsWith("/");
}
