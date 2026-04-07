# UI Specification

## Screen Layout

The screen is split into two vertical regions:

```
┌─────────────────────────────────────────────────────────────┬──────────────┐
│                    ┌──────────────────┐                     │              │
│  DRACO MALFOY      │  Bot hand (fan)  │                     │              │
│  STARTER DECK      └──────────────────┘                     │              │
│                                                             │              │
│  ┌──────────┐   ┌─ LESSONS ──────────────────┐  ┌────────┐ │  DUEL LOG    │
│  │  Draco   │   │ [Charms×3]                 │  │  Deck  │ │  Turn N      │
│  │  (char)  │   ├─ CREATURES ────────────────┤  │ (25)   │ │              │
│  │          │   │                            │  ├────────┤ │  [log entry] │
│  └──────────┘   └────────────────────────────┘  │Discard │ │  [log entry] │
│                                                  └────────┘ │  [log entry] │
│  ────────●●────────── dividing line ────────────────────── │     ...      │
│                                                             │              │
│  ┌──────────┐   ┌─ LESSONS ──────────────────┐  ┌────────┐ │              │
│  │ Hermione │   │ [CoMC×1] [Transfig×1]      │  │  Deck  │ │              │
│  │  (char)  │   ├─ CREATURES ────────────────┤  │ (23)   │ │              │
│  │          │   │ [Forest Troll] [Raven]     │  ├────────┤ │              │
│  └──────────┘   └────────────────────────────┘  │Discard │ │              │
│  HERMIONE GRANGER                                └────────┘ │              │
│  STARTER DECK      ┌──────────────────┐                     │              │
│                    │ Player hand (fan)│   [DRAW] [END TURN] │              │
│                    └──────────────────┘                     │              │
└─────────────────────────────────────────────────────────────┴──────────────┘
         main board (.board-main)                               sidebar-left
```

- **Main board** (`.board-main`) fills the viewport minus the right sidebar.
- **Right sidebar** (`.sidebar-left`, 280 px) holds the duel log and the two player panels stacked top/bottom.

## Main Board Structure

Top to bottom, the board is five rows:

1. **Bot hand row** (`.bot-hand-row`, ~10 vh) — fan of face-down card backs centered at top.
2. **Bot board half** (`.board-half`, ~34 vh) — bot's character card (left), lessons/creatures zones (center), deck + discard pile (right).
3. **Center strip** (`.center-strip`) — a single 1 px gold line separating the two halves. The two big golden **action dots** (`.big-action-dot`) sit on this line, showing the current player's remaining actions for the turn.
4. **Player board half** — mirror of the bot half: character card (left), lessons/creatures (center), deck + discard (right).
5. **Player hand row** (`.player-hand-row`, ~20 vh) — fan of face-up cards centered at bottom. The **DRAW** and **END TURN** buttons float at the bottom-right (`.play-area-controls`).

### Board half contents

Each `.board-half` contains, left to right:

- **Character card** (`.char-card.player-char` / `.char-card.bot-char`) — large portrait, 220×280 (or 280×200 if the artwork is landscape). Always visible, cannot be removed.
- **Deck label** (`.play-area-deck-name`) — stacked under the character card reading e.g. "HERMIONE GRANGER / STARTER DECK" in Cinzel uppercase. Gold for the player, blue for the bot.
- **Board zones** (`.board-zones-center`) — two stacked `.board-zone` rows:
  - **LESSONS** — lesson cards grouped by type, each group shown as one card image with an `×N` count badge.
  - **CREATURES** — individual creature thumbnails, each with damage / HP / damage-counter badges.
- **Edge pile** (`.edge-pile`) — deck card on top, discard card below. The deck card shows a large centered count pill (`.deck-card .pile-badge`) whose color encodes remaining deck life:
  - Green (`#4caf50`) — healthy
  - Yellow (`.deck-warning`) — low
  - Red (`.deck-danger`) — critical
- The **bot's** hand cards and deck card are rotated 180° so the card backs face the opponent.

### Active-turn highlighting

Both halves and both hand rows carry a subtle background tint while their owner is acting:
- Player turn → `.active-turn-player` → warm gold wash.
- Bot turn → `.active-turn-bot` → cool blue wash.

## Right Sidebar (`.sidebar-left`)

Stacked top to bottom:

