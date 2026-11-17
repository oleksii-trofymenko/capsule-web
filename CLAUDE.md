# capsule-web

Web client for Capsule. Read `../CLAUDE.md` first: the product description, goals, branch
workflow, coding rules and secrets rules there all apply here. This file only adds frontend
specifics.

Status: scaffolded with one screen set, the fitting room: a developer test chat against
`POST /v1/playground/chat`. The product screens (wardrobe, quiz, outfits) are not built yet.

## Commands

| Command | Use |
|---|---|
| `npm run dev` | Development server on port 5173 |
| `npm run check` | Format, lint, typecheck, tests, build. Must pass before work is done |
| `npm test` | Unit and component tests |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` after the backend's `openapi.json` changes |

## What this app is

The browser client for Capsule: sign in, upload and browse the wardrobe, chat with the stylist,
view and rate outfits. It is a thin client. It renders state and collects input; it holds no
business rules, so the Expo app can reuse the same backend unchanged.

## Stack

In use: React 19 · TypeScript (strict) · Vite · Vitest + Testing Library · oxlint · Prettier ·
API types generated from `../capsule-api/openapi.json` into `src/api/schema.d.ts`.

Planned, add only when a task needs it: React Router, TanStack Query, Playwright.

The fitting room is deliberately small and has no router or query library. Server-Sent Events are
read with `fetch` in `src/api/chat.ts`, because the chat endpoint is a streaming POST.

## Rules

API:

- Use only the generated API client and its types. Never hand-write a request or response type.
  If the type is wrong, the backend contract is wrong: fix it there and regenerate.
- No outfit, budget, pricing or permission logic in the client. Display what the API returns.
- Server data lives in the query cache. Do not copy it into component or global state.
- Chat streaming uses the backend's event protocol as documented; do not parse model output here.

Code:

- Function components and hooks only. One component per file, named as the file.
- Organise by feature (`features/wardrobe`, `features/stylist`), not by file type.
- Keep state as local as possible. Add global state only when two distant features need it.
- Extract a shared component on its third use, not its first.
- No new UI or state library without a stated reason.

Security:

- Only variables prefixed `VITE_` reach the browser, and everything in the bundle is public.
  Never put a secret, API key or model key in frontend code or frontend environment variables.
- The browser never calls a model or object storage with credentials. It calls the API, and
  uploads photos to the presigned URL the API returns.
- Keep the access token in memory. Do not store tokens in `localStorage`.
- Never use `dangerouslySetInnerHTML` with model or user content. Render model output as text
  or through a sanitising markdown renderer.
- Validate file type and size before upload for user feedback; the backend still enforces it.

Quality:

- Every screen handles loading, empty and error states.
- Accessible by default: semantic HTML, labels on inputs, keyboard reachable, visible focus,
  alt text on wardrobe images.
- Mobile-first layouts. Most users will photograph clothes with a phone.
- English only for now. User-facing text goes through one place, keyed by locale, so it can be
  translated later; no strings scattered in logic. Do not add other languages until asked.

Testing:

- Unit: pure functions and hooks.
- Component: Testing Library, querying by role and label as a user would. No snapshot tests of
  whole pages.
- E2E: Playwright for the critical journeys (sign up, upload an item, get an outfit).
- Mock at the network boundary using the generated types, never by mocking internal modules.

Metrics:

- Report Core Web Vitals and unhandled errors to the backend or the configured collector.
  Never include personal data, tokens or photo contents in a report.
