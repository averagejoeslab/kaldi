import chalk from "chalk";
import * as readline from "readline";

export interface Command {
  name: string;
  description: string;
}

const COMMANDS: Command[] = [
  { name: "/help", description: "Show help" },
  { name: "/clear", description: "Clear conversation" },
  { name: "/compact", description: "Toggle auto-approve" },
  { name: "/usage", description: "Show token usage" },
  { name: "/save", description: "Save session" },
  { name: "/load", description: "Load session" },
  { name: "/sessions", description: "List sessions" },
  { name: "/config", description: "Show config" },
  { name: "/init", description: "Initialize project" },
  { name: "/status", description: "Git status" },
  { name: "/diff", description: "Git diff" },
  { name: "/doctor", description: "Check setup" },
  { name: "/quit", description: "Exit" },
];

export function getMatchingCommands(input: string): Command[] {
  if (!input.startsWith("/")) return [];
  const search = input.toLowerCase();
  return COMMANDS.filter(cmd => cmd.name.startsWith(search));
}

type ChalkFn = (text: string) => string;

export function createAutocompleteInput(
  prompt: string,
  onSubmit: (input: string) => void,
  colors: { primary: ChalkFn; dim: ChalkFn }
): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string) => {
      if (line.startsWith("/")) {
        const matches = COMMANDS
          .filter(cmd => cmd.name.startsWith(line.toLowerCase()))
          .map(cmd => cmd.name);
        return [matches, line];
      }
      return [[], line];
    },
  });

  let currentInput = "";
  let suggestionLine = "";

  const clearSuggestion = () => {
    if (suggestionLine) {
      // Move to suggestion line and clear it
      process.stdout.write("\x1b[1B\x1b[2K\x1b[1A");
      suggestionLine = "";
    }
  };

  const showSuggestion = () => {
    clearSuggestion();

    if (currentInput.startsWith("/") && currentInput.length > 0) {
      const matches = getMatchingCommands(currentInput);
      if (matches.length > 0 && matches[0].name !== currentInput) {
        // Show inline ghost text
        const remaining = matches[0].name.slice(currentInput.length);
        const hint = matches.length > 1 ? ` (${matches.length} options)` : ` - ${matches[0].description}`;
        suggestionLine = colors.dim(remaining + hint);

        // Save cursor, print ghost, restore cursor
        process.stdout.write("\x1b[s" + suggestionLine + "\x1b[u");
      }
    }
  };

  // Handle line input
  rl.on("line", (input) => {
    clearSuggestion();
    currentInput = "";
    onSubmit(input);

    // Re-prompt
    rl.setPrompt(prompt);
    rl.prompt();
  });

  // Handle close
  rl.on("close", () => {
    process.exit(0);
  });

  // Set up key handler for autocomplete display
  process.stdin.on("keypress", (char, key) => {
    if (key && key.name === "tab" && currentInput.startsWith("/")) {
      // Tab completion
      const matches = getMatchingCommands(currentInput);
      if (matches.length === 1) {
        // Complete the command
        const completion = matches[0].name.slice(currentInput.length);
        rl.write(completion);
        currentInput = matches[0].name;
        clearSuggestion();
      } else if (matches.length > 1) {
        // Find common prefix
        const names = matches.map(m => m.name);
        let prefix = names[0];
        for (const name of names) {
          while (!name.startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
          }
        }
        if (prefix.length > currentInput.length) {
          const completion = prefix.slice(currentInput.length);
          rl.write(completion);
          currentInput = prefix;
        }
        // Show options
        clearSuggestion();
        console.log();
        console.log(colors.dim("  " + matches.map(m => m.name).join("  ")));
        rl.prompt(true);
      }
    }
  });

  // Track input changes
  const originalWrite = rl.write.bind(rl);
  rl.write = (data: string, key?: any) => {
    originalWrite(data, key);
    // Update current input tracking
    setTimeout(() => {
      currentInput = (rl as any).line || "";
      showSuggestion();
    }, 0);
  };

  rl.setPrompt(prompt);
  rl.prompt();

  // Enable keypress events
  readline.emitKeypressEvents(process.stdin, rl);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

// Simpler approach: just use readline with completer
export function createReadlineWithAutocomplete(): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string): [string[], string] => {
      if (line.startsWith("/")) {
        const matches = COMMANDS
          .filter(cmd => cmd.name.toLowerCase().startsWith(line.toLowerCase()))
          .map(cmd => cmd.name);
        return [matches.length ? matches : COMMANDS.map(c => c.name), line];
      }
      return [[], line];
    },
  });

  return rl;
}

export { COMMANDS };
