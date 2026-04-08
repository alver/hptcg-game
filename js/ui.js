// ui.js — Rendering, animations, and player interaction

const UI = (() => {
  const LESSON_COLORS = {
    F: 'var(--c-lesson-F)', C: 'var(--c-lesson-C)',
    T: 'var(--c-lesson-T)', P: 'var(--c-lesson-P)', Q: 'var(--c-lesson-Q)'
  };
  const LESSON_NAMES = { F: 'CoMC', C: 'Charms', T: 'Transf.', P: 'Potions', Q: 'Quidditch' };
  const LESSON_ICONS = { F: '\uD83E\uDD8E', C: '\u2728', T: '\uD83D\uDD04', P: '\uD83E\uDDEA', Q: '\uD83C\uDFC6' };
  const INITIAL_DECK_SIZE = 40;
  const HORIZONTAL_TYPES = new Set(['lesson', 'creature', 'character']);

  let targetMode = false;
  let targetValidTargets = [];
  let cardSelectionMode = false;
  let cardSelectionChoices = [];

  // Pluralized labels for card-selection prompts
  const CARD_TYPE_LABELS = {
    lesson: { singular: 'Lesson', plural: 'Lessons' },
    creature: { singular: 'Creature', plural: 'Creatures' },
    spell: { singular: 'Spell', plural: 'Spells' },
    any: { singular: 'Card', plural: 'Cards' },
  };

  // ─── IMAGE CACHE HELPER ────────────────────────────────────────

  function makeCardImg(card, className) {
    const img = document.createElement('img');
    img.src = card.image;
    img.alt = card.name;
    img.className = className;
    img.draggable = false;
    return img;
  }

  // ─── ENTRY POINTS ──────────────────────────────────────────────

  async function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-log').innerHTML = '';
    await GameEngine.setupGame(onStateChange);

    // Populate character cards with images and add hover preview
    const state = GameEngine.getState();

    // Set deck names in sidebar panels
    if (state.bot.deckName) document.getElementById('bot-deck-name').textContent = state.bot.deckName;
    if (state.player.deckName) document.getElementById('player-deck-name').textContent = state.player.deckName;

    if (state.player.characterCard) {
      setupCharacterCard('player-character-card', state.player.characterCard);
    }
    if (state.bot.characterCard) {
      setupCharacterCard('bot-character-card', state.bot.characterCard);
    }

    await GameEngine.startTurn();
  }

  function setupCharacterCard(elementId, card) {
    const el = document.getElementById(elementId);
    el.classList.add('horizontal');
    el.innerHTML = '';
    el.appendChild(makeCardImg(card, 'char-card-img horizontal'));
    el.addEventListener('mouseenter', () => showCardPreview(card));
    el.addEventListener('mouseleave', clearCardPreview);
  }

  function restartGame() {
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
  }

  // ─── STATE CHANGE CALLBACK ─────────────────────────────────────

  function onStateChange(state, newLogs) {
    renderState(state);
    for (const entry of newLogs) {
      addLogEntry(entry.message, entry.type);
    }
    if (state.phase === 'game_over' || state.winner) {
      showGameOver(state.winner);
      return;
    }
    updateControls(state);
    updateCenterStrip(state);
  }

  // ─── RENDERING ─────────────────────────────────────────────────

  function renderState(state) {
    renderBotHand(state);
    renderBoardHalf(state.bot, 'bot', state);
    renderBoardHalf(state.player, 'player', state);
    renderPlayerHand(state);
    updatePileCounts(state);
  }

  function deckHealthClass(count) {
    const pct = count / INITIAL_DECK_SIZE;
    if (pct < 0.20) return 'deck-danger';
    if (pct < 0.60) return 'deck-warning';
    return '';
  }

  function updatePileCounts(state) {
    const botBadge = document.getElementById('bot-deck-count');
    botBadge.textContent = state.bot.deck.length;
    botBadge.classList.remove('deck-warning', 'deck-danger');
    botBadge.classList.add(...[deckHealthClass(state.bot.deck.length)].filter(Boolean));

    const playerBadge = document.getElementById('player-deck-count');
    playerBadge.textContent = state.player.deck.length;
    playerBadge.classList.remove('deck-warning', 'deck-danger');
    playerBadge.classList.add(...[deckHealthClass(state.player.deck.length)].filter(Boolean));

    document.getElementById('bot-discard-count').textContent = state.bot.discard.length;
    document.getElementById('player-discard-count').textContent = state.player.discard.length;

    document.getElementById('log-turn').textContent = `Turn ${state.turnNumber}`;
  }

  // ─── BOT HAND (face-down) ─────────────────────────────────────

  function renderBotHand(state) {
    const container = document.getElementById('bot-hand');
    container.innerHTML = '';
    for (let i = 0; i < state.bot.hand.length; i++) {
      const card = document.createElement('div');
      card.className = 'deck-back-card';
      container.appendChild(card);
    }
  }

  // ─── PLAYER HAND ──────────────────────────────────────────────

  function renderPlayerHand(state) {
    const container = document.getElementById('player-hand');
    container.innerHTML = '';
    const hand = state.player.hand;

    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      const playable = isCardPlayable(card, state);
      const el = createHandCard(card, playable);

      if (playable) {
        el.addEventListener('click', () => onCardClick(card));
      }
      el.addEventListener('mouseenter', () => showCardPreview(card));
      el.addEventListener('mouseleave', clearCardPreview);

      container.appendChild(el);
    }
  }

  function createHandCard(card, playable) {
    const el = document.createElement('div');
    el.className = 'hand-card';
    if (HORIZONTAL_TYPES.has(card.type)) el.classList.add('horizontal');
    if (playable) el.classList.add('playable');
    else if (card.type !== 'lesson') el.classList.add('unaffordable');

    el.appendChild(makeCardImg(card, 'hand-card-img' + (HORIZONTAL_TYPES.has(card.type) ? ' horizontal' : '')));

    return el;
  }

  // ─── BOARD HALF RENDERING ──────────────────────────────────────

  function renderBoardHalf(player, side, state) {
    const isBot = side === 'bot';

    // Lessons zone
    const lessonsZone = document.getElementById(side + '-lessons-zone');
    const zoneTitle = lessonsZone.querySelector('.zone-title');
    lessonsZone.innerHTML = '';
    lessonsZone.appendChild(zoneTitle);
    const lessonGroups = {};
    for (const l of player.lessonsInPlay) {
      if (!lessonGroups[l.lessonType]) lessonGroups[l.lessonType] = { count: 0, card: l };
      lessonGroups[l.lessonType].count++;
    }
    for (const [type, group] of Object.entries(lessonGroups)) {
      const el = createLessonStack(type, group.count, group.card);
      el.addEventListener('mouseenter', () => showCardPreview(group.card));
      el.addEventListener('mouseleave', clearCardPreview);
      lessonsZone.appendChild(el);
    }

    // Creatures zone
    const creaturesZone = document.getElementById(side + '-creatures-zone');
    const cTitle = creaturesZone.querySelector('.zone-title');
    creaturesZone.innerHTML = '';
    creaturesZone.appendChild(cTitle);
    for (const c of player.creaturesInPlay) {
      const el = createCreatureThumb(c, state);
      el.addEventListener('mouseenter', () => showCardPreview(c.card));
      el.addEventListener('mouseleave', clearCardPreview);
      if (targetMode && isBot) {
        const validCreature = targetValidTargets.find(t => t.type === 'creature' && t.creature === c);
        if (validCreature) {
          el.classList.add('target-available');
          el.addEventListener('click', () => onTargetClick(validCreature));
        }
      }
      creaturesZone.appendChild(el);
    }

    // Discard pile — show top card face-up
    const discardEl = document.getElementById(side + '-discard');
    const newDiscard = discardEl.cloneNode(false); // don't clone children
    discardEl.parentNode.replaceChild(newDiscard, discardEl);
    const discardLabel = side === 'player' ? 'Your' : 'Opponent';
    newDiscard.style.cursor = 'pointer';
    newDiscard.addEventListener('click', () => showDiscardView(player, discardLabel));

    if (player.discard.length > 0) {
      const topCard = player.discard[player.discard.length - 1];
      const isHoriz = HORIZONTAL_TYPES.has(topCard.type);
      const img = makeCardImg(topCard, 'discard-top-img' + (isHoriz ? ' horizontal' : ''));
      newDiscard.appendChild(img);
      const badge = document.createElement('span');
      badge.className = 'pile-badge discard-badge';
      badge.id = side + '-discard-count';
      badge.textContent = player.discard.length;
      newDiscard.appendChild(badge);
      newDiscard.addEventListener('mouseenter', () => showCardPreview(topCard));
      newDiscard.addEventListener('mouseleave', clearCardPreview);
    } else {
      const label = document.createElement('span');
      label.className = 'zone-title';
      label.textContent = 'Discard';
      newDiscard.appendChild(label);
      const badge = document.createElement('span');
      badge.className = 'pile-badge discard-badge';
      badge.id = side + '-discard-count';
      badge.textContent = '0';
      newDiscard.appendChild(badge);
    }
  }

  function createLessonStack(type, count, sampleCard) {
    const stack = document.createElement('div');
    stack.className = 'lesson-stack horizontal'; // lessons are always landscape

    stack.appendChild(makeCardImg(sampleCard, 'lesson-stack-img horizontal'));

    const badge = document.createElement('span');
    badge.className = 'lesson-count';
    badge.textContent = '\u00d7' + count;
    badge.title = `${LESSON_NAMES[type] || type}: ${count}`;
    stack.appendChild(badge);

    return stack;
  }

  function createCreatureThumb(creatureInPlay, state) {
    const { card, damageCounters, turnPlayed } = creatureInPlay;
    const el = document.createElement('div');
    el.className = 'card-thumb horizontal'; // creatures are always landscape
    el.style.borderColor = 'var(--c-creature)';

    const currentHp = card.health - damageCounters;

    el.appendChild(makeCardImg(card, 'thumb-img horizontal'));

    // Stat badges overlay
    el.insertAdjacentHTML('beforeend', `
      <div class="stat-badge dmg-badge">${card.damage}</div>
      <div class="stat-badge hp-badge">${currentHp}</div>
      ${damageCounters > 0 ? `<div class="stat-badge dmg-counter-badge">${damageCounters}</div>` : ''}
    `);

    return el;
  }

  function renderPowerPips(elementId, byType) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    for (const [type, count] of Object.entries(byType)) {
      if (count === 0) continue;
      const pip = document.createElement('span');
      pip.className = 'power-pip';
      pip.style.color = LESSON_COLORS[type];
      pip.textContent = (LESSON_ICONS[type] || type) + ' ' + count;
      el.appendChild(pip);
    }
  }

  // ─── CENTER STRIP ──────────────────────────────────────────────

  function updateCenterStrip(state) {
    const isPlayerTurn = state.currentPlayer === state.player;

    // Turn background tint on board halves + hand rows
    const playerHalf = document.getElementById('player-board-half');
    const botHalf = document.getElementById('bot-board-half');
    const playerHandRow = document.getElementById('player-hand-row');
    const botHandRow = document.getElementById('bot-hand-row');
    playerHalf.classList.toggle('active-turn-player', isPlayerTurn);
    playerHalf.classList.toggle('active-turn-bot', false);
    botHalf.classList.toggle('active-turn-bot', !isPlayerTurn);
    botHalf.classList.toggle('active-turn-player', false);
    playerHandRow.classList.toggle('active-turn-player', isPlayerTurn);
    botHandRow.classList.toggle('active-turn-bot', !isPlayerTurn);

    // Big action dots sitting on the dividing line
    const dot1 = document.getElementById('big-action-dot-1');
    const dot2 = document.getElementById('big-action-dot-2');
    const dots = [dot1, dot2];
    const showActions = state.phase === 'actions';
    const filledClass = isPlayerTurn ? 'filled' : 'bot-filled';
    for (let i = 0; i < 2; i++) {
      dots[i].className = 'big-action-dot';
      if (showActions) {
        dots[i].classList.add(i < state.actionsRemaining ? filledClass : 'spent');
      }
    }
  }

  function updateControls(state) {
    const isPlayerTurn = state.waitingForInput;
    document.getElementById('btn-draw').disabled = !isPlayerTurn || state.actionsRemaining <= 0;
    document.getElementById('btn-end-turn').disabled = !isPlayerTurn;

    const prompt = document.getElementById('hermione-prompt');
    if (state.hermioneAbilityPending && isPlayerTurn) {
      prompt.classList.add('visible');
      renderHermionePromptLessons(state.player.hand.filter(c => c.type === 'lesson'));
    } else {
      prompt.classList.remove('visible');
    }
  }

  // ─── CARD HOVER PREVIEW ────────────────────────────────────────

  function showCardPreview(card) {
    if (!card) return;
    const el = document.getElementById('card-hover-preview');
    el.classList.toggle('horizontal', HORIZONTAL_TYPES.has(card.type));
    el.innerHTML = '';
    el.appendChild(makeCardImg(card, ''));
    el.classList.add('visible');
  }

  function clearCardPreview() {
    document.getElementById('card-hover-preview').classList.remove('visible');
  }

  // ─── DISCARD VIEWER ────────────────────────────────────────────

  function showDiscardView(player, label, selectionOpts = null) {
    const overlay = document.getElementById('discard-viewer');
    const grid = document.getElementById('discard-viewer-grid');
    const title = document.getElementById('discard-viewer-title');
    const modal = overlay.querySelector('.discard-viewer-modal');

    const isSelectMode = !!selectionOpts;
    const { eligibleCards = [], maxSelect = 0, cardTypeLabel = 'any' } = selectionOpts || {};

    if (isSelectMode) {
      const labels = CARD_TYPE_LABELS[cardTypeLabel] || CARD_TYPE_LABELS.any;
      const noun = maxSelect === 1 ? labels.singular : labels.plural;
      title.textContent = maxSelect === 1
        ? `Choose 1 ${noun} to return to your hand`
        : `Choose up to ${maxSelect} ${noun} to return to your hand`;
    } else {
      title.textContent = `${label} — Discard Pile (${player.discard.length})`;
    }

    // Remove any previous confirm/cancel bar
    modal.querySelector('.card-pick-action-bar')?.remove();
    grid.innerHTML = '';

    // Build confirm button early so card handlers can close over it
    let confirmBtn = null;
    if (isSelectMode) {
      confirmBtn = document.createElement('button');
      confirmBtn.className = 'hermione-btn';
      confirmBtn.style.background = 'rgba(201,168,76,0.2)';
      confirmBtn.textContent = `Return Selected (0/${maxSelect})`;
      confirmBtn.addEventListener('click', confirmCardSelection);
    }

    const updateConfirmLabel = () => {
      if (confirmBtn) confirmBtn.textContent = `Return Selected (${cardSelectionChoices.length}/${maxSelect})`;
    };

    // In selection mode show only eligible cards, otherwise show full discard (recent first)
    const cardsToShow = isSelectMode ? eligibleCards : [...player.discard].reverse();

    for (const card of cardsToShow) {
      const cardEl = document.createElement('div');
      cardEl.className = 'discard-grid-card';
      if (HORIZONTAL_TYPES.has(card.type)) cardEl.classList.add('horizontal');
      cardEl.appendChild(makeCardImg(card, ''));
      cardEl.addEventListener('mouseenter', () => showCardPreview(card));
      cardEl.addEventListener('mouseleave', clearCardPreview);

      if (isSelectMode) {
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', () => {
          const idx = cardSelectionChoices.indexOf(card);
          if (idx !== -1) {
            cardSelectionChoices.splice(idx, 1);
            cardEl.classList.remove('card-pick-selected');
          } else if (cardSelectionChoices.length < maxSelect) {
            cardSelectionChoices.push(card);
            cardEl.classList.add('card-pick-selected');
          }
          updateConfirmLabel();
        });
      }

      grid.appendChild(cardEl);
    }

    if (isSelectMode) {
      const bar = document.createElement('div');
      bar.className = 'card-pick-action-bar';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'hermione-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', cancelCardSelection);

      bar.appendChild(cancelBtn);
      bar.appendChild(confirmBtn);
      modal.appendChild(bar);
    }

    overlay.style.display = 'flex';
  }

  function hideDiscardView() {
    const modal = document.querySelector('#discard-viewer .discard-viewer-modal');
    modal?.querySelector('.card-pick-action-bar')?.remove();
    document.getElementById('discard-viewer').style.display = 'none';
    clearCardPreview();
  }

  // ─── HELPERS ───────────────────────────────────────────────────

  function isCardPlayable(card, state) {
    if (!state.waitingForInput || state.actionsRemaining <= 0) return false;
    if (state.hermioneAbilityPending) return false;
    if (card.type === 'lesson') return true;
    if (card.type === 'spell' || card.type === 'creature') {
      return CardManager.canAfford(card, state.player);
    }
    return false;
  }

  // ─── HERMIONE PROMPT ───────────────────────────────────────────

  function renderHermionePromptLessons(lessons) {
    const prompt = document.getElementById('hermione-prompt');
    prompt.querySelectorAll('.hermione-lesson-btn').forEach(e => e.remove());
    for (const lesson of lessons) {
      const btn = document.createElement('button');
      btn.className = 'hermione-btn hermione-lesson-btn';
      btn.textContent = lesson.name;
      btn.onclick = () => hermionePickLesson(lesson);
      prompt.insertBefore(btn, document.getElementById('btn-hermione-skip'));
    }
  }

  function hermionePickLesson(lesson) {
    GameEngine.playerHermioneBonusLesson(lesson);
    document.getElementById('hermione-prompt').classList.remove('visible');
  }

  function hermioneSkip() {
    GameEngine.playerHermioneBonusLesson(null);
    document.getElementById('hermione-prompt').classList.remove('visible');
  }

  // ─── SPELL STAGING ─────────────────────────────────────────────

  function showSpellStaging(card) {
    const container = document.getElementById('spell-staging-container');
    const el = document.createElement('div');
    el.className = 'spell-spotlight';
    el.appendChild(makeCardImg(card, 'spell-staging-img'));
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ─── GAME LOG ──────────────────────────────────────────────────

  function addLogEntry(message, type = 'action') {
    const logEl = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ─── PLAYER CLICK HANDLERS ─────────────────────────────────────

  function onCardClick(card) {
    if (targetMode) return;

    const state = GameEngine.getState();
    if (!state.waitingForInput || state.actionsRemaining <= 0) return;
    if (state.hermioneAbilityPending) return;

    if (card.type === 'spell') showSpellStaging(card);

    const result = GameEngine.playerPlayCard(card);
    if (result.error) {
      addLogEntry('\u26A0 ' + result.error, 'system');
      return;
    }
    if (result.needsTarget) {
      enterTargetMode(result.validTargets);
    } else if (result.needsCardSelection) {
      enterCardSelectionMode(result.eligibleCards, result.maxSelect, result.cardTypeLabel);
    }
  }

  function enterTargetMode(validTargets) {
    targetMode = true;
    targetValidTargets = validTargets;
    document.getElementById('target-banner').classList.add('visible');

    const opponentTarget = validTargets.find(t => t.type === 'opponent');
    if (opponentTarget) {
      const deckEl = document.getElementById('bot-deck');
      deckEl.classList.add('target-available');
      deckEl.style.cursor = 'crosshair';
      deckEl.addEventListener('click', handleOpponentDeckClick, { once: true });
    }
    renderState(GameEngine.getState());
  }

  function handleOpponentDeckClick() {
    if (!targetMode) return;
    const opponentTarget = targetValidTargets.find(t => t.type === 'opponent');
    if (opponentTarget) onTargetClick(opponentTarget);
  }

  function onTargetClick(target) {
    if (!targetMode) return;
    exitTargetMode();
    const result = GameEngine.playerResolveTarget(target);
    if (result.error) addLogEntry('\u26A0 ' + result.error, 'system');
  }

  function exitTargetMode() {
    targetMode = false;
    targetValidTargets = [];
    document.getElementById('target-banner').classList.remove('visible');
    const deckEl = document.getElementById('bot-deck');
    deckEl.classList.remove('target-available');
    deckEl.style.cursor = '';
    deckEl.removeEventListener('click', handleOpponentDeckClick);
  }

  function cancelTargetMode() {
    if (!targetMode) return;
    exitTargetMode();
    const state = GameEngine.getState();
    if (state.pendingEffect) state.pendingEffect = null;
    addLogEntry('Spell cancelled.', 'system');
  }

  function enterCardSelectionMode(eligibleCards, maxSelect, cardTypeLabel) {
    cardSelectionMode = true;
    cardSelectionChoices = [];
    showDiscardView(GameEngine.getState().player, 'Your Discard', {
      eligibleCards,
      maxSelect,
      cardTypeLabel,
    });
  }

  function confirmCardSelection() {
    cardSelectionMode = false;
    const selected = cardSelectionChoices.slice();
    cardSelectionChoices = [];
    hideDiscardView();
    const result = GameEngine.playerResolveCardSelection(selected);
    if (result.error) addLogEntry('\u26A0 ' + result.error, 'system');
  }

  function cancelCardSelection() {
    cardSelectionMode = false;
    cardSelectionChoices = [];
    hideDiscardView();
    const state = GameEngine.getState();
    if (state.pendingEffect) state.pendingEffect = null;
    addLogEntry('Spell cancelled.', 'system');
  }

  function onDrawCard() {
    const result = GameEngine.playerDrawCard();
    if (result.error) addLogEntry('\u26A0 ' + result.error, 'system');
  }

  function onEndTurn() {
    exitTargetMode();
    const state = GameEngine.getState();
    if (state.hermioneAbilityPending) {
      GameEngine.playerHermioneBonusLesson(null);
      document.getElementById('hermione-prompt').classList.remove('visible');
    }
    const result = GameEngine.playerEndTurn();
    if (result.error) addLogEntry('\u26A0 ' + result.error, 'system');
  }

  // ─── GAME OVER ─────────────────────────────────────────────────

  function showGameOver(winner) {
    const screen = document.getElementById('gameover-screen');
    const title = document.getElementById('gameover-title');
    const sub = document.getElementById('gameover-subtitle');
    const stats = document.getElementById('gameover-stats');
    const state = GameEngine.getState();

    if (winner === state.player) {
      title.textContent = 'VICTORY!';
      title.style.color = 'var(--gold)';
      sub.textContent = "You defeated Draco Malfoy! Gryffindor wins!";
    } else {
      title.textContent = 'DEFEAT';
      title.style.color = 'var(--damage)';
      sub.textContent = "Draco's deck outlasted yours. Better luck next time.";
    }
    stats.innerHTML = `
      <div>Turns played: ${state.turnNumber}</div>
      <div>Your deck: ${state.player.deck.length} cards remaining</div>
      <div>Draco's deck: ${state.bot.deck.length} cards remaining</div>
    `;
    screen.style.display = 'flex';
  }

  // ─── DISCARD VIEWER INIT (one-time) ────────────────────────────

  function initDiscardViewer() {
    const overlay = document.getElementById('discard-viewer');
    const closeBtn = document.getElementById('discard-viewer-close');
    const modal = overlay.querySelector('.discard-viewer-modal');

    closeBtn.addEventListener('click', () => {
      cardSelectionMode ? cancelCardSelection() : hideDiscardView();
    });

    // Click outside the modal closes it
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cardSelectionMode ? cancelCardSelection() : hideDiscardView();
      }
    });

    // Stop click inside modal from bubbling to overlay
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Esc key closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display !== 'none') {
        cardSelectionMode ? cancelCardSelection() : hideDiscardView();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiscardViewer);
  } else {
    initDiscardViewer();
  }

  return {
    startGame,
    restartGame,
    onStateChange,
    onDrawCard,
    onEndTurn,
    hermioneSkip,
    cancelTargetMode,
    addLogEntry,
    showDiscardView,
    hideDiscardView,
  };
})();
