# Harry Potter Trading Card Game — Project Reference

A browser-based implementation of the **Harry Potter TCG** (WotC, 2001). Human player vs. bot, using pre-defined starter decks chosen via a deck selection screen. Runs entirely in HTML + CSS + JS — no server, no build step.

## IMPORTANT: Ignored Directories

**ALWAYS ignore all content inside the `old/` folder.** Do not read, reference, or base any code on files in `old/`. It contains outdated prototypes that must not influence the current implementation.

## Documentation

| File | Contents |
|------|----------|
| [`rules.md`](rules.md) | Game rules: win condition, turn structure, card types, power system, creatures, adventures, starting characters |
| [`data.md`](data.md) | `cards.json`, deck JSON, and `decks.json` schemas; `effectCode` → behavior mapping; effect handler registry |
| [`ui.md`](ui.md) | Deck selection screen, play area layout, card visual design, animations, modals |
| [`player.md`](player.md) | Human player input: action phase clicks, targeting, card selection, auto-resolve phases |
| [`bot.md`](bot.md) | Bot priority logic with power-cap heuristic; v1 scope simplifications |

## Architecture

```
hptcg/
├── CLAUDE.md              # This file — project index
├── rules.md               # Game rules reference
├── data.md                # Card data schemas & effect codes
├── ui.md                  # UI layout, design, animations
├── player.md              # Player interaction spec
├── bot.md                 # Bot AI & v1 scope
├── deck_select.html       # Deck selection entry point
├── index.html             # Game board (redirects to deck_select if no choice)
├── css/                   # Split by concern; loaded in order
│   ├── base.css           # Design tokens (:root), reset, body
│   ├── deck_select.css    # Deck selection screen layout, cards grid, bottom bar
│   ├── sidebar.css        # Right sidebar: log, controls
│   ├── board.css          # Main board: hands, halves, piles, thumbs, char cards, badges, lessons
│   ├── cards.css          # Card image sizing, horizontal rotation trick, hover preview
│   ├── overlays.css       # Game-over, Hermione prompt, target banner, spell staging
│   └── modals.css         # Discard viewer modal
├── assets/
│   ├── cards/             # Card artwork WebP images (one per card)
│   └── icons/             # Lesson-type icon PNGs (cofc, charms, transfiguration, potions, quidditch)
├── data/
│   ├── cards.json         # Card database: all cards used in all decks
│   ├── decks.json         # Deck manifest: array of deck file paths
│   ├── deck_hermione.json # Hermione's 40-card deck list (+ starting character ref)
│   └── deck_malfoy.json   # Malfoy's 40-card deck list (+ starting character ref)
├── js/
│   ├── version.js         # GAME_VERSION, STORAGE_KEY constants, localStorage compat check
│   ├── cards.js           # Card loading, isHorizontal(), effect handler registry, game actions (draw/damage/shuffle)
│   ├── game.js            # Core game engine (state, turn flow, unified player/bot action methods)
│   ├── bot.js             # Bot AI (power-capped lesson priority, spell/creature preference)
│   ├── ui.js              # DOM rendering, flying-card animations, player click handlers, modals
│   └── deck_select.js     # Deck selection screen controller (preview, chips, localStorage persistence)
└── old/                   # IGNORE — outdated prototypes, do not use
```

## Shared Constants

- `GAME_VERSION` — bumped when saved data format changes, forces a clean `localStorage` reset.
- `STORAGE_KEY` (`'hptcg-deck-choice'`) — single constant in `version.js` referenced by all files that read/write the deck choice.

## Key Design Patterns

- **Effect handler registry** — `cards.js` uses `registerEffect(pattern, handler)` to map `effectCode` strings to handler functions. Adding a new effect is a single function call. The dispatcher in `resolveEffect()` tries three match strategies: special-case (e.g. `return_from_discard_TYPE_N`), numeric-suffix (`handler_name_N`), and exact-match.
- **Unified player/bot actions** — `game.js` provides shared `playLesson()`, `playCreature()`, `drawCard()` helpers used by both the player-facing and bot-facing methods, eliminating duplication.
- **Flying-card factory** — `ui.js` uses `createFlyingCard()` + `flyTo()` to create and animate all card-flight effects (play, draw, mill) through a single code path.
- **`CardManager.isHorizontal(card)`** — shared helper determining whether a card uses landscape orientation. Used by both `ui.js` and `deck_select.js`.
- **AbortController for event cleanup** — discard pile rendering uses `AbortController` signals to automatically clean up event listeners between re-renders.

## Development Notes

- All game logic runs client-side in the browser.
- No external dependencies — vanilla JS, HTML, CSS.
- Card data loaded via `fetch()` from `data/` (requires a local server or `file://` workaround). All `fetch()` calls include `response.ok` error checking.
- Animations/delays between actions help the viewer follow the game.
- Character abilities are gated on the character's `effectCode` — Hermione's double-lesson only triggers for characters with `hermione_double_lesson`.
- Deck health badge color thresholds use the player's actual `initialDeckSize` (stored at game setup) rather than a hardcoded 40.
