# Card Data Contracts

## `cards.json`

All cards used in both decks. Keyed by string identifier (e.g. `"accio"`, `"hermione_granger_starter"`). The key is the card's canonical id and is what deck files reference.

Each card carries only the fields its type actually uses. Common to all types: `name`, `image`, `type`.

### Character
```json
"hermione_granger_starter": {
  "name": "Hermione Granger",
  "image": "assets/cards/hermione_granger.png",
  "type": "character",
  "effectCode": "hermione_double_lesson"
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
"accio": {
  "name": "Accio",
  "image": "assets/cards/accio.png",
  "type": "spell",
  "powerCost": 4,
  "lessonCostType": "C",
  "effectCode": "damage_opponent_3"
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
  "health": 1
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
| `hermione_double_lesson` | Hermione's character ability — handled by `game.js` action flow, not as a spell effect |
| `draco_hand_disruption` | Draco's character ability — placeholder, not yet wired |
| `noop` | No automated effect / placeholder |

Creatures do not have an `effectCode` — combat is handled directly by the turn engine.
