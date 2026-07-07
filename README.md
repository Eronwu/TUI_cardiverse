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

The game defaults to the local stub compiler. To use OpenAI for card generation:

```bash
cp .env.example .env
# fill OPENAI_API_KEY
npm run build
node dist/cli.js --llm --provider openai
```

Only the OpenAI provider is implemented right now. Ollama remains planned.

LLM output is still validated locally:

```txt
OpenAI JSON -> Zod card schema -> balance engine -> draft card
```

The model can propose a card, but it cannot decide battle results or bypass cost/damage limits.

## Environment

Copy `.env.example` to `.env` for future LLM provider support. The real `.env` file is ignored by git.

```bash
cp .env.example .env
```

MVP gameplay defaults to the local stub compiler.
