# Card Data Contracts

## `cards.json`

All cards used in all decks. Keyed by string identifier (e.g. `"accio"`, `"hermione_granger_starter"`). The key is the card's canonical id and is what deck files reference.

Each card carries only the fields its type actually uses. Common to all types: `name`, `image`, `type`. Exception is `text` field which is a copy of text from the card, however it is not used anywhere in the code.

### Character
```json
"hermione_granger_starter": {
  "name": "Hermione Granger",
  "image": "assets/cards/hermione_granger.webp",
  "type": "character",
  "effectCode": "hermione_double_lesson",
  "text": "If you already have 2 or more Lessons in play, then whenever you use an Action to play a Lesson card, you may play 2 Lesson cards instead of 1."
}
```

### Lesson
```json
"lesson_comc": {
  "name": "Care of Magical Creatures",
  "image": "assets/cards/care_of_magical_creatures.webp",
  "type": "lesson",
  "lessonType": "F"
}
```
`lessonType` is one of `C` (Charms), `T` (Transfiguration), `F` (CoMC), `P` (Potions), `Q` (Quidditch). Lessons are always free to play and provide 1 power of their type.

### Spell
```json
"magical_mishap": {
  "name": "Magical Mishap",
  "image": "assets/cards/magical_mishap.webp",
  "type": "spell",
  "powerCost": 2,
  "lessonCostType": "C",
  "effectCode": "damage_opponent_3",
  "text": "Do 3 damage to your opponent."
}
```
- `powerCost` — total power required to play
- `lessonCostType` — at least one lesson of this type must be in play
- `effectCode` — handler key dispatched by the effect handler registry in `cards.js`

### Creature
```json
"boa_constrictor": {
  "name": "Boa Constrictor",
  "image": "assets/cards/boa_constrictor.webp",
  "type": "creature",
  "powerCost": 4,
  "lessonCostType": "F",
  "damage": 2,
  "health": 2,
  "text": "Damage each turn: 2. Health: 2."
}
```
- `damage` — damage dealt to opponent each of your turns
- `health` — destroyed when accumulated damage counters ≥ this
- `discardLessonTypeOnPlay` (optional) — lesson type letter to discard from play on summon (e.g. `"F"` for Forest Troll)

## `decks.json` — Deck Manifest

```json
{
  "decks": [
    "data/deck_hermione.json",
    "data/deck_malfoy.json"
  ]
}
```

An array of relative paths to individual deck JSON files. The deck selection screen (`deck_select.js`) fetches this manifest at startup, then loads each deck file to display in the selection UI.

## `deck_hermione.json` / `deck_malfoy.json`

```json
{
  "name": "Hermione Granger Starter Deck",
  "description": "Base Set Starter Deck — Transfiguration & Care of Magical Creatures...",
  "startingCharacter": "hermione_granger_starter",
  "cards": [
    { "id": "lesson_comc",            "count": 12 },
    { "id": "lesson_transfiguration", "count": 7 }
  ]
}
```

- `name` — display name shown in deck selection and on the game board.
- `description` — flavor text shown in the deck preview panel.
- `startingCharacter` — string key of the character card in `cards.json`. Resolved by the engine in `setupGame`. The character's `effectCode` determines which abilities (if any) are available.
- `cards[].id` — string key of the card in `cards.json`.
- `cards[].count` — how many copies in the deck.

## Card Effect Implementation Guide

### Effect Handler Registry

Effect handlers are registered in `cards.js` using `registerEffect(pattern, handler)`. The dispatcher in `resolveEffect()` matches an `effectCode` string against handlers in this order:

1. **Special patterns** — `return_from_discard_TYPE_N`, `discard_opponent_lesson_X` (manually matched regex patterns with non-numeric trailing segments).
2. **Numeric-suffix patterns** — `handler_name_N` where `N` is a number (e.g. `damage_opponent_3` → handler `damage_opponent` with amount `3`).
3. **Exact-match** — handler name matches the full `effectCode` literally (e.g. `discard_opponent_creature`).

Each handler receives a context object `{ card, caster, opponent, state, target }` and an optional numeric amount. It returns `{ logs[], needsTarget?, validTargets?, needsCardSelection?, ... }`.

### Adding a New Effect

To add a new spell effect:

```js
// In cards.js, at module level:
registerEffect('heal_caster', (ctx, amount) => {
  // your logic here
  return { logs: [`${ctx.caster.name} heals ${amount}.`] };
});
```

Then assign `"effectCode": "heal_caster_5"` in `cards.json`. The dispatcher automatically extracts the `5` and passes it as `amount`.

### Effect Reference

| effectCode | Handler | Behavior |
|------------|---------|----------|
| `damage_opponent_X` | `damage_opponent` | Opponent discards X cards from deck |
| `damage_creature_or_opponent_X` | `damage_creature_or_opponent` | Deal X damage to a creature or opponent (caster picks; bot always targets opponent) |
| `damage_all_creatures_X` | `damage_all_creatures` | Deal X to every creature in play (both sides) |
| `draw_X` | `draw` | Caster draws X cards |
| `opponent_discard_hand_X` | `opponent_discard_hand` | Opponent discards X random cards from hand |
| `discard_opponent_lesson_T` | `discard_opponent_lesson` | Discard one of opponent's lessons of type T (suffix is the lesson type letter: `C`, `T`, `F`, `P`, `Q`) |
| `return_from_discard_TYPE_N` | `return_from_discard` | Return up to N cards of TYPE (`lesson`, `creature`, `spell`, `any`) from caster's discard pile to hand. Player picks interactively via the discard viewer; bot auto-picks the most recent matching cards. |
| `discard_opponent_creature` | `discard_opponent_creature` | Caster picks one of opponent's creatures to discard immediately — no damage counters; bot auto-picks highest-damage creature. |
| `opponent_chooses_discard_creature` | `opponent_chooses_discard_creature` | The opponent (not caster) discards one of their own creatures. Player casting → bot auto-picks weakest; bot casting → player is prompted via `#take-root-banner`. |
| `hermione_double_lesson` | (skipped) | Hermione's character ability — handled by `game.js` action flow, not the registry |
| `draco_hand_disruption` | (skipped) | Draco's character ability — placeholder, not yet wired |
| `noop` / `creature_standard` | (skipped) | No automated effect |

Creatures do not have an `effectCode` — combat is handled directly by the turn engine in `phaseCreatureDamage()`.
