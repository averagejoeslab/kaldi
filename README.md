# ☕ Kaldi

**Your loyal coding companion.**

Kaldi is a BYOK (Bring Your Own Key) agentic coding CLI. Like a good cup of coffee and a loyal dog, Kaldi is always there to help you code.

Named after the Ethiopian goatherd who discovered coffee, and inspired by man's best friend.

## Features

- **BYOK (Bring Your Own Key)** - Use your preferred LLM provider:
  - Anthropic (Claude)
  - OpenAI (GPT-4)
  - Ollama (Local models)
  - OpenRouter (Multiple providers)

- **Agentic Coding** - Kaldi can:
  - Read, write, and edit files
  - Execute bash commands
  - Search your codebase
  - Plan and execute multi-step tasks

- **Coffee-Themed CLI** - Because coding is better with coffee

## Installation

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

# Start coding
kaldi
```

## Commands

### `kaldi`
Start an interactive coding session.

### `kaldi beans`
Configure your LLM provider.

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

### Interactive Commands

While in a session:
- `/help` - Show help
- `/clear` - Clear conversation history
- `/config` - Show current configuration
- `/quit` - Exit Kaldi

## Environment Variables

You can also configure providers via environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
export OPENROUTER_API_KEY=sk-or-xxx
```

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| Anthropic | claude-sonnet-4, claude-opus-4, claude-3.5-haiku | Recommended |
| OpenAI | gpt-4o, gpt-4o-mini, o1 | |
| Ollama | llama3.2, codellama, mistral | Local, no API key needed |
| OpenRouter | Many | Access multiple providers |

## Development

```bash
# Watch mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT

---

*Made with ☕ by Average Joes Lab*
