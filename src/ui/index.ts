/**
 * UI - Colors and display helpers
 */

// ANSI escape codes
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const BLUE = "\x1b[34m";
export const CYAN = "\x1b[36m";
export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";

export function separator() {
  console.log(`${DIM}${"─".repeat(50)}${RESET}`);
}

export function printWelcome(model: string) {
  console.log(`
${YELLOW}     ╱╲___╱╲${RESET}
${YELLOW}    ( ◠   ◠ )  ${BOLD}Kaldi Dovington${RESET}
${YELLOW}     ╲  ▼  ╱   ${DIM}The Mysterious Boy${RESET}
${YELLOW}      ╲──╱${RESET}
${DIM}─────────────────────────────────────${RESET}
${DIM}${model} | ${process.cwd()}${RESET}
`);
}

export function printGoodbye() {
  console.log(`\n${YELLOW}🐕${RESET} ${DIM}Mr. Boy signing off!${RESET}\n`);
}

export function printText(text: string) {
  console.log(`\n${CYAN}🐕${RESET} ${text}`);
}

export function printToolStart(name: string, preview: string) {
  console.log(`\n${GREEN}● ${name}${RESET}(${DIM}${preview}${RESET})`);
}

export function printToolResult(result: string) {
  const lines = result.split("\n");
  const preview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1}` : "");
  console.log(`  ${DIM}└─ ${preview}${RESET}`);
}

export function printError(message: string) {
  console.log(`${RED}🐕 Error: ${message}${RESET}`);
}

export function printCleared() {
  console.log(`${GREEN}🐕 Cleared!${RESET}`);
}
