# Player Interaction

The human player (Hermione) makes all decisions manually during their turn.

## Action Phase

- **Click a card in hand** to select it for playing. Playable cards are highlighted; unaffordable cards are dimmed.
- **Click a Lesson card** → moves to Lessons area (1 action spent).
  - If Hermione's ability triggers (2+ Lessons already in play), a prompt appears to optionally play a second Lesson for free.
- **Click a Spell card** → resolves effect and moves to Discard pile (1 action spent).
  - If the spell requires a target choice, show target selection UI first.
- **Click a Creature card** → moves to Creatures area (1 action spent).
- **"Draw Card" button** → draw 1 card from deck (1 action spent).
- **"End Turn" button** → skip remaining actions and end the turn.

Actions remaining counter is always visible.

## Targeting

When a spell requires choosing a target (e.g., `damage_creature_or_opponent_X`):
- Highlight valid targets: opponent's creatures + opponent deck area.
- Player clicks to select.
- If no opponent creatures are in play, auto-target the opponent.

## Non-Action Phases

**Draw phase** and **Creature damage phase** resolve automatically with animation — no player input needed. The player watches these complete before the Action phase begins.
