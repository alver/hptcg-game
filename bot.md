# Bot Behavior & v1 Scope

## Bot Strategy (v1 — Power-Capped Priority Bot)

The bot follows this priority each action, with a power-aware threshold:

1. **Play a Lesson** from hand — but **only if total lessons < 6** (controlled by `MAX_LESSON_PRIORITY_POWER` in `bot.js`). Prioritize F (CoMC), then C (Charms), then other types.
2. **Play the most expensive affordable Spell** from hand. Skips creature-targeting spells (e.g. `discard_opponent_creature`, `opponent_chooses_discard_creature`) if the opponent has no creatures in play.
3. **Play the most expensive affordable Creature** from hand.
4. **Play a Lesson** from hand even at high power — this is better than drawing if a lesson is available.
5. **Draw a card** if nothing else can be played.

The power cap at step 1 means the bot switches from "ramp mode" to "action mode" once it reaches 6 lessons. Below that threshold it always plays a lesson first; above it, the bot prefers casting spells or deploying creatures.

The bot does **not**:
- Evaluate board state strategically
- Consider opponent's cards
- Hold cards for later
- Use Draco's character ability
- Play Adventures, Items, or Characters from hand

## Implementation

Bot turn execution is in `bot.js`:
- `executeBotTurn(gameState)` loops up to 2 actions with ~600 ms delays between them, calling the unified `GameEngine.botPlayLesson()` / `botPlaySpell()` / `botPlayCreature()` / `botDrawCard()` methods.
- `decideAction(bot, player, gameState)` returns a decision object `{ type, card? }`.
- All action methods use the shared helpers in `game.js` (`playLesson()`, `playCreature()`, `drawCard()`) to avoid duplicating game logic.

## Simplified Rules for v1

These simplifications apply to the first implementation:

1. **No Adventures** — skip Adventure card logic entirely.
2. **No Items** — skip Item card logic.
3. **No Locations / Matches** — not present in starter decks anyway.
4. **No additional Characters** — only starting Characters are in play.
5. **Character abilities are simplified**:
   - **Hermione**: When playing a Lesson with 2+ Lessons already in play, auto-offer to play a second Lesson from hand for free. Only triggers if the player's character has `effectCode: hermione_double_lesson`.
   - **Draco**: Not used by the bot (requires strategic decision-making). Placeholder `effectCode` exists but is not wired.
6. **Spell effects** simplified to their core damage/discard mechanic.
7. **Creature additional costs** (e.g., "discard 1 F Lesson") are implemented.
8. **No damage redirection** or prevention effects.
