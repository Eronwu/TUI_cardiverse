# Terminal Cardiverse

Terminal Cardiverse is a terminal-native prompt-compiled card strategy game.

The MVP runs entirely in your shell. It does not require a real LLM key; the local stub compiler is enough to challenge the first Boss, `INIT ECHO`.

## Run

```bash
npm install
npm run build
node dist/cli.js --no-llm
```

During development:

```bash
npm run dev -- --no-llm
```

## Commands

```txt
help
status
compile <prompt>
play <cacheIndex>
mount <cacheIndex>
trap <cacheIndex>
inspect <cache|daemon|kernel|discard> [index]
end
log
save-log
restart
quit
```

Example:

```txt
compile thermal spike
play 0
end
```

## Environment

Copy `.env.example` to `.env` for future LLM provider support. The real `.env` file is ignored by git.

```bash
cp .env.example .env
```

MVP gameplay defaults to the local stub compiler.
