# ☕ Kaldi

**Your loyal coding companion.**

Kaldi is a BYOK (Bring Your Own Key) agentic coding CLI. Like a good cup of coffee and a loyal dog, Kaldi is always there to help you code.

Named after the Ethiopian goatherd who discovered coffee, and inspired by man's best friend.

## Features

### 🔑 BYOK - Bring Your Own Key
Use your preferred LLM provider:
- **Anthropic** (Claude) - Recommended
- **OpenAI** (GPT-4)
- **Ollama** (Local models)
- **OpenRouter** (Multiple providers)

### 🤖 Agentic Coding
Kaldi can autonomously:
- Read, write, and edit files
- Execute bash commands
- Search your codebase (glob, grep)
- Browse directories
- Fetch web content
- Plan and execute multi-step tasks

### 🛡️ Safe by Default
- Permission prompts before running commands or editing files
- Diff preview shows exactly what will change
- Compact mode for trusted workflows
- Ctrl+C to cancel any operation

### ☕ Coffee-Themed CLI
Because coding is better with coffee:
- `kaldi` - Start an interactive session
- `kaldi beans` - Configure your provider (pick your beans)
- `kaldi roast` - Review and critique code
- `kaldi refill` - Resume a previous session
- `kaldi doctor` - Check your setup

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/averagejoeslab/kaldi/main/install.sh | bash
```

This will:
- Clone Kaldi to `~/.kaldi`
- Install dependencies and build
- Create a launcher at `~/.local/bin/kaldi`

> **Note:** Make sure `~/.local/bin` is in your PATH. Add this to your shell profile if needed:
> ```bash
> export PATH="$HOME/.local/bin:$PATH"
> ```

### Manual Install

```bash
# Clone the repository
git clone https://github.com/averagejoeslab/kaldi.git
cd kaldi

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Quick Start

```bash
# Configure your provider (pick your beans)
kaldi beans -p anthropic -k your-api-key

# Or use environment variable
export ANTHROPIC_API_KEY=your-api-key

# Start coding
kaldi
```

## Commands

### CLI Commands

| Command | Description |
|---------|-------------|
| `kaldi` | Start interactive session |
| `kaldi beans` | Configure LLM provider |
| `kaldi roast [path]` | Review code |
| `kaldi refill` | Resume previous session |
| `kaldi doctor` | Check setup |

### Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Clear conversation |
| `/config` | Show configuration |
| `/usage` | Show token usage & cost |
| `/compact` | Toggle auto-approve mode |
| `/sessions` | List saved sessions |
| `/save` | Save current session |
| `/load [id]` | Load a session |
| `/init` | Initialize project context |
| `/status` | Show git status |
| `/diff` | Show git diff |
| `/doctor` | Health check |
| `/quit` | Exit |

## Configuration

### Provider Setup

```bash
# Set provider
kaldi beans -p anthropic

# Set API key
kaldi beans -k sk-ant-xxx

# Set model
kaldi beans -m claude-sonnet-4-20250514

# List all configurations
kaldi beans -l
```

### Environment Variables

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
export OPENROUTER_API_KEY=sk-or-xxx
```

## Tools

Kaldi has access to these tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with line numbers |
| `write_file` | Create or overwrite files |
| `edit_file` | Make targeted string replacements |
| `list_dir` | List directory contents |
| `bash` | Execute shell commands |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `web_fetch` | Fetch web page content |

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| Anthropic | claude-sonnet-4, claude-opus-4, claude-3.5-haiku | Recommended |
| OpenAI | gpt-4o, gpt-4o-mini, o1 | |
| Ollama | llama3.2, codellama, mistral | Local, free |
| OpenRouter | Many | Multi-provider access |

## Development

```bash
# Watch mode
npm run dev

# Type check
npm run typecheck

# Build
npm run build
```

## Philosophy

Kaldi is designed to be:

- **Loyal** - Sticks with you through complex tasks
- **Attentive** - Pays attention to details and context
- **Safe** - Asks before making changes
- **Efficient** - Gets things done without unnecessary chatter
- **Flexible** - Works with your preferred LLM

## License

MIT

---

*Made with ☕ by Average Joes Lab*

*"Like a good cup of coffee and a faithful dog, always there when you need it."*
