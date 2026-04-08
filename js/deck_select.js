// deck_select.js — Deck selection screen controller

(async () => {
  // Load card database (so getCard() works for previews)
  await CardManager.loadCards();

  // Load deck manifest
  const manifestRes = await fetch('data/decks.json');
  if (!manifestRes.ok) throw new Error(`Failed to load deck manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();

  // Fetch each deck JSON unexpanded to keep the {id, count} list intact
  const decks = await Promise.all(
    manifest.decks.map(async (file) => {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Failed to load deck ${file}: ${res.status}`);
      const data = await res.json();
      return { file, data };
    })
  );

  // State
  let previewIdx = 0;
  let playerFile = null;
  let botFile = null;

  // ── DOM refs ────────────────────────────────────────────────
  const deckListEl = document.getElementById('ds-deck-list');
  const previewEl = document.getElementById('ds-preview');
  const startBtn = document.getElementById('ds-start-btn');
  const playerStatus = document.getElementById('ds-status-player');
  const botStatus = document.getElementById('ds-status-bot');

  // ── Spotlight (card hover preview — singleton) ──────────────

  let spotlightPane = null;
  let spotlightInner = null;

  function buildSpotlight() {
    if (spotlightPane) return spotlightPane;

    spotlightPane = document.createElement('div');
    spotlightPane.className = 'ds-card-spotlight';

    const title = document.createElement('div');
    title.className = 'ds-section-label';
    title.textContent = 'Card Preview';
    spotlightPane.appendChild(title);

    const wrap = document.createElement('div');
    wrap.className = 'ds-spotlight-card-wrap';

    spotlightInner = document.createElement('div');
    spotlightInner.className = 'ds-card-spotlight-inner hidden horizontal';
    spotlightInner.innerHTML = '<img draggable="false" />';
    wrap.appendChild(spotlightInner);
    spotlightPane.appendChild(wrap);

    return spotlightPane;
  }

  function showSpotlight(card) {
    if (!spotlightInner) return;
    const isHoriz = CardManager.isHorizontal(card);
    spotlightInner.className = 'ds-card-spotlight-inner ' + (isHoriz ? 'horizontal' : 'portrait');
    spotlightInner.querySelector('img').src = card.image;
    spotlightInner.querySelector('img').alt = card.name;
  }

  function hideSpotlight() {
    if (!spotlightInner) return;
    spotlightInner.classList.add('hidden');
  }

  // ── Card element builder ────────────────────────────────────
  function makeCardEl(card, count) {
    const isHorizontal = CardManager.isHorizontal(card);
    const cardEl = document.createElement('div');
    cardEl.className = 'ds-card' + (isHorizontal ? '' : ' portrait');

    const img = document.createElement('img');
    img.src = card.image;
    img.alt = card.name;
    img.title = card.name;
    img.draggable = false;
    cardEl.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'ds-card-count';
    badge.textContent = '\u00d7' + count;
    cardEl.appendChild(badge);

    cardEl.addEventListener('mouseenter', () => showSpotlight(card));
    cardEl.addEventListener('mouseleave', hideSpotlight);

    return cardEl;
  }

  // ── Render deck list (left column) ──────────────────────────
  function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach((deck, idx) => {
      const row = document.createElement('div');
      row.className = 'ds-deck-row';
      if (idx === previewIdx) row.classList.add('previewing');

      const total = deck.data.cards.reduce((sum, e) => sum + e.count, 0);

      const name = document.createElement('div');
      name.className = 'ds-deck-row-name';
      name.innerHTML = `${deck.data.name} <span class="ds-deck-row-count">(${total} cards)</span>`;
      row.appendChild(name);

      const chipRow = document.createElement('div');
      chipRow.className = 'ds-chip-row';

      const meChip = document.createElement('button');
      meChip.className = 'ds-chip me';
      meChip.textContent = '\uD83D\uDC64 Me';
      if (playerFile === deck.file) meChip.classList.add('active');
      meChip.addEventListener('click', (e) => {
        e.stopPropagation();
        playerFile = (playerFile === deck.file) ? null : deck.file;
        renderAll();
      });

      const botChip = document.createElement('button');
      botChip.className = 'ds-chip bot';
      botChip.textContent = '\uD83E\uDD16 Bot';
      if (botFile === deck.file) botChip.classList.add('active');
      botChip.addEventListener('click', (e) => {
        e.stopPropagation();
        botFile = (botFile === deck.file) ? null : deck.file;
        renderAll();
      });

      chipRow.appendChild(meChip);
      chipRow.appendChild(botChip);
      row.appendChild(chipRow);

      row.addEventListener('click', () => {
        previewIdx = idx;
        renderAll();
      });

      deckListEl.appendChild(row);
    });
  }

  // ── Render preview (right column) ───────────────────────────
  function renderPreview() {
    const deck = decks[previewIdx];
    if (!deck) {
      previewEl.innerHTML = '<div class="ds-preview-empty" style="grid-column:1/-1">Select a deck on the left to preview it</div>';
      return;
    }
    const data = deck.data;

    previewEl.innerHTML = '';

    // Left 60%: main content
    const main = document.createElement('div');
    main.className = 'ds-preview-main';
    previewEl.appendChild(main);

    // Right 40%: card spotlight (reuse singleton)
    previewEl.appendChild(buildSpotlight());

    const scroll = document.createElement('div');
    scroll.className = 'ds-preview-scroll';
    main.appendChild(scroll);

    const nameEl = document.createElement('div');
    nameEl.className = 'ds-preview-name';
    nameEl.textContent = data.name;
    scroll.appendChild(nameEl);

    if (data.description) {
      const descEl = document.createElement('div');
      descEl.className = 'ds-preview-desc';
      descEl.textContent = data.description;
      scroll.appendChild(descEl);
    }

    const grid = document.createElement('div');
    grid.className = 'ds-cards-grid';

    // Character card first (×1, no count badge needed but kept consistent)
    const charCard = CardManager.getCard(data.startingCharacter);
    if (charCard) {
      const cardEl = makeCardEl(charCard, 1);
      grid.appendChild(cardEl);
    }

    for (const entry of data.cards) {
      const card = CardManager.getCard(entry.id);
      if (!card) continue;
      grid.appendChild(makeCardEl(card, entry.count));
    }

    scroll.appendChild(grid);
  }

  // ── Render bottom bar / button state ────────────────────────
  function renderBottomBar() {
    const playerDeck = decks.find(d => d.file === playerFile);
    const botDeck = decks.find(d => d.file === botFile);

    if (playerDeck) {
      playerStatus.classList.remove('empty');
      playerStatus.innerHTML = `<span class="ds-status-label">\uD83D\uDC64 Your Deck</span><span class="ds-status-value">${playerDeck.data.name}<span class="ds-check">\u2713</span></span>`;
    } else {
      playerStatus.classList.add('empty');
      playerStatus.innerHTML = `<span class="ds-status-label">\uD83D\uDC64 Your Deck</span><span class="ds-status-value">Not selected</span>`;
    }

    if (botDeck) {
      botStatus.classList.remove('empty');
      botStatus.innerHTML = `<span class="ds-status-label">\uD83E\uDD16 Bot Deck</span><span class="ds-status-value">${botDeck.data.name}<span class="ds-check">\u2713</span></span>`;
    } else {
      botStatus.classList.add('empty');
      botStatus.innerHTML = `<span class="ds-status-label">\uD83E\uDD16 Bot Deck</span><span class="ds-status-value">Not selected</span>`;
    }


    startBtn.disabled = !(playerFile && botFile);
  }

  function renderAll() {
    renderDeckList();
    renderPreview();
    renderBottomBar();
  }

  startBtn.addEventListener('click', () => {
    if (!playerFile || !botFile) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: GAME_VERSION, player: playerFile, bot: botFile }));
    location.href = 'index.html';
  });

  // Restore previous selection if any (so coming back from game-over feels seamless)
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && decks.find(d => d.file === saved.player)) playerFile = saved.player;
    if (saved && decks.find(d => d.file === saved.bot)) botFile = saved.bot;
  } catch (_) {}

  renderAll();
})();
