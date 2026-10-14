---
paths:
  - "apps/backend/src/ingest/**/*"
  - "apps/backend/scripts/ingest.ts"
  - "apps/backend/prisma/**/*"
---

# Scryfall ingestion

- Source: Scryfall Bulk Data — `oracle_cards` + `oracle_tags`, joined by `oracle_id`. Docs: `https://scryfall.com/docs/api/bulk-data`, `https://scryfall.com/docs/api/tags`. A daily cron is enough — bulk data only regenerates every 12-24h.
- Tags: key by `id` (stable UUID), never `slug`/`label` (mutable). Aggregating a parent category (e.g. "removal") means walking `child_ids` recursively — the bulk file only has direct taggings.
- Taggings' `weight` is a **string category** (`"median"`, `"strong"`, `"very_strong"`, ...), not a number — store verbatim.
- Images: use Scryfall's URIs directly, never rehost. Color identity: use the resolved `color_identity` field, don't recompute.
- Every Scryfall request needs `User-Agent` + `Accept: application/json`, or it 403s.
- Bulk-data entries expose `jsonl_download_uri` (gzip JSONL), not `download_uri`.
- Filter non-deckbuildable objects (art cards, tokens, emblems, planes, schemes, Vanguards, Un-set pairs...) via `legalities.commander !== 'not_legal'`, not a hardcoded `layout` list — layout names aren't a stable/fully-documented set.
- `mana_cost`/`oracle_text`/`colors`/`image_uris` are absent top-level for multi-faced layouts (transform, modal_dfc, flip) — fall back to `card_faces`. `cmc`/`color_identity`/`type_line`/`legalities`/`prices`/`released_at` are always top-level.
- `canBeCommander`: `typeLine.includes('Legendary') && typeLine.includes('Creature')` — not the literal substring `"Legendary Creature"`, which misses `Legendary Artifact Creature`/`Legendary Enchantment Creature` etc. — OR oracle text has "can be your commander" minus a "can't be your commander" negation check.
- Ingest order matters: Cards before Tags before Taggings (FK to Card). A tagging onto a missing oracle_id is skipped, not fatal. `safeUpsert` in `run.ts` retries non-FK errors, since concurrent batches can throw transient pool errors that look identical to real failures.
- `pg.Pool`'s default `max` is 10, below this script's `TAGGING_CONCURRENCY = 16` — `src/db.ts` sets `max: 20` explicitly. Without it, tags/taggings get silently dropped from pool contention, not from real data issues.

Local Postgres: `docker-compose.yml` at repo root runs Postgres 16 (`docker compose up -d`). Then `npm run prisma:migrate -w apps/backend` to apply the schema, `npm run ingest -w apps/backend` to populate it.
