# Harry Potter TCG — Game Rules Reference

## Win Condition
A player **loses** when they must draw a card but their deck is empty. "Damage" means discarding that many cards from the top of a player's **deck** into their **discard pile**.

## Setup
1. Each player places their **starting Character** card face-up in play (it can never be discarded).
2. Each player shuffles their 40-card deck and draws **7 cards** into their hand.
3. Randomly determine who goes first.

## Turn Structure
Each turn has these phases **in order**:

1. **Before-Turn Triggers** — Resolve any "before your turn" effects from cards in play (Adventures on opponent's side, etc.).
2. **Draw** — Draw 1 card from deck. (If deck is empty, that player loses.)
3. **Creature Damage** — Each of your Creatures in play deals its "damage each turn" value to the opponent (opponent discards that many cards from deck to discard).
4. **Actions (×2)** — You have **2 Actions** to spend. Each action can be used for ONE of:
   - **Play a Lesson** from hand (place it face-up in your "in play" area).
   - **Play a Spell** from hand (pay its Power cost, apply effect, discard the Spell).
   - **Play a Creature** from hand (pay its Power cost; it stays in play but doesn't attack until next turn).
   - **Play an Item** from hand (pay its Power cost; it stays in play).
   - **Play an Adventure** from hand (replaces your current Adventure if any; the old one is discarded without reward).
   - **Play a Character** from hand (costs **2 Actions**).
   - **Use a Character ability** (if applicable; some are "once per game").
   - **Draw a card** (spend 1 action to draw 1 additional card).
5. **End-of-Turn Triggers** — Resolve any "end of turn" effects.

## Power / Lesson System
- **Lessons** are resource cards. Each Lesson in play provides **1 Power** of its type.
- To play a card with a cost like `5C` (5 Charms), you need **at least 5 total Lessons** in play AND **at least 1 must be a Charms Lesson**.
- Lessons are **not tapped/exhausted** — they persist and can be used for multiple cards per turn.
- Lesson types: **C** = Charms, **T** = Transfiguration, **P** = Potions, **F** = Care of Magical Creatures (CoMC), **Q** = Quidditch.

## Card Types

| Type | Played To | Actions | Notes |
|------|-----------|---------|-------|
| **Lesson** | In play area | 1 | Provides 1 Power of its type. No cost. |
| **Spell** | Discard pile | 1 | Has Power cost. Effect resolves, then card goes to discard. |
| **Creature** | In play area | 1 | Has Power cost (always F type). Has Health and "Damage each turn". Stays in play. |
| **Item** | In play area | 1 | Has Power cost. May provide Power or have special abilities. Stays in play. |
| **Character** | In play area | **2** | Unique. Has special abilities. No Power cost but costs 2 actions. |
| **Adventure** | In play area (on opponent) | 1 | Has an Effect (ongoing penalty on opponent), a Solve condition, and Opponent's Reward. Only 1 Adventure in play per player. |
| **Location** | In play area | 1 | Has Power cost. Only 1 Location in play total (new one discards old). Global effect. |
| **Match** | In play area | 1 | Has Power cost (Q type). Special competitive card type. |

## Creature Combat
- Creatures do NOT fight each other directly (unlike Magic: The Gathering).
- Each creature deals its "damage each turn" to the **opponent** (their deck → discard) automatically at the start of your turn.
- Creatures can be targeted by Spells that say "do X damage to a Creature of your choice."
- When a Creature takes damage equal to or exceeding its Health, it is discarded.

## Adventures
- When you play an Adventure, it attaches to your **opponent**.
- The **Effect** is an ongoing penalty that applies to the opponent.
- The opponent can spend actions to work toward the **Solve** condition.
- When solved, the Adventure is discarded and the opponent gets the **Reward**.
- If you play a new Adventure, your old one is discarded (opponent does NOT get reward).

## Starting Characters

**Hermione Granger** (Witch / Gryffindor / Unique)
> If you already have 2 or more Lessons in play, whenever you use an Action to play a Lesson card, you may play 2 Lesson cards instead of one.

**Draco Malfoy** (Wizard / Slytherin / Unique)
> During your turn, you may use an Action and discard a card from your hand to look at your opponent's hand. You may then choose one card in his or her hand and discard it.
