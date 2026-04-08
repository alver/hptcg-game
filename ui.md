# UI Specification

## Application Flow

```
deck_select.html  ──(START DUEL)──>  index.html
       ↑                                  │
       └──────(CHANGE DECKS / no choice)──┘
```

1. `deck_select.html` is the application entry point. The player selects one deck for themselves and one for the bot, then clicks START DUEL.
2. The choice is serialized to `localStorage[STORAGE_KEY]` (see `version.js`).
3. `index.html` checks `localStorage` on load. If no choice exists, it redirects back to deck selection.
4. Game-over screen offers "PLAY AGAIN" (reload with same decks) or "CHANGE DECKS" (clear `localStorage`, redirect to selector).

---

## Deck Selection Screen

`deck_select.html` + `deck_select.css` + `deck_select.js`

### Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         HARRY POTTER TCG                                  │
├──────────────────────┬────────────────────────────┬───────────────────────┤
│  SELECT DECKS        │  DECK NAME (uppercase)     │  CARD PREVIEW         │
│                      │  Deck description italic   │  (spotlight hover)    │
│ ┌──────────────────┐ │                            │                       │
│ │ Hermione Granger │ │  ┌─────┐ ┌─────┐ ┌─────┐ │  ┌─────────────────┐  │
│ │ Starter Deck     │ │  │card │ │card │ │card │ │  │                 │  │
│ │ (40 cards)       │ │  │ ×12 │ │  ×7 │ │  ×4 │ │  │   Full-size     │  │
│ │ [👤 Me] [🤖 Bot] │ │  └─────┘ └─────┘ └─────┘ │  │   card image    │  │
│ ├──────────────────┤ │  ┌─────┐ ┌─────┐ ┌─────┐ │  │                 │  │
│ │ Draco Malfoy     │ │  │card │ │card │ │card │ │  └─────────────────┘  │
│ │ Starter Deck     │ │  │  ×3 │ │  ×2 │ │  ×2 │ │                       │
│ │ (40 cards)       │ │  └─────┘ └─────┘ └─────┘ │                       │
│ │ [👤 Me] [🤖 Bot] │ │        ...more cards...   │                       │
│ └──────────────────┘ │                            │                       │
├──────────────────────┴────────────────────────────┴───────────────────────┤
│  👤 Your Deck: Hermione Granger ✓    🤖 Bot: Draco Malfoy ✓   [START DUEL]│
└───────────────────────────────────────────────────────────────────────────┘
```

### Structure

- **`.ds-page`** — flex column filling the viewport.
  - **`.ds-header`** — centered title "HARRY POTTER TCG" in Cinzel, gold, 32 px, letter-spacing 0.25em.
  - **`.ds-divider`** — 1 px gold line.
  - **`.ds-layout`** — CSS grid: `320px 1fr`.

### Left Column (`.ds-left-col`, 320 px)

- **`.ds-section-label`** — "SELECT DECKS" header, Cinzel, 12 px, gold uppercase.
- **`.ds-deck-list`** — flex column with 14 px gap.
- Each **`.ds-deck-row`** contains:
  - **`.ds-deck-row-name`** — deck name + card count badge (`.ds-deck-row-count`), Cinzel 14 px.
  - **`.ds-chip-row`** — two toggle chips:
    - **`.ds-chip.me`** — "👤 Me", gold border/text. `.active` → filled gold background.
    - **`.ds-chip.bot`** — "🤖 Bot", gold border/text. `.active` → filled blue (`--bot-blue`) background.
  - Clicking a chip toggles that slot (player or bot). Clicking the same chip again deselects.
  - Clicking the row body (outside chips) sets that deck as the preview target.
  - **`.previewing`** class on the currently previewed row — gold border + box shadow.

### Right Column (`.ds-preview`)

CSS grid: `60% 40%`.

- **Left 60% (`.ds-preview-main`)** — scrollable panel:
  - **`.ds-preview-name`** — deck name, Cinzel, 22 px, gold uppercase centered.
  - **`.ds-preview-desc`** — deck description, italic, dim text.
  - **`.ds-cards-grid`** — flex-wrap grid of card thumbnails:
    - **`.ds-card`** — landscape container, 175×125 px. Uses the horizontal image trick (90° rotation via CSS transform) to display landscape artwork.
    - **`.ds-card.portrait`** — portrait container, 125×175 px. Standard image fill.
    - **`.ds-card-count`** — `×N` badge, bottom-right, gold border, dark background, Source Code Pro 22 px.
    - Character card appears first (×1), followed by all deck cards.
    - Hovering any card shows it in the spotlight panel.

- **Right 40% (`.ds-card-spotlight`)** — singleton panel (built once, reused across preview changes):
  - **`.ds-section-label`** — "CARD PREVIEW" header.
  - **`.ds-spotlight-card-wrap`** — flex container, centers the card.
  - **`.ds-card-spotlight-inner`** — rounded-corner container with gold border and shadow:
    - `.horizontal` class: width 100%, aspect-ratio 7/5, rotated image.
    - `.portrait` class: height 100%, aspect-ratio 5/7, standard image.
    - `.hidden` class: fades out when not hovering.

### Bottom Bar (`.ds-bottom-bar`)

Fixed at viewport bottom, dark background, gold top border.

- **`.ds-status`** — two lines:
  - **`.ds-status-line`** — label ("👤 Your Deck" / "🤖 Bot Deck") + value (deck name or "Not selected").
  - Selected decks show gold/blue text + green checkmark (`.ds-check`).
  - Unselected slots show dim italic "Not selected" (`.empty`).
- **`.ds-start-btn`** — "START DUEL", red gradient background, gold border, Cinzel, letter-spacing 0.25em.
  - `:disabled` → 35% opacity, grayscale, `cursor: not-allowed`.
  - Enabled only when both player and bot decks are selected.
  - Click: writes `{ version, player, bot }` to `localStorage[STORAGE_KEY]` and navigates to `index.html`.

### Persistence

Previous deck selections are restored from `localStorage` on page load, so returning from the game-over screen preserves the previous choice.

---

## Game Board Screen Layout

`index.html` + `board.css` + `sidebar.css` + `cards.css` + `overlays.css` + `modals.css` + `ui.js`

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
- **Right sidebar** (`.sidebar-left`, 280 px) holds the duel log.

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
  - **LESSONS** — lesson icons grouped by type, each shown as a lesson icon image with a numeric count.
  - **CREATURES** — individual creature thumbnails, each with damage / HP / damage-counter badges.
- **Edge pile** (`.edge-pile`) — deck card on top, discard card below. The deck card shows a large centered count pill (`.deck-card .pile-badge`) whose color encodes remaining deck life based on the player's `initialDeckSize`:
  - Green (`#4caf50`) — healthy (≥ 60% remaining)
  - Yellow (`.deck-warning`) — low (20–60% remaining)
  - Red (`.deck-danger`) — critical (< 20% remaining)
