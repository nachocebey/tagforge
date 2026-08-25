// The "Considering" block is a fixed, reserved block — not user-created —
// for cards a player wants to revisit later without them counting toward
// the deck. It's identified by this well-known id rather than a schema
// flag, so it needs no backend change: `DeckBlock.id` is already just a
// free-form string in the persisted structure.
export const CONSIDERING_BLOCK_ID = 'considering'
export const CONSIDERING_BLOCK_NAME = 'Considering'
