# Card Data Contracts

## `cards.json`

All cards used in both decks. Keyed by string identifier (e.g. `"accio"`, `"hermione_granger_starter"`). The key is the card's canonical id and is what deck files reference.

Each card carries only the fields its type actually uses. Common to all types: `name`, `image`, `type`. Exception is `text` field which is copy of text from the card, however it not used anywhere.

### Character
```json
"hermione_granger_starter": {
  "name": "Hermione Granger",
  "image": "assets/cards/hermione_granger.png",
  "type": "character",
  "effectCode": "hermione_double_lesson",
  "text": "If you already have 2 or more Lessons in play, then whenever you use an Action to play a Lesson card, you may play 2 Lesson cards instead of 1."
}
```

### Lesson
```json
"lesson_comc": {
  "name": "Care of Magical Creatures",
  "image": "assets/cards/care_of_magical_creatures.png",
  "type": "lesson",
  "lessonType": "F"
}
```
`lessonType` is one of `C` (Charms), `T` (Transfiguration), `F` (CoMC), `P` (Potions), `Q` (Quidditch). Lessons are always free to play and provide 1 power of their type.

### Spell
```json
"magical_mishap":
{
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
- `effectCode` — handler key dispatched in `cards.js` `resolveEffect`

### Creature
```json
"boa_constrictor": {
  "name": "Boa Constrictor",
  "image": "assets/cards/boa_constrictor.png",
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

## `deck_hermione.json` / `deck_malfoy.json`

```json
{
  "name": "Hermione Granger Starter Deck",
  "description": "...",
  "startingCharacter": "hermione_granger_starter",
  "cards": [
    { "id": "lesson_comc",            "count": 12 },
    { "id": "lesson_transfiguration", "count": 7 }
  ]
}
```

- `startingCharacter` — string key of the character card in `cards.json`. Resolved by the engine in `setupGame`.
- `cards[].id` — string key of the card in `cards.json`.
- `cards[].count` — how many copies in the deck.

## Card Effect Implementation Guide

Each spell or character `effectCode` maps to a handler in `cards.js` `resolveEffect`.

| effectCode | Behavior |
|------------|----------|
| `damage_opponent_X` | Opponent discards X cards from deck |
| `damage_creature_or_opponent_X` | Deal X damage to a creature or opponent (caster picks; bot always targets opponent) |
| `damage_all_creatures_X` | Deal X to every creature in play |
| `draw_X` | Caster draws X cards |
| `opponent_discard_hand_X` | Opponent discards X cards from hand |
| `discard_opponent_lesson_T` | Discard one of opponent's lessons of the given type (suffix is the lesson type letter: `C`, `T`, `F`, `P`, `Q`) |
| `return_from_discard_TYPE_N` | Return up to N cards of TYPE (`lesson`, `creature`, `spell`, `any`) from caster's discard pile to hand. Player picks interactively via the discard viewer; bot auto-picks the most recent matching cards. Used by Accio (`return_from_discard_lesson_2`), Hagrid and the Stranger (`return_from_discard_creature_1`). |
| `discard_opponent_creature` | Caster (player) picks one of opponent's creatures to discard immediately — no damage counters; bot auto-picks highest-damage player creature. Used by Incarcifors. |
| `opponent_chooses_discard_creature` | The opponent (not the caster) discards one of their own creatures. Player casting → bot auto-picks its weakest creature; bot casting → player is prompted via `#take-root-banner` to click one of their own creatures (bot turn pauses via `pendingOpponentCreatureChoice` state until resolved). Used by Take Root. |
| `hermione_double_lesson` | Hermione's character ability — handled by `game.js` action flow, not as a spell effect |
| `draco_hand_disruption` | Draco's character ability — placeholder, not yet wired |
| `noop` | No automated effect / placeholder |

Creatures do not have an `effectCode` — combat is handled directly by the turn engine.
