# Terminal Cardiverse

**An AI-native card battle that lives in your terminal.**

Terminal Cardiverse is a Rust + Ratatui game where natural language becomes playable cards. You forge intent, the LLM compiles it into a draft, and a deterministic local engine decides whether the card is legal, balanced, and executable.

The game is not a web page pretending to be a terminal. The battle, story, AI card generation, replay, and playtest loop all happen in the real terminal.

## Why It Exists

Most AI games let the model improvise everything. Terminal Cardiverse takes the opposite route:

- The LLM is a **semantic compiler**, not the judge.
- The Rust core is the **battle authority**.
- Every generated card becomes a draft first.
- Every playtest can produce replay data, metrics, and issue notes.

The result is a terminal game that can be played by humans, watched as an AI-vs-Boss run, or controlled by external agents through a structured JSONL protocol.

## Current Highlights

- **Rust + Ratatui battle stage**: Boss matrix, active card lane, cache track, subtitle log, and keyboard-first controls.
- **Prompt-to-card compiler**: OpenAI-compatible LLM support via `.env`, plus deterministic stub mode.
- **Local rule enforcement**: Card schema normalization, balancing, RAM cost, HP/Sanity tracks, Cache/Daemon/Kernel memory.
- **Observer mode**: Watch a rule-based or LLM-driven agent play through the TUI.
- **Agent playtest mode**: Generate `replay.json`, `trace.jsonl`, `metrics.json`, and `issue.md`.
- **External agent protocol**: Let Codex or another tool read state and submit actions over JSONL.
- **Legacy TypeScript prototype**: Kept as a reference while the Rust version becomes the primary game.

## Quick Start

```bash
git clone <your-repo-url>
cd TUI_cardiverse
cargo run -p cardiverse-cli -- play --no-ai
```

Use a real OpenAI-compatible provider:

```bash
cp .env.example .env
# Fill LLM_API_BASE_URL, LLM_API_KEY, LLM_MODEL_NAME
cargo run -p cardiverse-cli
```

The project supports these env names:

```txt
LLM_API_BASE_URL=https://your-openai-compatible-host/v1
LLM_API_KEY=...
LLM_MODEL_NAME=...
LLM_API_STYLE=auto
LLM_TIMEOUT_SECONDS=25
```

Native OpenAI fallback names also work:

```txt
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

## Play

```bash
cargo run -p cardiverse-cli
cargo run -p cardiverse-cli -- play --no-ai
cargo run -p cardiverse-cli -- play --observer rule
cargo run -p cardiverse-cli -- play --observer llm
```

Controls:

```txt
F            forge an AI/stub draft card
Enter/Space  use current draft, or play selected cache card
Left/Right   select cache card
C            cache current draft
R            rewrite current draft
X            discard current draft
E            end turn
A            ask AI advisor for a legal suggestion
G            let the rules-only AI play legal actions
?            help
Q            quit
```

## Agent Playtest

Run a deterministic playtest and generate optimization artifacts:

```bash
cargo run -p cardiverse-cli -- observe --policy rule --episodes 1 --out .terminal-cardiverse/playtests/latest
```

Run a live LLM playtest using your project `.env`:

```bash
cargo run -p cardiverse-cli -- observe --policy llm --episodes 1 --out .terminal-cardiverse/playtests/live
```

Each playtest writes:

```txt
replay.json      # deterministic event replay
trace.jsonl      # state, legal actions, decision, reason, events
metrics.json     # winner, turns, cards, failed actions, counts
issue.md         # game design and UX issues for follow-up
```

External agents can control the game through JSONL:

```bash
cargo run -p cardiverse-cli -- agent --stdio
```

Protocol shape:

```json
{"type":"state","state":{},"legal_actions":[]}
{"type":"action","action":{"type":"end_turn"},"reason":"bank RAM"}
{"type":"events","events":[]}
{"type":"game_over","report":{}}
```

Invalid actions return an `error` message and do not mutate battle state.

## Architecture

```txt
crates/
  cardiverse-core/    deterministic battle engine
  cardiverse-ai/      LLM compiler, normalizer, AI suggestions
  cardiverse-agent/   headless playtest, reports, JSONL protocol
  cardiverse-tui/     Ratatui battle stage
  cardiverse-cli/     cardiverse command entrypoint

src/                  legacy TypeScript prototype
```

Core rule: dependencies point inward. The LLM can propose cards and decisions, but it cannot decide battle outcomes.

## Validation

Normal suite:

```bash
cargo fmt --check
cargo test
cargo build
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

Live LLM smoke test:

```bash
cargo test -p cardiverse-ai live_llm_compile_accepts_project_env -- --ignored --nocapture
```

Live observer smoke test:

```bash
cargo run -p cardiverse-cli -- observe --policy llm --episodes 1 --max-steps 3 --out .terminal-cardiverse/playtests/llm-smoke
```

These live tests load the project `.env` and should never print the API key.

## Roadmap

- Better Boss behaviors and more visible intent tells.
- Stronger card archetypes across Attack, Daemon, and Kernel.
- Replay viewer and shareable battle summaries.
- Balance simulation across many AI playtests.
- GitHub issue templates generated from playtest reports.
- Optional npm wrapper for Rust binaries.

## Contributing

The best issue includes:

- A replay or `trace.jsonl`.
- The generated `issue.md` if it came from agent playtest.
- Your terminal size and provider model.
- What felt unclear, slow, unfair, or exciting.

The fastest way to find useful issues is:

```bash
cargo run -p cardiverse-cli -- observe --policy llm --episodes 1 --out .terminal-cardiverse/playtests/live
```

Then open `.terminal-cardiverse/playtests/live/issue.md` and turn the strongest finding into a GitHub issue.
