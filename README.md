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

In a real interactive terminal, the game uses single-key controls. You do not need to type commands and press Enter for common actions:

```txt
type text                  # starts card-forging prompt input
Enter                      # opens an empty card-forging prompt
P                          # use the current draft now
C                          # store the current draft in cache
R                          # rewrite the draft with a new prompt
X                          # discard the current draft
1-5                        # play cache card
D then 1-5                 # mount cache card as daemon
K then 1-5                 # arm cache card as kernel
I then 1-5                 # inspect cache card
E                          # end turn
A                          # ask AI for a suggestion
G                          # let AI play the current turn
Q                          # quit
:                          # open advanced command input
```

When stdin/stdout is not a TTY, such as tests or shell pipes, the game falls back to line input. Power-user commands are still available there and in `:` command input:

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
