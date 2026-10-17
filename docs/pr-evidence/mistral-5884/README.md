# NextChat #5884 — native Mistral chat provider

This directory is on an **evidence-only fork branch**, not in the feature PR.

- Baseline: `9b4ac8e1c54318148234bce71e32d3d272907dc5`
- Feature source: `a3c8f6c9b2736eeb77fcb51a70836a3966964443`
- Capture: real Chromium pages, Chinese locale, 1440 × 1000 viewport.
- `before-settings.png`: unchanged baseline, no Mistral provider in the select options.
- `after-settings.png`: Mistral settings, masked synthetic key, selected Mistral model.
- `after-streaming-chat.png`: real page after receiving a streamed fixture reply.
- `mistral-streaming.webm`: 13.8-second recording of a second streamed reply.
- `browser-cancellation.json`: result of clicking the real Stop response control; the upstream fixture observed cancellation.

## Evidence boundary

The UI, client provider, same-origin Next.js proxy and HTTP/SSE transport are real.
The upstream is the supplied local fixture, **not a live Mistral account**.
Its reply says this explicitly. Only synthetic credentials and synthetic prompts
were used. No screenshots were generated or replaced with mock product markup.
No paid model calls were made. Native Tauri packaging and live Mistral account
behavior have not been tested.

## Reproduce locally

1. Check out the feature commit above and install the locked dependencies.
2. Run `node mistral-fixture.mjs` from this evidence directory (port 3512).
3. In the feature checkout, run:

   ```sh
   MISTRAL_URL=http://127.0.0.1:3512 \
   MISTRAL_API_KEY=server-mistral-fixture-key \
   yarn next dev --hostname 127.0.0.1 --port 3511
   ```

4. Run `node verify-http.mjs` from this directory.
5. In the real UI, enable Custom Endpoint, select Mistral, keep `/api/mistral`,
   enter `client-mistral-fixture-key`, and select `mistral-large-latest`.
6. Send a text prompt. To test cancellation, start a prompt with `[slow]` and
   click Stop response. Inspect `http://127.0.0.1:3512/events`; the corresponding
   request should have `authValid: true` and `aborted: true`.

## Local lint environment

The locked clean installation lacks the optional TypeScript ESLint plugin,
causing `unused-imports/no-unused-imports` to crash even on the unchanged baseline.
For local validation only, `@typescript-eslint/eslint-plugin@6.4.0` was supplied
from an isolated tool directory with TypeScript 5.2.2, matching the checkout's
parser and TypeScript versions. No tracked dependency, lockfile, ESLint rule or
Git hook was changed or disabled. The normal Husky/lint-staged hook passed.
