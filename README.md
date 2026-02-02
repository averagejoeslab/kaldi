<p align="center">
  <img src="assets/logo-option-4.png" alt="Kaldi" width="200">
</p>

<h1 align="center">🐕 Kaldi Dovington</h1>

<p align="center"><strong>The Mysterious Boy • Your Loyal Coding Companion</strong></p>

<p align="center">
A minimal agentic coding CLI in ~180 lines.<br>
Mr. Boy is a Great Pyrenees who loves coffee and coding.
</p>

---

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-xxx
# Or use OpenRouter
export OPENROUTER_API_KEY=sk-or-xxx

# Run
npx tsx kaldi.ts
# Or
npm start
```

## Features

- 🐕 **Single file** - Everything in `kaldi.ts` (~180 lines)
- 🔧 **6 tools** - read, write, edit, glob, grep, bash
- 🤖 **Agentic loop** - Autonomous multi-step execution
- 🔑 **BYOK** - Anthropic or OpenRouter
- 🎨 **Dog personality** - Mr. Boy's goofy charm

## Tools

| Tool | Description |
|------|-------------|
| `read` | Read file with line numbers |
| `write` | Write content to file |
| `edit` | Replace text (old must be unique) |
| `glob` | Find files by pattern |
| `grep` | Search for regex in files |
| `bash` | Run shell commands |

## Commands

| Command | Description |
|---------|-------------|
| `/c` | Clear conversation |
| `/q` or `exit` | Quit |

## Project Structure

```
kaldi/
├── kaldi.ts          # The entire app (~180 lines)
├── package.json
├── tsconfig.json
└── src/              # Future expansion
    ├── providers/    # Multi-provider support
    ├── tools/        # Additional tools
    ├── mcp/          # MCP server support
    ├── context/      # Context management
    ├── session/      # Session persistence
    ├── hooks/        # Pre/post hooks
    ├── skills/       # Slash commands
    ├── permissions/  # Permission system
    └── ui/           # Terminal UI
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (alternative) |
| `MODEL` | Override model (default: claude-sonnet-4) |

## Philosophy

Inspired by [nanocode](https://github.com/1rgs/nanocode) and [nanodeepagent](https://github.com/chrispangg/nanodeepagent).

The core is intentionally minimal. The `src/` folders are empty placeholders for future features like Claude Code has:
- Multi-provider support
- MCP servers
- Session persistence
- Background tasks
- Hooks system
- Skills/slash commands
- Permission modes
- Extended thinking

## License

MIT - Average Joes Lab

---

*"The Mysterious Boy is on the case!"* 🐕
