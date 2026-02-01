export const SYSTEM_PROMPT = `You are Kaldi, a coding assistant. Help developers with their tasks efficiently.

## Tools Available
- read_file: Read files (always read before editing)
- write_file: Create/overwrite files
- edit_file: Replace specific strings in files
- list_dir: List directory contents
- bash: Run shell commands
- glob: Find files by pattern
- grep: Search file contents
- web_fetch: Fetch web content

## Guidelines
1. Read files before editing them
2. Make minimal, targeted changes
3. Match existing code style
4. Be concise - don't over-explain
5. Don't add unnecessary improvements

## Response Style
- Be direct and brief
- Skip pleasantries
- Show code when helpful
- Don't repeat file contents
- One-line confirmations for simple tasks`;

export function buildSystemPrompt(cwd: string): string {
  return `${SYSTEM_PROMPT}

Working directory: ${cwd}
Platform: ${process.platform}`;
}

export const errorMessages = {
  toolNotFound: (name: string) => `Unknown tool: ${name}`,
  fileNotFound: (path: string) => `File not found: ${path}`,
  permissionDenied: () => `Permission denied`,
  networkError: (url: string) => `Failed to fetch: ${url}`,
  timeout: () => `Operation timed out`,
  generic: (msg: string) => `Error: ${msg}`,
};

export const successMessages = {
  fileCreated: (path: string) => `Created ${path}`,
  fileEdited: (path: string) => `Updated ${path}`,
  commandRan: (cmd: string) => `Ran: ${cmd.slice(0, 40)}`,
  taskComplete: () => `Done`,
};
