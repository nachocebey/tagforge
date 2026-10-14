# Commander Deck Builder

A Magic: The Gathering Commander deck builder — a hybrid of Moxfield (free-form deck organization into user-defined blocks) and Scryfall (rich card search syntax). Users pick a commander, build a 99-card deck by dragging cards into custom blocks, and save progress to an account.

App language: **English** (Scryfall card data is English-only; no UI localization).

## MVP scope

**In scope:**
- Commander selection (+ second commander for Partner/Background/"Choose a Background")
- Deck building via custom drag-and-drop blocks
- Scryfall-syntax card search, filtered by commander color identity
- Deck counter (99 + commander), mana curve, color pie
- Plain-text export (Moxfield-compatible format) and import
- Card collection tracking (owned/unowned per card, shared across all of a user's decks — not a full collection system, no quantities/printings)
- Self-hosted user accounts (register/login) to save/load decks
- Autosave while building
- EDHREC recommendations for an empty deck ("You could start with...") — commander page has no official API; this scrapes/calls EDHREC unofficially, so treat it as best-effort and expect it to need upkeep if EDHREC's page structure changes

**Explicitly out of scope for now (no hooks/stubs for these yet):**
- Commander Bracket system / bracket legality validation
- Mobile/responsive support — **desktop-only**
- Email verification, password recovery
- Card printing/version selection (art, set)
- Deck price tracking

Don't design in a way that blocks adding brackets later, but don't build hooks for it now either.

## User flow (build screen)

1. Elongated header block to search/select the commander by name.
2. On selection, the block collapses to a compact layout: color identity, name, oracle text, image on the right.
3. If the commander allows a second commander (Partner, Background, etc.), a slot appears below for it, rendered the same compact way once chosen.
4. Beside the header (minimal vertical space): total card counter (X/100 incl. commander), mana curve, color pie, and a **global sort** selector (mana cost / price / release date) that reorders cards inside every block at once.
5. Main area: CSS Grid of user-defined blocks. Each block has:
   - User-editable name (free text, not tied to any Scryfall tag)
   - Its own card counter, top-right
   - "+" button → card search (name, Scryfall-like syntax, Tagger tags), always filtered by commander color identity. Cards already in the deck are excluded from results (except basics — see singleton rule).
   - Each card row shows: mana cost, name, price, trash icon to remove.
   - Drag-and-drop cards between blocks only. No reordering within a block (global sort controls in-block order). Drop outside a valid block = snap back, no-op.
6. Dashed-border skeleton block at the end: "Click here to add a block" to create a new one.
7. **Singleton rule:** no duplicate cards in the deck. Exception: the 6 basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes) are unlimited and always appear in search regardless of copies already in the deck. (5 more cards share this exception by their own oracle text — Shadowborn Apostle, Relentless Rats, Persistent Petitioners, Dragon's Approach, Rat Colony — deferred post-MVP.)
8. No special lands block — users make their own "Lands" block like any other.
9. Export-to-plaintext button, accessible from the build screen.
10. Scryfall attribution ("Card data and images provided by Scryfall") required in the footer.

## Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, Zustand, tRPC client + React Query
- **Backend:** Node.js + TypeScript, Fastify, tRPC v11 server
- **ORM:** Prisma 7. The schema's `datasource` block has no `url` — Prisma 7 dropped that in favor of driver adapters. Connection config lives in `apps/backend/prisma.config.ts` (used by the CLI/migrations) and in `apps/backend/src/db.ts`, which builds `PrismaClient` from `@prisma/adapter-pg` (`pg` under the hood). Any new script that needs the DB should import `prisma` from `src/db.ts` rather than instantiating its own client.
- **Database:** PostgreSQL (JSONB for the deck structure, native full-text search)
- **Monorepo:** npm workspaces, `apps/frontend` + `apps/backend`. `npm run dev` (root) runs both concurrently — `predev` also boots Postgres via Docker (see below).
- **Hosting:** frontend on Vercel; backend+DB on a free-tier-friendly Postgres host (TBD at deploy time, not a blocker for local dev)
- Prioritize open-source, free/low-cost tooling throughout.

## Local Postgres

`docker-compose.yml` at the repo root runs Postgres 16 for local dev (`docker compose up -d`; matches the credentials already in `apps/backend/.env.example`/`.env`). Once it's up: `npm run prisma:migrate -w apps/backend` to apply the schema, then `npm run ingest -w apps/backend` to populate it from Scryfall.

## Accounts & persistence

- **Self-rolled auth** (not Supabase Auth or similar) — deliberate choice, even though it costs more time.
- MVP auth scope: register + login + password hashing (bcrypt/argon2) + session management. No email verification, no password recovery yet.
- Basic rate limiting on the login endpoint.
- Saved-deck limit per user: soft cap of ~50.
- Autosave with debounce (1-2s after last action, not per-event).
- A deck is persisted as its **full block structure** (block name, order, cards per block) in one JSONB column — not a flat card list with a block-id column. This lets a deck reload exactly as it was left, with no reconstruction logic.

## Implementation details by area

Non-obvious decisions and gotchas for the ingestion pipeline, search API, deck API, and auth live in `.claude/rules/` (`ingestion.md`, `search-api.md`, `deck-api.md`, `auth.md`) — they're path-scoped and load automatically only when you're working in the matching files, instead of every session.

**Keeping this current:** after finishing work that changes architecture, a non-obvious decision, or a gotcha (not routine feature work) — ask whether to update this file or the relevant `.claude/rules/*.md` file. Don't ask for changes that are self-evident from reading the code.

## Claude Code permissions for this project

`.claude/settings.json` auto-allows: reading/creating/editing repo files, dev server, tests, linter, build, project scripts (including the bulk-data ingestion script), and `git add`/`commit`/`diff`/`status`/`log`.

Always asks first: installing/uninstalling packages, deleting files/folders, anything outside the project directory, `git push`, and anything touching `.env`/secrets.

Local personal-machine dev environment (not CI/containerized) — permissions are tuned accordingly.
