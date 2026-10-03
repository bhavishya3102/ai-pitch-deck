# PitchPress

Write one sentence about what you're presenting. An AI agent writes the deck for the audience you pick,
illustrates every slide, and you present it full screen — watching each step of the job as it runs.
Whatever the room asks for during that presentation is captured on the slide it belongs to, and the
agent can apply it afterwards.

```
idea → Inngest job → OpenAI agent (guardrails) → image per slide → ImageKit → Postgres → present
```

## What's inside

| Part | Stack |
|---|---|
| `backend/` | Express 5, Inngest, OpenAI Agents SDK, Prisma 7 + Postgres (Neon), ImageKit, Clerk |
| `frontend/` | React 19 + Vite, TanStack Query, Clerk |

Features: live pipeline view, per-slide images, **edit any slide**, **re-illustrate a single slide**,
**export to PPTX / PDF**, full-screen presenting with a highlighter and a laser pointer, stop & delete a running
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

## Quotas

Every signed-in account has a spend cap, enforced before a job is queued. Two clicks at once share one
lock, so they cannot both slip under the limit. The defaults are a free tier; set them in `backend/.env`.

| Limit | Default | What it counts | Resets |
|---|---|---|---|
| Decks | 5 / month | each deck that was actually queued | 1st of the month, UTC |
| Concurrent decks | 1 | decks still `PENDING` or `GENERATING` | when that deck finishes or is deleted |
| Image regenerations | 30 / day | **Regenerate image** only — the pictures inside a new deck are part of the deck | midnight UTC |
| Slide rewrites | 30 / day | **Apply with AI** | midnight UTC |

A request over the limit returns `429` and creates nothing. If Inngest cannot be reached, the charge is
removed and the deck is marked `FAILED`, same as before. Deleting a finished deck does not give the
monthly deck back — the OpenAI call already ran. Deleting one that is still generating does free the
concurrency slot.

`GET /api/decks/quota` returns what is left. The composer and the signed-in landing page show it, and
disable **Generate** only once that response says the next deck will be refused. If the quota request
itself fails, the button stays available and the server still decides.

## Deck options

The composer sets three things before the agent runs, and they are saved on the deck so a
re-run produces the same kind of deck:

| Option | Choices | What it changes |
|---|---|---|
| **For** | Investors · Team · Customers | who the agent writes to, and the slide arc it follows |
| **Tone** | Confident · Plain · Bold | how the sentences read |
| **Slides** | 5 · 7 · 10 | how long the deck is |

Each audience has its own arc — investors get *Problem · Solution · Market · Business Model · The Ask*,
the team gets *Context · What we're building · Why now · The plan · What we need*, customers get
*The problem you have · What it does · How it works · Pricing · Get started* — and the agent stretches
or merges those headings to land on the chosen length.

The landing page keeps its single CTA and uses the defaults (investors, confident, 7 slides), which is
exactly what the app produced before options existed. Existing decks were backfilled with the same
defaults, so nothing re-reads differently.

> OpenAI's structured output can't enforce array length, so the schema accepts one slide either side of
> the number you picked. That only stops a near miss from throwing away a finished deck — the deck header
> always reports the slides that actually exist.

## How generation works

`backend/src/inngest/functions/generate-deck.ts` — each step is retryable and visible in the Inngest UI:

| Step | What it does |
|---|---|
| `load-deck` | find the idea in Postgres |
| `mark-generating` | set status, clear slides from a previous run |
| `run-agent` | agent (built from the deck's audience, tone and length) writes the slides; guardrails check input and output |
| `image-n` | generate the image → upload to ImageKit → return the URL |
| `save-slide-n` | delete-then-create in one transaction, so a retry can't duplicate a slide |
| `mark-complete` | status `COMPLETE` |

Two smaller functions handle one slide on their own and listen to the same `deck/cancel` event:
`regenerate-slide-image.ts` (a new picture) and `rewrite-slide-text.ts` (new wording, from one piece of
feedback). Neither one touches the rest of the deck.

Things that would otherwise waste money or hang are non-retriable: a missing `OPENAI_API_KEY`,
a guardrail block, and a deck (or slide) deleted mid-run. Deleting a deck sends `deck/cancel`, which stops
all three functions through their `cancelOn`.

## Editing and re-illustrating

Open a deck and use **Edit slide** to change the title, the bullet points, or the image prompt.
Limits match what the agent is allowed to produce (title 3–80, content 20–500, prompt 10–300 characters),
so an edited deck stays exportable.

**Regenerate image** (on the slide image) queues `slide/regenerate-image`, a separate Inngest function that
re-illustrates just that slide from its current prompt — so you can fix one bad image without rebuilding
the deck. The slide carries its own `imageStatus` (`READY` / `GENERATING` / `FAILED`); the UI keeps polling
while any slide is mid-regeneration, and the old image stays on screen until the new one is saved. Each
upload gets a fresh file name, so no browser ever shows a stale cached image.

## Feedback from the room

A deck is rarely right the first time — the useful part is what people say while you present it.

While presenting:

| Key | What it captures |
|---|---|
| `N` | opens a note box on the current slide. `Enter` saves, `Shift`+`Enter` adds a line, `Esc` cancels |
| `M` | flags the slide without typing — one keypress, fill in the detail after the meeting |

The note box owns the keyboard while it is open, so arrow keys, `H`, `L` and `F` can't fire mid-sentence and
`Esc` closes the box rather than the presentation. Confirmation appears immediately rather than after the
round trip, so nothing gets pressed twice in front of a room.

Back in the deck, **Feedback from the room** lists every note under its slide: tick one off, edit it,
delete it, or click the slide heading to bring it up in the viewer. A flag with no detail reads
*"Flagged — no detail yet"* until you add it.

**Apply with AI** hands one note to the agent as an instruction and queues `slide/rewrite-text`, which
rewrites *that slide only* — the same per-slide shape as image regeneration. The agent is told to change
only what the feedback asks for and never to invent figures it wasn't given, so "they want India-only
numbers" rewrites the bullet and leaves a placeholder rather than a made-up total. The slide carries its
own `textStatus` (`READY` / `REWRITING` / `FAILED`), the note is ticked off once the new wording lands,
and a failed attempt keeps the old wording and says so.

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
| `POST` | `/api/decks` | create a deck and queue the job — `{ idea, audience?, tone?, slideCount? }`, idea ≥ 20 characters. `429` when the monthly or concurrency quota is used up |
| `GET` | `/api/decks` | list your decks |
| `GET` | `/api/decks/quota` | decks, image regenerations and rewrites left on this account |
| `GET` | `/api/decks/:id` | one deck with slides (the UI polls this) |
| `DELETE` | `/api/decks/:id` | stop the run if any, then delete deck + slides |
| `PATCH` | `/api/decks/:deckId/slides/:slideId` | edit title / content / image prompt |
| `POST` | `/api/decks/:deckId/slides/:slideId/regenerate-image` | queue a new image for one slide |
| `POST` | `/api/decks/:deckId/slides/:slideId/notes` | capture feedback on a slide (empty body = a flag) |
| `PATCH` | `/api/decks/:deckId/notes/:noteId` | edit a note's text or tick it off |
| `DELETE` | `/api/decks/:deckId/notes/:noteId` | remove a note |
| `POST` | `/api/decks/:deckId/slides/:slideId/rewrite` | apply one note — the agent rewrites that slide |
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
| `L` | laser — a tight dot on the word under the cursor; the slide stays fully lit. Works together with the highlighter |
| `F` | toggle full screen |
| `N` | write a note on this slide |
| `M` | flag this slide, no typing |
| `Esc` | close the note box, or leave the presentation |

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
| "Apply with AI" says nothing to apply | the note is still an empty flag — add the detail first (409) |
| Deck creation returns 400 on `audience` / `tone` / `slideCount` | only the listed choices are accepted — see **Deck options** |
| Deck creation returns 429 | the monthly deck quota or the one-at-a-time limit — see **Quotas**. Delete a deck stuck on Generating to free the slot; that does not refund the month |
| `GET /api/decks/quota` returns 500 | the `UsageCharge` migration has not been applied — `npx prisma migrate deploy --config prisma7.config.ts` |
| Deck came out one slide short or long | within the tolerance the schema allows; the header shows the real count |
| Slide shows `couldn't rewrite this slide` | the rewrite failed; the old wording is kept, press Apply again |
| Every DB query fails with `ETIMEDOUT` | the machine has no IPv6 route but the database host publishes AAAA records — `src/index.js` disables Node's address auto-selection for this |