- The **bot's** hand cards and deck card are rotated 180° so the card backs face the opponent.
- **Discard pile** rendering uses `AbortController` signals to clean up event listeners between re-renders, avoiding the previous clone/replace pattern.

### Active-turn highlighting

Both halves and both hand rows carry a subtle background tint while their owner is acting:
- Player turn → `.active-turn-player` → warm gold wash.
- Bot turn → `.active-turn-bot` → cool blue wash.

## Right Sidebar (`.sidebar-left`)

Contains the **Duel log** (`.log-section`) — flex-grows to fill available space. Header shows "DUEL LOG" + current turn counter. Log entries are color-coded:
  - `.phase` — gold (turn / phase announcements)
  - `.system` — bright yellow (important events)
  - `.damage` — red (damage dealt, cards milled)
  - `.draw` — light blue (draws)
  - `.action` — white (normal actions)

## Controls

- **DRAW (1)** — `.ctrl-btn`, gold-tinted. Enabled only during the player's action phase when actions remain.
- **END TURN** — `.ctrl-btn.draw-btn`. Ends the player's turn, skipping any remaining actions.
- **Hermione bonus lesson prompt** — floating banner (`#hermione-prompt`) that appears when the player's character has `hermione_double_lesson` ability and 2+ lessons are already in play. Shows lesson buttons + "Skip".
- **Target banner** (`#target-banner`) — red banner in the screen center while the player is selecting a target for a spell. Shows "Choose a target" + Cancel button.
- **Take Root banner** (`#take-root-banner`) — banner when the opponent forces the player to choose one of their own creatures to discard.

## Card Visual Design

