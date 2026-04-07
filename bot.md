# Bot Behavior & v1 Scope

## Bot Strategy (v1 — "Dumb Bot")

The bot (Draco) follows this priority each action:

1. **Play a Lesson** from hand if available (prioritize F, then C).
2. **Play the first affordable Spell** found in hand (highest cost first for more impact).
3. **Play the first affordable Creature** found in hand.
4. **Draw a card** if nothing else can be played.

The bot does **not**:
- Evaluate board state strategically
- Consider opponent's cards
- Hold cards for later
- Use Draco's character ability
- Play Adventures, Items, or Characters from hand

## Simplified Rules for v1

These simplifications apply to the first implementation:

1. **No Adventures** — skip Adventure card logic entirely.
2. **No Items** — skip Item card logic.
3. **No Locations / Matches** — not present in starter decks anyway.
4. **No additional Characters** — only starting Characters are in play.
5. **Character abilities are simplified**:
   - **Hermione**: When playing a Lesson with 2+ Lessons already in play, auto-offer to play a second Lesson from hand for free.
   - **Draco**: Not used by the bot (requires strategic decision-making).
6. **Spell effects** simplified to their core damage/discard mechanic.
7. **Creature additional costs** (e.g., "discard 1 F Lesson") are implemented.
8. **No damage redirection** or prevention effects.
