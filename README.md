# Little games — Tic tac toe

Play X against Jev as O. Built with Next.js, React, TypeScript, Bun, and the Vercel AI SDK.

## Development

```sh
bun install
```

Set `AI_GATEWAY_KEY` in `.env.local` (or the server environment) to your Vercel AI Gateway key. Environment files are ignored by Git; the key is only read by the server.

```sh
bun run dev
```

Open http://localhost:3000. After each X move, Jev chooses O’s move. A failed request offers a retry, and restarting cancels any pending move.

The decision log beside the board records each O move with a board snapshot, the highlighted choice, and every legal option’s model weight. Weights are shown as percentages of the returned Choice distribution, not win probabilities. Missing weights are marked N/A. Newest moves appear first, and restarting clears the log. On small screens the log sits below the board.

Each entry also shows response confidence from Jev’s `providerMetadata.typesafe.confidence.move`, as a percentage. This is a separate provider statistic from the option weights. Missing or invalid confidence is shown as “Not provided.”

## Model integration

`POST /api/move` validates the board and calls `experimental_evaluate` using `createGateway({ apiKey: process.env.AI_GATEWAY_KEY })` and `gateway.evaluationModel("typesafe-ai/jev")`. The evaluation asks a Choice question whose options contain only empty squares. The selected move is validated before being applied. There is no fallback opponent.

The [evaluation API](https://ai-sdk.dev/docs/ai-sdk-core/evaluation) is experimental. The Bun lockfile records the installed SDK version. Model play quality is determined by Jev; it is not guaranteed to be optimal.

## Checks

```sh
bun run test
bun run lint
bun run build
```

Tests use the SDK evaluation mock and do not make paid model calls. They cover board validation, legal move choices, invalid responses, terminal games, cancellation, and API input errors.
