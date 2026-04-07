# UI Specification

## Play Area Layout

Each player's area is arranged as follows (top to bottom):

```
┌─────────────────────────────────────────────────┐
│  [Deck]  [Discard]                              │
│                                                  │
│  [Starting Character]                            │
│                                                  │
│  [Hand: card1, card2, card3, ...]               │
│                                                  │
│  [Lessons area: grouped by type with counts]     │
│  [Creatures area: individual cards with dmg]     │
└─────────────────────────────────────────────────┘
```

- **Deck** — face-down pile, top-left of player area, shows card count.
- **Discard Pile** — next to the Deck; top card visible face-up with total count.
- **Starting Character** — always visible below the Deck/Discard row. Cannot be removed.
- **Hand** — row of face-up cards for the player; face-down (card backs) for the bot.
- **Lessons area** — grouped by type with counts (e.g., "F ×5, T ×3").
- **Creatures area** — individual creature cards with damage counters.

The opponent's area is mirrored (flipped vertically) at the top of the screen.

## UI Requirements

- **Two player areas**: top = opponent (mirrored), bottom = human player
- Each area shows: Deck, Discard, Hand, In-play (Lessons + Creatures), Starting Character
- **Game log** panel on the side showing play-by-play
- **Controls**: "Start Game", "Draw Card" (action), "End Turn" (skip remaining actions)
- **Actions remaining** counter (e.g., "Actions: 2/2")
- **Turn indicator** showing whose turn it is and current phase
- **Phase dots** showing progression through turn phases

## Card Visual Design

Each card displays:
- **Name** at the top
- **Type badge** (Lesson / Spell / Creature / Character)
- **Cost** (e.g., "5C") — badge with lesson type color
- **Effect text** — brief description
- **Stats** (Creatures only): damage per turn and health points

Lesson type color coding:
- **C** (Charms) = blue
- **T** (Transfiguration) = red
- **F** (Care of Magical Creatures) = brown/green
- **P** (Potions) = green
- **Q** (Quidditch) = yellow

## Card Interactions & Animations

### Player turn
- **Hovering a card in hand**: lift/glow effect. Playable cards have gold glow; unaffordable cards are dimmed/grayed.
- **Clicking a card**: selects it for play. Card lifts up. A second click or target click confirms.
- **Playing a Lesson**: card moves from hand to the Lessons area (grouped with same type).
- **Playing a Spell**: card moves from hand to center (brief display), then to Discard pile.
- **Playing a Creature**: card moves from hand to the Creatures area.
- **Drawing a card**: card animates from Deck to Hand.

### Bot turn (automated with delays)
- Bot's card being played briefly highlights before moving.
- All bot actions play out with ~500ms delays so the player can follow.

### Shared animations
- **Taking damage (deck→discard)**: cards fly from Deck to Discard pile with a count indicator.
- **Creature taking damage**: damage counter appears/increments on the creature card.
- **Creature destroyed**: creature card animates to Discard pile.
