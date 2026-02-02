/**
 * Readline Wrapper
 */

import * as readline from "readline";
import { stdin, stdout } from "process";

let rl: readline.Interface | null = null;

/**
 * Get or create readline interface
 */
export function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });
  }
  return rl;
}

/**
 * Close readline interface
 */
export function closeReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/**
 * Prompt for input
 */
export function prompt(query: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(query, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirm(
  question: string,
  defaultValue = false
): Promise<boolean> {
  const hint = defaultValue ? "[Y/n]" : "[y/N]";
  const answer = await prompt(`${question} ${hint} `);

  if (!answer.trim()) {
    return defaultValue;
  }

  return answer.toLowerCase().startsWith("y");
}

/**
 * Prompt for single key press
 */
export function keypress(): Promise<string> {
  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once("data", (data) => {
      stdin.setRawMode(false);
      stdin.pause();
      resolve(data.toString());
    });
  });
}
