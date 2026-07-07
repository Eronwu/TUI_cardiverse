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

The default input mode is friendly:

```txt
thermal spike              # natural language compiles a draft card
c thermal spike            # explicit compile shortcut
p                          # use the current draft now
c                          # store the current draft in cache
r recursive doubt          # rewrite the draft with a new prompt
x                          # discard the current draft
1                          # play cache card 1
d2                         # mount cache card 2 as daemon
k3                         # arm cache card 3 as kernel
e                          # end turn
a                          # ask AI for a suggestion
g                          # let AI play the current turn
q                          # quit
```

Power-user commands are still available. Prefix with `:` when a phrase should be treated as a system command instead of a card prompt:

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
thermal spike
p
e
```

## AI Control

Run a full rule-based AI challenge:

```bash
node dist/cli.js --auto-player
```

The AI control plane uses structured player actions and cannot mutate game state directly:

```ts
{ type: "compile", prompt: "thermal spike" }
{ type: "play", cacheIndex: 0, cardId: "compiled-thermal-spike" }
{ type: "end" }
```

Every action is checked against legal actions before execution.

## LLM Card Compiler

The game defaults to the local stub compiler. To use an OpenAI-compatible LLM for card generation:

```bash
cp .env.example .env
# fill LLM_API_KEY and optionally LLM_API_BASE_URL / LLM_MODEL_NAME
npm run build
node dist/cli.js --llm --provider openai
```

Supported env names:

```txt
LLM_API_BASE_URL=https://your-openai-compatible-host/v1
LLM_API_KEY=...
LLM_MODEL_NAME=...
LLM_API_STYLE=auto
```

Native OpenAI fallback names also work:

```txt
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

`LLM_API_STYLE` can be:

- `auto`: try `/responses`, then fallback to `/chat/completions`
- `responses`: force `/responses`
- `chat_completions`: force `/chat/completions`

For agnes-ai or other OpenAI-compatible vendors, start with:

```txt
LLM_API_BASE_URL=<vendor base url>
LLM_API_KEY=<vendor key>
LLM_MODEL_NAME=<vendor model>
LLM_API_STYLE=chat_completions
```

Ollama remains planned.

LLM output is still validated locally:

```txt
OpenAI JSON -> Zod card schema -> balance engine -> draft card
```

The model can propose a card, but it cannot decide battle results or bypass cost/damage limits.
While a real LLM request is running, the terminal shows an `AI COMPILER` loading line with elapsed seconds so the game does not look frozen. In an interactive terminal, `cardiverse>` is managed by readline so backspace edits only your input, not the prompt. Common third-party output variants such as `target: "opponent"`, `track: "fire"`, or effect `value` are normalized before Zod validation.

## Environment

Copy `.env.example` to `.env` for future LLM provider support. The real `.env` file is ignored by git.

```bash
cp .env.example .env
```

MVP gameplay defaults to the local stub compiler.
