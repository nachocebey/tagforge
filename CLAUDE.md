# Commander Deck Builder

A Magic: The Gathering Commander deck builder — a hybrid of Moxfield (free-form deck organization into user-defined blocks) and Scryfall (rich card search syntax). Users pick a commander, build a 99-card deck by dragging cards into custom blocks, and save progress to an account.

App language: **English** (Scryfall card data is English-only; no UI localization).

## MVP scope

**In scope:**
- Commander selection (+ second commander for Partner/Background/"Choose a Background")
- Deck building via custom drag-and-drop blocks
- Scryfall-syntax card search, filtered by commander color identity
- Deck counter (99 + commander), mana curve, color pie
- Plain-text export (Moxfield-compatible format)
- Self-hosted user accounts (register/login) to save/load decks
- Autosave while building

**Explicitly out of scope for now (no hooks/stubs for these yet):**
- Commander Bracket system / bracket legality validation
- EDHREC integration (synergies, % of decks, etc.)
- Mobile/responsive support — **desktop-only**
- Email verification, password recovery
- Card printing/version selection (art, set)
- Deck price tracking

Don't design in a way that blocks adding brackets or EDHREC later, but don't build hooks for them now either.

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
- **Monorepo:** npm workspaces, `apps/frontend` + `apps/backend`. `npm run dev` (root) runs both concurrently.
- **Hosting:** frontend on Vercel; backend+DB on a free-tier-friendly Postgres host (TBD at deploy time, not a blocker for local dev)
- Prioritize open-source, free/low-cost tooling throughout.

## Scryfall data ingestion

- Source: Scryfall Bulk Data — `oracle_cards` (card data) + `oracle_tags` (Tagger tags), joined by `oracle_id`.
- Docs: `https://scryfall.com/docs/api/bulk-data`, `https://scryfall.com/docs/api/tags`
- A daily script/cron downloads both bulk files and upserts into our DB — bulk data itself only regenerates every 12-24h, so daily ingestion is enough.
- Tags: key by the tag's `id` (stable UUID), never `slug`/`label` (mutable). Tags nest via `parent_ids`/`child_ids`; the bulk file only has direct taggings, so aggregating a parent category (e.g. "removal") means walking `child_ids` and unioning their taggings.
- Taggings carry a `weight` field — this is a **string category** in the real data (`"median"`, `"strong"`, `"very_strong"`, ...), not a number. Stored verbatim, not mapped to an invented int scale.
- Tags are community-moderated, treat as non-authoritative. No per-tag disable UI in MVP (possible future improvement).
- Images: use Scryfall's image URIs directly, never rehost.
- Color identity: use Scryfall's resolved `color_identity` field, don't recompute.

### Ingestion script

Implemented in `apps/backend/src/ingest/` (`bulk-data.ts` streams the gzip JSONL bulk files without buffering the whole thing in memory, `transform.ts` maps raw Scryfall objects to our `Card`/`Tag`/`Tagging` rows, `run.ts` orchestrates cards-then-tags upserts). Entry point: `npm run ingest -w apps/backend`.

