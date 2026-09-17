# Jev Playground

A playground for benchmarking **TypeSafe AI’s Jev against other evaluation models** in games with explicit states, legal actions, and measurable outcomes.

The core question: how well does each model choose the next action when the rules and available choices are clearly defined? Games provide a small, inspectable environment for exploring decision quality, tactical reasoning, and consistency across a sequence of moves.

## How it works

Each game acts as a state machine:

```mermaid
flowchart LR
  state[Current state] --> actions[Legal actions]
  actions --> model[Model evaluation]
  model --> choice[Validated choice]
  choice --> next[Next state]
  next -->|Game continues| state
  next -->|Game ends| result[Win, loss, or draw]
```

The game code owns the rules, legal actions, state transitions, and terminal conditions. The model chooses among the actions it is given. This keeps the decision visible: you can inspect the position, the available moves, and the choice that changed the game.

All opponents use the Vercel AI SDK’s experimental evaluation interface and receive the same game state, legal options, and instructions. Jev uses a native evaluation model through AI Gateway; the other opponents use the SDK’s evaluation adapter around Gateway language models.

## Models

| Provider | Model | AI Gateway ID |
| --- | --- | --- |
| TypeSafe AI | Jev | `typesafe-ai/jev` |
| OpenAI | GPT-5.6 Luna | `openai/gpt-5.6-luna` |
| Anthropic | Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` |
| Google | Gemini 3.5 Flash Lite | `google/gemini-3.5-flash-lite` |

The model list lives in [`src/lib/models.ts`](src/lib/models.ts). Model identifiers above are the Gateway IDs used by this app; direct provider SDKs may use different names.

## First game: tic-tac-toe

Choose an opponent and play X; the model plays O. Changing models starts a fresh game.

For each model turn, the server supplies the board and every legal move as a Choice option. Options have descriptive names such as `center` and `top_left`, coordinates, and the resulting board. Shared instructions describe the rules and priorities: win, block, create or prevent forks, and preserve a draw against optimal play.

The decision log shows each chosen move, a board snapshot, option weights when returned, and provider confidence when available. Failed requests can be retried. Restarting cancels the pending request and clears the log.

**Reading the results:** option weights describe the model’s returned Choice distribution; they are not win probabilities. Response confidence is a separate provider statistic and is not assumed to be comparable across models. Missing values are shown as unavailable, rather than inferred.

## Benchmark direction

The current app supports interactive comparisons in tic-tac-toe. Automated tournaments, aggregate scores, and additional games are future work.

The benchmark should compare models on shared starting states and rules, tracking:

- **Decision quality:** wins, draws, losses, and missed winning or defensive moves.
- **Consistency:** how choices vary across repeated evaluations of the same state.
- **Reliability:** invalid responses, failed requests, and timeouts.
- **Efficiency:** latency and cost per decision and completed game.

Reproducible runs should record model versions, game states, instructions, and evaluation settings. Interactive play is useful for finding interesting positions; controlled runs are needed to make broader performance claims.

## Run locally

Built with Next.js, React, TypeScript, Bun, and the Vercel AI SDK.

```sh
bun install
```

Create `.env.local` with your Vercel AI Gateway key:

```dotenv
AI_GATEWAY_KEY=your_gateway_key
```

```sh
bun run dev
```

Open [localhost:3000](http://localhost:3000), select a model, and make your first move. The key is read only on the server, and environment files are ignored by Git.

## Project map

| File | Purpose |
| --- | --- |
| [`src/lib/game.ts`](src/lib/game.ts) | Board schemas, turn validation, and terminal conditions |
| [`src/lib/models.ts`](src/lib/models.ts) | Available opponents and model IDs |
| [`src/lib/ai-move.ts`](src/lib/ai-move.ts) | Shared evaluation instructions, legal choices, and response mapping |
| [`src/app/api/move/route.ts`](src/app/api/move/route.ts) | Request validation, model selection, and Gateway calls |
| [`src/app/page.tsx`](src/app/page.tsx) | Game interface and turn flow |
| [`src/app/decision-log.tsx`](src/app/decision-log.tsx) | Move history, option weights, and confidence |

## Checks

```sh
bun run test
bun run lint
bun run build
```

Tests use mocked evaluations and do not make paid model calls. The evaluation API is experimental; `bun.lock` records the installed SDK versions.

## References

- [AI SDK evaluation API](https://ai-sdk.dev/docs/ai-sdk-core/evaluation)
- [TypeSafe Choice: structured instructions and criteria](https://docs.typesafe.ai/primitives/choice#structured-instructions-and-criteria)
