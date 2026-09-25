# PitchPress

Write one sentence about a startup idea. An AI agent writes the pitch deck, illustrates every slide,
and you present it full screen — watching each step of the job as it runs.

```
idea → Inngest job → OpenAI agent (guardrails) → image per slide → ImageKit → Postgres → present
```

## What's inside

| Part | Stack |
|---|---|
| `backend/` | Express 5, Inngest, OpenAI Agents SDK, Prisma 7 + Postgres (Neon), ImageKit, Clerk |
| `frontend/` | React 19 + Vite, TanStack Query, Clerk |

Features: live pipeline view, per-slide images, **edit any slide**, **re-illustrate a single slide**,
**export to PPTX / PDF**, full-screen presenting with a highlighter, stop & delete a running
generation, and per-user decks behind sign-in.

## Setup

### 1. Accounts and keys

You need four things, all with free tiers:

| Service | What you need | Where |
|---|---|---|
| Postgres | connection string | [Neon](https://neon.tech) or any Postgres |
| OpenAI | API key | [platform.openai.com](https://platform.openai.com/api-keys) |
| ImageKit | private key | [imagekit.io](https://imagekit.io) → Developer options |
| Clerk | publishable + secret key | [dashboard.clerk.com](https://dashboard.clerk.com) → API keys |

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env     # then fill in the values
npx prisma migrate deploy --config prisma7.config.ts
npm run dev              # http://localhost:4000
```

`backend/.env`:

```env
PORT=4000
DATABASE_URL="postgresql://..."

# Clerk — both keys are required, the API returns 503 without them
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# OpenAI — writes the slides, and the images unless placeholders are on
OPENAI_API_KEY=sk-...
# true = free stock photos instead of paid image generation (local testing)
USE_PLACEHOLDER_IMAGES=false

# ImageKit — only the private key is used for uploads
IMAGEKIT_PRIVATE_KEY=private_...

# Inngest — INNGEST_DEV=1 for local dev
INNGEST_DEV=1
```

### 3. Inngest dev server

The background job only runs while this is up:

```bash
cd backend
npm run inngest:dev      # http://localhost:8288
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # add VITE_CLERK_PUBLISHABLE_KEY
npm run dev              # http://localhost:5173
```

`frontend/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Vite proxies `/api` to `http://localhost:4000`, so there is no CORS setup.

Three terminals in total: backend, Inngest dev server, frontend.

## Authentication

Clerk guards the deck routes, and every deck is stored with the Clerk `userId`.

- `/` — landing page, public
- `?auth=sign-in`, `?auth=sign-up` — sign-in / sign-up, styled to match the app
- `?app=1`, `?deck=<id>` — the studio, signed-in users only

After **sign-up** you land on the home page (the idea box is right there); after **sign-in** you go
straight to your decks. An idea typed while signed out is kept through the redirect and pre-filled for you.

**If keys are missing**, nothing crashes: the frontend shows a setup page instead of a blank screen,
and `/api/decks` answers `503` with the reason. `/health` and the Inngest endpoint keep working either way.

**Deck isolation:** every query filters on `userId`, so another user's deck simply reads as "not found".
Decks created before auth existed were kept and marked `legacy-unclaimed` — they belong to no account
and are invisible in the UI.

## How generation works

`backend/src/inngest/functions/generate-deck.ts` — each step is retryable and visible in the Inngest UI:

| Step | What it does |
|---|---|
| `load-deck` | find the idea in Postgres |
| `mark-generating` | set status, clear slides from a previous run |
| `run-agent` | agent writes the slides; guardrails check input and output |
| `image-n` | generate the image → upload to ImageKit → return the URL |
| `save-slide-n` | delete-then-create in one transaction, so a retry can't duplicate a slide |
| `mark-complete` | status `COMPLETE` |

A second function, `regenerate-slide-image.ts`, handles one slide on its own and listens to the same
`deck/cancel` event.

Things that would otherwise waste money or hang are non-retriable: a missing `OPENAI_API_KEY`,
a guardrail block, and a deck (or slide) deleted mid-run. Deleting a deck sends `deck/cancel`, which stops
both functions through their `cancelOn`.

## Editing and re-illustrating

Open a deck and use **Edit slide** to change the title, the bullet points, or the image prompt.
Limits match what the agent is allowed to produce (title 3–80, content 20–500, prompt 10–300 characters),
so an edited deck stays exportable.

**Regenerate image** (on the slide image) queues `slide/regenerate-image`, a separate Inngest function that
re-illustrates just that slide from its current prompt — so you can fix one bad image without rebuilding
the deck. The slide carries its own `imageStatus` (`READY` / `GENERATING` / `FAILED`); the UI keeps polling
while any slide is mid-regeneration, and the old image stays on screen until the new one is saved. Each
upload gets a fresh file name, so no browser ever shows a stale cached image.

## Export

| Format | Endpoint | Built with |
|---|---|---|
| PowerPoint | `GET /api/decks/:id/export?format=pptx` | `pptxgenjs`, 16:9, one slide per deck slide |
| PDF | `GET /api/decks/:id/export?format=pdf` | `pdfkit`, 960 × 540 pt landscape pages |

Both are rendered on the server in the app's own palette (paper background, serif titles, orange rule,
image on the right) and include the current text — edits and regenerated images are picked up immediately.
A slide whose image can't be fetched still exports, just without the picture. The download carries the
Clerk token, so files are only ever built for decks you own.

## API

All deck routes need a Clerk session token and only ever touch the caller's own decks.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/decks` | create a deck and queue the job (idea ≥ 20 characters) |
| `GET` | `/api/decks` | list your decks |
| `GET` | `/api/decks/:id` | one deck with slides (the UI polls this) |
| `DELETE` | `/api/decks/:id` | stop the run if any, then delete deck + slides |
| `PATCH` | `/api/decks/:deckId/slides/:slideId` | edit title / content / image prompt |
| `POST` | `/api/decks/:deckId/slides/:slideId/regenerate-image` | queue a new image for one slide |
| `GET` | `/api/decks/:id/export?format=pptx\|pdf` | download the deck as a file |
| `GET` | `/health` | no auth |
| `ALL` | `/api/inngest` | Inngest's own endpoint, no auth |

## Presenting

Open a deck and press **Present**:

| Key | Action |
|---|---|
| `→` / `Space` | next slide |
| `←` | previous slide |
| `H` | highlighter — dims everything except a circle around the cursor (scroll to resize) |
| `F` | toggle full screen |
| `Esc` | leave |

## Troubleshooting

| Symptom | Cause |
|---|---|
| Deck stuck on **Queued** | Inngest dev server isn't running (`npm run inngest:dev`) |
| Deck fails with `OPENAI_API_KEY is not set` | missing key in `backend/.env` |
| `/api/decks` returns 503 | Clerk keys missing or malformed in `backend/.env` |
| Frontend shows "One key away" | `VITE_CLERK_PUBLISHABLE_KEY` missing in `frontend/.env` |
| Deck stays GENERATING forever | the backend or Inngest was restarted mid-run; the run is gone — delete the deck |
| Images cost too much while testing | set `USE_PLACEHOLDER_IMAGES=true` (free stock photos; slide text still uses OpenAI) |
| "Regenerate image" fails instantly | Inngest dev server isn't running; the slide shows `couldn't re-illustrate` and keeps its old image |
| Export says the deck has no slides | generation hasn't produced any slide yet (409) |