Verified end-to-end against a real local Postgres (see "Local Postgres" below) and live Scryfall data:
- Scryfall requires a descriptive `User-Agent` + `Accept: application/json` header on every request, or it 403s.
- Bulk-data entries expose `jsonl_download_uri` (gzip-compressed JSON Lines), not a plain `download_uri`.
- `oracle_cards` also contains non-deckbuildable objects (art cards, tokens, emblems, Planechase planes, Archenemy schemes, Vanguards, Un-set Host/Augment pairs, Jumpstart front cards, silver-border jokes). These are filtered out by `legalities.commander !== 'not_legal'` rather than a hardcoded `layout` list — layout names aren't a stable/fully-documented set (e.g. `front_card` and `prepare` showed up in live data outside Scryfall's documented layout list).
- `mana_cost`, `oracle_text`, `colors`, `image_uris` are absent at the top level for some multi-faced layouts (transform, modal_dfc, flip) and must fall back to `card_faces`; `cmc`, `color_identity`, `type_line`, `legalities`, `prices`, `released_at` are always present top-level regardless of layout.
- Commander-eligibility (`canBeCommander`) is `Legendary Creature` in `type_line` OR oracle text containing "can be your commander", with a negation check for "can't be your commander" (there's a real card, The Beleaguered Boxer, that's a Legendary Creature but explicitly excluded outside a specific limited format).
- Each Tag upsert must happen before its Taggings (FK to Card), and Cards must be ingested before Tags — a tagging referencing an oracle_id we don't have is skipped (logged, not fatal). `safeUpsert` in `run.ts` retries non-FK errors a few times before giving up — under this script's concurrency, the connection pool can otherwise throw transient errors that look identical to a real failure.
- `pg.Pool`'s default `max` is 10 connections, which this script's concurrent batches (`TAGGING_CONCURRENCY = 16`) exceed. `src/db.ts` sets `max: 20` explicitly — first run without this dropped ~1000 tags and had a much higher tagging-skip rate purely from pool contention, not real data issues.
- Full run against real data: 31,913 cards ingested (0 skipped), 4,525 tags (all), 205,183 taggings (~25k skipped — all legitimate FK misses onto excluded non-legal cards, verified by spot-checking that the skipped oracle_ids aren't in `Card`). Takes ~2-3 minutes end to end.

### Local Postgres

`docker-compose.yml` at the repo root runs Postgres 16 for local dev (`docker compose up -d`; matches the credentials already in `apps/backend/.env.example`/`.env`). Once it's up: `npm run prisma:migrate -w apps/backend` to apply the schema, then `npm run ingest -w apps/backend` to populate it from Scryfall.

## Accounts & persistence

- **Self-rolled auth** (not Supabase Auth or similar) — deliberate choice, even though it costs more time.
- MVP auth scope: register + login + password hashing (bcrypt/argon2) + session management. No email verification, no password recovery yet.
- Basic rate limiting on the login endpoint.
- Saved-deck limit per user: unlimited, or a generous cap (~50) if simpler — not critical either way.
- Autosave with debounce (1-2s after last action, not per-event).
- A deck is persisted as its **full block structure** (block name, order, cards per block) in one JSONB column — not a flat card list with a block-id column. This lets a deck reload exactly as it was left, with no reconstruction logic.

## Card search API

`apps/backend/src/search/` (`query-parser.ts` tokenizes a Scryfall-like query string, `build-where.ts` turns the parsed clauses into a Prisma `Card` where-clause, `router.ts` exposes the `card.search` public tRPC procedure). Powers both the commander picker (`query: "is:commander ..."`, no `commanderColorIdentity`) and the per-block card search (`commanderColorIdentity` set, `excludeOracleIds` = current deck contents).

- Supported syntax is a **practical subset**, not the full Scryfall grammar: bare text / `"quoted phrases"` (name-only — see below), negation via a leading `-`, and `t:`/`type:`, `o:`/`oracle:`, `c:`/`color:`, `id:`/`identity:`, `cmc:`/`mv:` (with `=`,`!=`,`>`,`>=`,`<`,`<=`), `tag:`, `is:commander|background|partner`. No parentheses/OR grouping.
- Bare/quoted text matches **name only**, not oracle text — verified by testing `plains` live: matching name-or-oracle-text buried the actual card "Plains" under ~50 unrelated cards whose rules text just happens to mention "plains" (fetch effects, land-type-matters cards). Rules-text search is `o:`/`oracle:` explicitly. Multiple bare words are joined into one phrase (`sol ring` looks for that substring, not `contains("sol") AND contains("ring")`, which also matched unrelated words like "during"/"spring").
- `commanderColorIdentity` is `undefined` (no constraint — commander picker) vs `[]` (constraint to colorless cards — a real colorless commander is chosen). Passing `[]` as the "no constraint" default would have wrongly restricted the commander picker to colorless-only results; this was caught before shipping, not after.
- The singleton-rule exclusion (`excludeOracleIds`) always lets the 6 basic lands through regardless, matched by name via `BASIC_LAND_NAMES` in `basic-lands.ts` (not hardcoded oracle_ids — more robust, self-documenting, doesn't depend on which oracle_id got queried at write-time).
- `tag:<slug>` resolves the tag and walks `child_ids` recursively (tags only store direct taggings; matching a parent category like "removal" means unioning every descendant tag's taggings), then filters via `taggings.some`.
- Verified against the real ingested DB (31,913 cards): text/name search, `t:`+`is:commander` combo, color-identity constraint (Simic search returned only U/G cards), `cmc<=` comparator, `tag:grave-pact`, negation, unknown-tag (0 results, not an error), and the basic-land exclusion exception.
- Testing `is:commander` surfaced a real bug in the ingestion's `canBeCommander` flag: the regex required the literal substring `Legendary Creature`, which misses `Legendary Artifact Creature`, `Legendary Enchantment Creature`, etc. — 183 real commander-eligible cards (Silas Renn, Seeker Adept among them) were wrongly excluded. Fixed in `apps/backend/src/ingest/transform.ts` by checking `typeLine.includes('Legendary') && typeLine.includes('Creature')` instead of requiring adjacency (checked live data first for any double-faced card where the two words land on mismatched faces — none), then re-ran the ingestion to correct the already-populated DB.
- `card.byOracleIds` hydrates full `Card` rows for a list of oracle_ids, sorted by the same global-sort options as `search` (shared via `resolveOrderBy`). `deck.get` only returns oracle_ids inside `structure` plus the resolved commander cards — this is what turns a deck's block contents into renderable cards (mana cost, name, price) without a per-card round trip.

## Deck API

`apps/backend/src/deck/` (`structure.ts` — the `DeckStructure` zod schema persisted verbatim in `Deck.structure`; `commander-pairing.ts` — pure `validateCommanderPair` logic for Partner/Partner-with/Choose-a-Background; `router.ts` — the `deck.*` protected tRPC procedures: `create`, `list`, `get`, `update`, `remove`).

- All procedures are `protectedProcedure` (require login) and check `deck.userId === ctx.user.id`; a deck that exists but isn't yours returns the same `NOT_FOUND` as one that doesn't exist, so ids can't be probed.
- `create`/`update` (when `commanderOracleIds` changes) validate the commander pairing server-side, not just in the UI — fetches both cards and requires one of: both have plain `Partner`, one names the other via `Partner with <name>`, or one `choosesBackground` and the other `isBackground`. The second slot does NOT need `canBeCommander` itself (Background cards aren't commander-eligible on their own — they only work as the second slot).
- `get`/`create` resolve and embed the full commander `Card` objects in the response (`commanders: Card[]`) so the frontend has everything needed to render the compact commander view and compute the deck's color identity (union of both commanders') without another round trip.
- `update` accepts any subset of `name`/`commanderOracleIds`/`structure` — built for the debounced autosave described in the brief, not a full-replace PUT.
- Soft cap of 50 decks per user (`create` throws past that), per the brief's "generous cap if simpler" allowance.
- Verified end-to-end against the real DB: valid generic-Partner pair (Thrasios + Silas Renn), invalid pair rejected with a clear message (Thrasios + Atraxa, which has no partner ability), valid Background pair (Halsin + Dungeon Delver), list/get/update(autosave)/remove, cross-user ownership boundary (`NOT_FOUND`, not leaked), and unauthenticated access rejected.

### Auth implementation

`apps/backend/src/auth/` (`password.ts`, `session.ts`, `rate-limit.ts`, `router.ts` — the `auth.*` tRPC procedures: `register`, `login`, `logout`, `me`). Verified end-to-end against the real local Postgres with curl: register, duplicate-email conflict, wrong-password rejection, correct login, logout, and rate-limit cutoff after 10 attempts in 15 minutes.

- Sessions are httpOnly cookies (`session_id`) pointing at a `Session` row, not JWTs — `protectedProcedure` in `src/trpc.ts` reads `ctx.user` (populated in `src/context.ts` from the cookie) and throws `UNAUTHORIZED` if absent.
- `verifyPassword` always runs a bcrypt compare (against a fixed dummy hash when no user exists) so a login attempt against an unregistered email takes the same time as a real one — otherwise timing leaks which emails are registered.
- CORS is locked to `FRONTEND_URL` (not `origin: true`) with `credentials: true`, since reflecting any origin would let another site ride a logged-in user's cookies.
- The login rate limiter is in-memory, keyed by `ip:email`, 10 attempts / 15 min — fine for a single-instance MVP, resets on restart, not distributed. It counts successful logins toward the same limit (simplest correct behavior; nobody logs in 10x in 15 min normally).
- **Fastify plugin decorators need an explicit type import wherever they're used**: `@fastify/cookie` adds `req.cookies`/`res.setCookie` via module augmentation, which only applies within a TypeScript program that includes the plugin's import. `apps/frontend/src/lib/trpc.ts` imports `AppRouter`'s *type* through a deep relative path into the backend, which pulls in `context.ts`/`auth/router.ts` for a separate compilation that never imports `@fastify/cookie` itself — that build silently lost the augmentation and failed to typecheck. Fixed with a side-effect `import type {} from '@fastify/cookie'` in both files; same pattern applies to any future Fastify plugin decorator used outside `index.ts`.

## Claude Code permissions for this project

`.claude/settings.json` auto-allows: reading/creating/editing repo files, dev server, tests, linter, build, project scripts (including the bulk-data ingestion script), and `git add`/`commit`/`diff`/`status`/`log`.

Always asks first: installing/uninstalling packages, deleting files/folders, anything outside the project directory, `git push`, and anything touching `.env`/secrets.

Local personal-machine dev environment (not CI/containerized) — permissions are tuned accordingly.
