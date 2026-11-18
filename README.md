# capsule-web

Web client for **Capsule**. For now it is one thing: the **fitting room**, a test chat for seeing
how the stylist model answers, what it understands and how it uses its tools.

React 19 · TypeScript · Vite · Vitest + Testing Library

## Run it

`capsule-api` must be running first (see its README), with `http://localhost:5173` in its
`CORS_ORIGINS` and Ollama serving the configured model.

```bash
npm install
npm run dev        # http://localhost:5173
```

Create a test account on the sign-in screen, then ask something. To point at a different API,
copy `.env.example` to `.env.local` and change `VITE_API_URL`.

## What you can see

- **The answer as it streams**, rendered as plain text.
- **Every tool call** as a tag on the conversation: its name, how long it took, and, when opened,
  exactly what the model sent and what came back. A failed call is outlined in red.
- **A tape under each answer**: time to the first word, total time, number of model calls and
  token counts, with the tape's length proportional to the total time (28 px per second).
- **Settings**: switch tools off, replace the system prompt for the next message, and check
  which model serves each task and whether its provider is reachable.

The three sample questions on the empty screen each lead the model to a different tool.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run check` | Everything CI runs: format, lint, typecheck, tests, build |
| `npm test` | Unit and component tests |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` from `../capsule-api/openapi.json` |
| `npm run e2e` | The thin path in a phone browser, against the real stack (below) |

### End-to-end

`npm run e2e` runs `e2e/thin-path.e2e.ts` in Chromium with a Pixel 7 profile: sign up, answer the
quiz, upload a photo and wait for its tags, ask the stylist, rate the outfit, see the feedback.
Playwright builds and starts `../capsule-api` on port 3100 and this app on 5174, and stops both
afterwards. It needs what `npm run setup` in capsule-api starts (Postgres, SeaweedFS), Ollama with
the configured models, and the photo bucket allowing uploads from `http://localhost:5174`. It is
not part of `npm run check`, because CI has no stack. First time: `npx playwright install chromium`.

## Layout

```
src/
  api/        Typed client (types generated from the API contract), SSE parser, chat stream
  features/
    auth/     Sign in, register, session with one automatic token refresh
    chat/     Chat screen, state reducer, tool tags, timing tape, settings
  strings/    Every user-facing string, keyed by locale (English only for now)
  test/       Test setup and a fake API
```

## Notes

- Tokens are kept in memory only, so reloading the page signs you out.
- The conversation is not saved anywhere. The API is stateless and the client sends the whole
  conversation with each message; tool calls from earlier turns are not re-sent.
- Model output is shown as plain text. Markdown is not rendered.
