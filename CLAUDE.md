# Harry Potter Trading Card Game — Project Reference

A browser-based implementation of the **Harry Potter TCG** (WotC, 2001). Human player (Hermione) vs. bot (Draco), using pre-defined starter decks. Runs entirely in HTML + CSS + JS — no server, no build step.

## IMPORTANT: Ignored Directories

**ALWAYS ignore all content inside the `old/` folder.** Do not read, reference, or base any code on files in `old/`. It contains outdated prototypes that must not influence the current implementation.

## Documentation

| File | Contents |
|------|----------|
| [`rules.md`](rules.md) | Game rules: win condition, turn structure, card types, power system, creatures, adventures, starting characters |
| [`data.md`](data.md) | `cards.json` and deck JSON schemas; `effectCode` → behavior mapping |
| [`ui.md`](ui.md) | Play area layout, UI requirements, card visual design, animations |
| [`player.md`](player.md) | Human player input: action phase clicks, targeting, auto-resolve phases |
| [`bot.md`](bot.md) | Dumb bot priority logic; v1 scope simplifications |

## Architecture

```
hptcg/
├── CLAUDE.md              # This file — project index
├── rules.md               # Game rules reference
├── data.md                # Card data schemas & effect codes
├── ui.md                  # UI layout, design, animations
├── player.md              # Player interaction spec
├── bot.md                 # Bot AI & v1 scope
├── index.html             # Game entry point (HTML structure)
├── css/                   # Split by concern; loaded in order from index.html
│   ├── base.css           # Design tokens (:root), reset, body
│   ├── sidebar.css        # Left sidebar: panels, deck-life meter, log, controls
│   ├── board.css          # Main board: hands, halves, piles, thumbs, char cards, badges, lessons
│   ├── cards.css          # Card image sizing, horizontal rotation trick, hover preview
│   ├── overlays.css       # Game-over, Hermione prompt, target banner, spell staging
│   └── modals.css         # Discard viewer modal
├── assets/
│   └── cards/             # Card artwork PNGs (one per card)
├── data/
│   ├── cards.json         # Card database: all cards used in both decks
│   ├── deck_hermione.json # Hermione's 40-card deck list (+ starting character ref)
│   └── deck_malfoy.json   # Malfoy's 40-card deck list (+ starting character ref)
├── js/
│   ├── game.js            # Core game engine (state, rules, turn logic)
│   ├── bot.js             # Bot AI
│   ├── cards.js           # Card loading, parsing, effect resolution
│   └── ui.js              # DOM manipulation, rendering, animation
└── old/                   # IGNORE — outdated prototypes, do not use
```

## Development Notes

- All game logic runs client-side in the browser.
- No external dependencies — vanilla JS, HTML, CSS.
- Card data loaded via `fetch()` from `data/` (requires a local server or `file://` workaround).
- Animations/delays between actions help the viewer follow the game.
- Use `console.log` liberally for debugging game state.