Cards are rendered as full artwork images (`.hand-card-img`, `.thumb-img`, `.char-card-img`) with no overlaid text — the image itself carries name, cost, effect, and art. State is conveyed with colored **badges** layered over the image:

- `.cost-badge` — top-left, gold.
- `.dmg-badge` — bottom-left, red. Creature's damage-per-turn.
- `.hp-badge` — bottom-right, blue. Creature's current HP (health − damage counters).
- `.dmg-counter-badge` — top-right, red. Accumulated damage on a creature.
- `.lesson-count` — `×N` pill on lesson stacks.
- `.pile-badge` — small circular count on deck/discard piles (`.discard-badge` for discards).

### Horizontal image trick

Landscape-oriented artwork (lessons, creatures, characters) is determined by `CardManager.isHorizontal(card)` — a shared helper checking `card.type`. In CSS (`cards.css`), the image is given portrait dimensions and rotated 90° inside a landscape container so `object-fit: cover` fills the slot without letterboxing.

### Lesson type color coding (border / theme)

- **C** (Charms) — blue
- **T** (Transfiguration) — orange/red
- **F** (Care of Magical Creatures) — brown/green
- **P** (Potions) — purple
- **Q** (Quidditch) — gold

## Card Interactions & Animations

### Flying-card factory

All card-flight animations use the shared `createFlyingCard()` + `flyTo()` helpers in `ui.js`:

- `createFlyingCard({ card, faceDown, isHoriz, w, h, from })` — creates a positioned `.flying-card` element at `from` rect, appends to `document.body`, forces reflow, returns the element. Supports face-up (card image) or face-down (`.flying-card-back-inner` card-back).
- `flyTo(el, destRect, sourceRect, w, h, duration)` — applies CSS transform + opacity transition to fly the element to the destination, then removes it after the duration.

### Player turn
- **Hovering a card in hand** — card lifts 14 px and scales 1.05 with a gold glow.
- **Unaffordable cards** — `.unaffordable`, dimmed to 45% opacity and grayscaled.
- **Highlighted cards** — `.highlighted`, stronger gold glow (used for bonus-lesson prompts).
- **Clicking a card** — selects it for play; a second click or a target click confirms.
- **Hover preview** — `#card-hover-preview`, a large floating card (372×520 portrait, 520×372 landscape) pinned to the left edge of the screen while hovering any small card (hand, thumb, lesson stack, discard grid).
- **Playing a lesson or creature** — a flying card is created at the hand card's exact screen position, then CSS-transitioned to the center of the target zone (`.player-lessons-zone` / `.player-creatures-zone`) over ~450 ms while scaling to 0.8 and fading out.
- **Playing a spell** — card appears as a `.spell-spotlight` with the `spell-appear` keyframe (scale/blur/fade), then auto-removes after 2.6s.
- **Drawing a card** — a flying card is created centered on the deck pile and transitions to the center of the hand fan over ~450 ms. For the player, the flying card shows the actual card face; for the bot, it shows a card-back.

### Bot turn
- Bot actions play out with ~600 ms delays so the viewer can follow.
- When the bot plays a lesson or creature, a face-down flying card animates from a hand card to the target zone before the state updates. When the bot draws, a face-down flying card travels from the bot deck up to the bot hand fan.

### Shared animations
- **Deck mill (damage)** — for each card milled, a face-down flying card (84×118, matching the pile-card size) flies from the deck pile to the discard pile with a 70 ms stagger between cards. The hook fires inside `CardManager.dealDamageToPlayer` so it triggers for both creature damage and spell damage uniformly.
- **Creature taking damage** — the damage counter badge appears or increments on the creature.
- **Creature destroyed** — creature card is removed from the board zone.
- **Target-available pulse** — valid targets get a red `pulse-red` animation on their border.

## Modals

- **Game-over overlay** (`.overlay` + `.overlay-box`) — dark blur with "PLAY AGAIN" and "CHANGE DECKS" buttons plus `.gameover-stats` summary (turns played, cards remaining for each player).
- **Discard viewer** (`.discard-viewer-overlay` + `.discard-viewer-modal`) — opens when either discard pile is clicked; grid of all cards in that pile, scrollable. Empty piles show "No cards in discard pile." Clicking a card in the grid opens the full-size hover preview. Also used for card selection spells (Accio, Hagrid) — in that mode, cards are toggleable with a confirm/cancel action bar.
