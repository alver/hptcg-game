# Player Interaction

The human player makes all decisions manually during their turn. The player can be any character — character abilities are gated on the starting character's `effectCode`, not hardcoded.

## Action Phase

- **Click a card in hand** to select it for playing. Playable cards are highlighted; unaffordable cards are dimmed (`.unaffordable`).
- **Click a Lesson card** → moves to Lessons area (1 action spent).
  - If the player's starting character has the `hermione_double_lesson` ability and 2+ Lessons are already in play, a prompt appears (`#hermione-prompt`) to optionally play a second Lesson for free. The player can pick a lesson or click Skip.
- **Click a Spell card** → resolves effect and moves to Discard pile (1 action spent).
  - If the spell requires a target choice, enter target mode first (see Targeting below).
  - If the spell requires card selection (e.g. Accio, Hagrid), the discard viewer overlay opens in selection mode.
  - The spell card is **not** removed from hand until the target/selection is confirmed. Cancelling keeps the card in hand and spends no action.
- **Click a Creature card** → moves to Creatures area (1 action spent).
- **"Draw (1)" button** → draw 1 card from deck (1 action spent).
- **"End Turn" button** → skip remaining actions and end the turn. Also auto-dismisses any pending Hermione prompt.

Actions remaining are shown as two large gold dots (`.big-action-dot`) on the center dividing line. Spent dots turn grey.

## Targeting

When a spell requires choosing a target (e.g., `damage_creature_or_opponent_X`, `discard_opponent_creature`):
- A red banner (`#target-banner`) appears with "Choose a target" and a Cancel button.
- Valid targets gain a pulsing red border (`.target-available`, `pulse-red` animation):
  - Opponent's creatures in the creatures zone.
  - Opponent's deck area (for direct damage to opponent).
- Player clicks a target to confirm, or Cancel to abort (card stays in hand).

## Card Selection (Discard Pile Retrieval)

When a spell requires picking cards from the discard pile (e.g. `return_from_discard_lesson_2`):
- The discard viewer overlay opens in selection mode.
- Only eligible cards are shown.
- Player clicks cards to toggle selection (up to `maxSelect`).
- A "Return Selected" button confirms, or Cancel aborts (card stays in hand).

## Opponent Creature Choice

When the opponent (bot) casts a spell like Take Root (`opponent_chooses_discard_creature`):
- The bot's turn pauses via `pendingOpponentCreatureChoice`.
- A take-root banner (`#take-root-banner`) appears.
- The player's own creatures gain target-available styling with crosshair cursor.
- The player clicks one of their own creatures to discard it, then the bot turn resumes.

## Non-Action Phases

**Draw phase** and **Creature damage phase** resolve automatically with animation — no player input needed. The player watches these complete before the Action phase begins.