1. **Bot panel** (`.player-panel`) — small avatar, deck name, deck-life meter and number, power pips.
2. **Duel log** (`.log-section`) — flex-grows to fill available space. Header shows "DUEL LOG" + current turn counter. Log entries are color-coded:
   - `.phase` — gold (turn / phase announcements)
   - `.system` — bright yellow (important events)
   - `.damage` — red (damage dealt, cards milled)
   - `.draw` — light blue (draws)
   - `.action` — white (normal actions)
3. **Player panel** (`.player-panel.bottom-panel`) — larger gold-bordered avatar, same fields as bot panel.

## Controls

- **START THE DUEL** — full-screen overlay (`.overlay`) shown before the game starts.
- **DRAW (n)** — `.ctrl-btn.draw-btn`, gold-tinted. Enabled only during the player's action phase when a draw is available.
- **END TURN** — `.ctrl-btn`. Ends the player's turn, skipping any remaining actions.
- **Hermione bonus lesson prompt** — floating banner (`#hermione-prompt`) that appears when Hermione's once-per-turn ability can be used.
- **Target banner** (`#target-banner`) — red banner in the screen center while the player is selecting a target for a spell or creature attack.

## Card Visual Design

Cards are rendered as full artwork images (`.hand-card-img`, `.thumb-img`, `.lesson-stack-img`, `.char-card-img`) with no overlaid text — the PNG itself carries name, cost, effect, and art. State is conveyed with colored **badges** layered over the image:

- `.cost-badge` — top-left, gold.
- `.dmg-badge` — bottom-left, red. Creature's damage-per-turn.
- `.hp-badge` — bottom-right, blue. Creature's starting HP.
- `.dmg-counter-badge` — top-right, red. Accumulated damage on a creature.
- `.lesson-count` — `×N` pill on lesson stacks.
- `.pile-badge` — small circular count on deck/discard piles (`.discard-badge` for discards).

Landscape-oriented artwork uses the **horizontal image trick** in `cards.css`: the image is given portrait dimensions and rotated 90° inside a landscape container so `object-fit: cover` fills the slot without letterboxing.

Lesson type color coding (border / theme):
- **C** (Charms) — blue
- **T** (Transfiguration) — orange/red
- **F** (Care of Magical Creatures) — brown/green
- **P** (Potions) — purple
- **Q** (Quidditch) — gold

## Card Interactions & Animations

### Player turn
- **Hovering a card in hand** — card lifts 14 px and scales 1.05 with a gold glow.
- **Unaffordable cards** — `.unaffordable`, dimmed to 45 % opacity and grayscaled.
- **Highlighted cards** — `.highlighted`, stronger gold glow (used for bonus-lesson prompts).
- **Clicking a card** — selects it for play; a second click or a target click confirms.
- **Hover preview** — `#card-hover-preview`, a large floating card (372×520 portrait, 520×372 landscape) pinned to the left edge of the screen while hovering any small card (hand, thumb, lesson stack, discard grid).
- **Playing a lesson** — card moves from hand into its lesson stack; stack count increments.
- **Playing a spell** — card flies to the center as a `.spell-spotlight` with the `spell-appear` keyframe (scale/blur/fade), then to the discard pile.
- **Playing a creature** — card moves from hand into the creatures zone.
- **Drawing a card** — card animates from the deck to the hand.

### Bot turn
- Bot actions play out with ~500 ms delays so the viewer can follow.
- Bot's hand cards and deck card are already rotated 180°; played cards return to the correct orientation as they move into play.

### Shared animations
- **Deck mill (damage)** — cards fly from deck to discard; the duel log gets a red `.damage` entry.
- **Creature taking damage** — the damage counter badge appears or increments on the creature.
- **Creature destroyed** — creature card animates to the discard pile.
- **Target-available pulse** — valid targets get a red `pulse-red` animation on their border.

## Modals

- **Game-over overlay** (`.overlay` + `.overlay-box`) — dark blur with a single "PLAY AGAIN" button and `.gameover-stats` summary.
- **Discard viewer** (`.discard-viewer-overlay` + `.discard-viewer-modal`) — opens when either discard pile is clicked; grid of all cards in that pile, 84 px wide, scrollable. Empty piles show "No cards in discard pile." Clicking a card in the grid opens the full-size hover preview.
