---
paths:
  - "apps/backend/src/search/**/*"
---

# Card search API

`query-parser.ts` tokenizes a Scryfall-like query string, `build-where.ts` turns it into a Prisma `Card` where-clause, `router.ts` exposes `card.search` (public) and `card.byOracleIds`. Powers both the commander picker (`query: "is:commander ..."`, no `commanderColorIdentity`) and the per-block search (`commanderColorIdentity` set, `excludeOracleIds` = current deck contents).

- Supported syntax is a **practical subset**, not the full Scryfall grammar: bare text / `"quoted phrases"` (name-only), negation via a leading `-`, `t:`/`type:`, `o:`/`oracle:`, `c:`/`color:`, `id:`/`identity:`, `cmc:`/`mv:` (`=`,`!=`,`>`,`>=`,`<`,`<=`), `tag:`, `is:commander|background|partner`. No parentheses/OR grouping.
- Bare/quoted text matches **name only**, not oracle text — matching both buried the card "Plains" under ~50 unrelated cards whose rules text just mentions "plains". Use `o:`/`oracle:` explicitly for rules-text search. Multiple bare words join into one phrase (`sol ring` looks for that substring, not an AND of separate words).
- `commanderColorIdentity` is `undefined` (no constraint — commander picker) vs `[]` (constraint to colorless — a real colorless commander is chosen). Never default the "no constraint" case to `[]`, it wrongly restricts the commander picker to colorless-only results.
- The singleton-rule exclusion (`excludeOracleIds`) always lets the 6 basic lands through regardless, matched by name via `BASIC_LAND_NAMES` in `basic-lands.ts` — not by oracle_id, so it doesn't depend on which oracle_id got queried at write-time.
- `tag:<slug>` resolves the tag and walks `child_ids` recursively before filtering via `taggings.some` (tags only store direct taggings; matching a parent category means unioning every descendant's taggings).
- `card.byOracleIds` sorts via the same `resolveOrderBy` as `search` — keep both in sync when adding a new sort option.
