---
paths:
  - "apps/backend/src/deck/**/*"
---

# Deck API

`structure.ts` — the `DeckStructure` zod schema persisted verbatim in `Deck.structure`. `commander-pairing.ts` — pure `validateCommanderPair` logic for Partner/Partner-with/Choose-a-Background. `router.ts` — the protected `deck.*` procedures: `create`, `list`, `get`, `update`, `remove`.

- Every procedure checks `deck.userId === ctx.user.id`; a deck that exists but isn't yours returns the same `NOT_FOUND` as one that doesn't exist, so ids can't be probed.
- `create`/`update` (when `commanderOracleIds` changes) validate the commander pairing server-side, not just in the UI — requires one of: both cards have plain `Partner`, one names the other via `Partner with <name>`, or one `choosesBackground` and the other `isBackground`. The second slot does NOT need `canBeCommander` itself (Background cards aren't commander-eligible on their own).
- `get`/`create` resolve and embed the full commander `Card` objects (`commanders: Card[]`) so the frontend can render the compact commander view and compute color identity (union of both) without another round trip.
- `update` accepts any subset of `name`/`commanderOracleIds`/`structure` — built for debounced autosave, not a full-replace PUT.
- Soft cap of 50 decks per user (`create` throws past that).
