// game.js — Core game engine

const GameEngine = (() => {
  const PHASES = {
    IDLE: 'idle',
    BEFORE_TURN: 'before_turn',
    DRAW: 'draw',
    CREATURE_DAMAGE: 'creature_damage',
    ACTIONS: 'actions',
    END_TURN: 'end_turn',
    GAME_OVER: 'game_over',
  };

  let state = null;
  let onStateChange = null; // callback(state, logEntries)
  let lastNotifiedLogIndex = 0;

  function createPlayer(name, isHuman) {
    return {
      name,
      isHuman,
      characterCard: null,
      deck: [],
      hand: [],
      discard: [],
      lessonsInPlay: [],
      creaturesInPlay: [], // [{card, damageCounters, turnPlayed}]
    };
  }

  async function setupGame(changeCallback) {
    onStateChange = changeCallback;
    lastNotifiedLogIndex = 0;

    await CardManager.loadCards();

    const [hermioneData, dracoData] = await Promise.all([
      CardManager.loadDeck('data/deck_hermione.json'),
      CardManager.loadDeck('data/deck_malfoy.json'),
    ]);

    const player = createPlayer('Hermione', true);
    player.deckName = hermioneData.name;
    const bot = createPlayer('Draco', false);
    bot.deckName = dracoData.name;

    // Place starting characters (resolved from each deck's metadata)
    player.characterCard = CardManager.getCard(hermioneData.startingCharacter);
    bot.characterCard = CardManager.getCard(dracoData.startingCharacter);

    // Preload all card images and cache them before the game starts
    await CardManager.preloadImages([
      player.characterCard, bot.characterCard,
      ...hermioneData.cards, ...dracoData.cards
    ]);

    // Shuffle and assign decks
    player.deck = hermioneData.cards;
    bot.deck = dracoData.cards;
    CardManager.shuffle(player.deck);
    CardManager.shuffle(bot.deck);

    // Draw 7 starting cards
    CardManager.drawCards(player, 7);
    CardManager.drawCards(bot, 7);

    // Pick who goes first randomly
    const playerGoesFirst = Math.random() < 0.5;

    state = {
      player,
      bot,
      currentPlayer: playerGoesFirst ? player : bot,
      turnNumber: 1,
      phase: PHASES.IDLE,
      actionsRemaining: 0,
      waitingForInput: false,
      winner: null,
      log: [],
      pendingEffect: null, // { card, caster, resolveWithTarget }
      hermioneAbilityPending: false,
    };

    addLog(`Game started! ${state.currentPlayer.name} goes first.`, 'system');
    notify();
    return state;
  }

  function addLog(message, type = 'action') {
    const entry = { message, type, timestamp: Date.now() };
    state.log.push(entry);
    return entry;
  }

  function notify() {
    if (!onStateChange) return;
    const newLogs = state.log.slice(lastNotifiedLogIndex);
    lastNotifiedLogIndex = state.log.length;
    onStateChange({ ...state }, newLogs);
  }

  // ─── TURN FLOW ────────────────────────────────────────────────────

  async function startTurn() {
    if (state.winner) return;
    const cur = state.currentPlayer;
    state.phase = PHASES.BEFORE_TURN;
    state.actionsRemaining = 2;
    state.waitingForInput = false;

    addLog(`── Turn ${state.turnNumber} — ${cur.name} ──`, 'phase');
    notify();

    // Phase 1: Before-turn (noop for v1)
    await delay(200);

    // Phase 2: Draw
    state.phase = PHASES.DRAW;
    await phaseDraw(cur);
    if (state.winner) return;
    await delay(400);

    // Phase 3: Creature damage
    state.phase = PHASES.CREATURE_DAMAGE;
    await phaseCreatureDamage(cur);
    if (state.winner) return;
    await delay(400);

    // Phase 4: Actions
    state.phase = PHASES.ACTIONS;
    notify();

    if (cur.isHuman) {
      // Unlock UI for player input — reset any stale ability flags first
      state.hermioneAbilityPending = false;
      state.waitingForInput = true;
      notify();
      // Game pauses here — UI will call playerAction() methods
    } else {
      // Bot plays automatically
      await BotAI.executeBotTurn(state);
      // Bot always calls endTurn() when done
    }
  }

  async function phaseDraw(player) {
    if (player.deck.length === 0) {
      state.winner = player === state.player ? state.bot : state.player;
      state.phase = PHASES.GAME_OVER;
      addLog(`${player.name}'s deck is empty — ${state.winner.name} wins!`, 'system');
      notify();
      return;
    }
    const drawn = CardManager.drawCards(player, 1);
    const card = player.hand[player.hand.length - 1];
    addLog(player.isHuman ? `You draw ${card.name}.` : `${player.name} draws a card.`, 'draw');
    notify();
  }

  async function phaseCreatureDamage(attacker) {
    const defender = attacker === state.player ? state.bot : state.player;
    const activeCreatures = attacker.creaturesInPlay.filter(
      c => c.turnPlayed < state.turnNumber
    );
    if (activeCreatures.length === 0) return;

    for (const creature of activeCreatures) {
      const dmg = creature.card.damage || 0;
      if (dmg === 0) continue;
      const lost = CardManager.dealDamageToPlayer(defender, dmg);
      addLog(`${creature.card.name} deals ${dmg} damage to ${defender.name} (${lost} card(s) discarded).`, 'damage');
      notify();
      if (checkGameOver()) return;
      await delay(300);
    }
  }

  // ─── PLAYER ACTION METHODS ────────────────────────────────────────

  function getPlayableCards(player) {
    return player.hand.filter(card => {
      if (card.type === 'lesson') return true;
      if (card.type === 'spell' || card.type === 'creature') {
        return CardManager.canAfford(card, player);
      }
      return false;
    });
  }

  // Called by UI when player clicks a card in hand
  // Returns { ok, pendingTarget, logs } or { error }
  function playerPlayCard(card) {
    if (!state.waitingForInput) return { error: 'Not your turn.' };
    if (state.actionsRemaining <= 0) return { error: 'No actions remaining.' };

    const player = state.player;

    if (card.type === 'lesson') {
      return playerPlayLesson(card);
    } else if (card.type === 'spell') {
      return playerPlaySpell(card);
    } else if (card.type === 'creature') {
      return playerPlayCreature(card);
    }
    return { error: `Cannot play card type: ${card.type}` };
  }

  function playerPlayLesson(card) {
    const player = state.player;
    // Check BEFORE placing — ability requires already having 2+ lessons in play
    const lessonsBefore = player.lessonsInPlay.length;

    removeFromHand(player, card);
    player.lessonsInPlay.push(card);
    state.actionsRemaining--;

    addLog(`You play ${card.name} (${card.lessonType} lesson).`, 'action');

    // Hermione ability: you must have had 2+ lessons before playing this one
    if (lessonsBefore >= 2) {
      const extraLessons = player.hand.filter(c => c.type === 'lesson');
      if (extraLessons.length > 0) {
        state.hermioneAbilityPending = true;
        notify();
        checkActionsExhausted();
        return { ok: true, hermioneAbility: true, availableLessons: extraLessons };
      }
    }

    notify();
    checkActionsExhausted();
    return { ok: true };
  }

  // Called when player chooses the free Hermione bonus lesson (or skips)
  function playerHermioneBonusLesson(card) {
    state.hermioneAbilityPending = false;
    if (!card) {
      addLog('You skip the Hermione bonus lesson.', 'action');
      notify();
      return { ok: true };
    }
    removeFromHand(state.player, card);
    state.player.lessonsInPlay.push(card);
    addLog(`Hermione ability: You also play ${card.name} for free.`, 'action');
    notify();
    return { ok: true };
  }

  function playerPlaySpell(card) {
    const player = state.player;
    if (!CardManager.canAfford(card, player)) return { error: 'Cannot afford this spell.' };

    const result = CardManager.resolveEffect(card, player, state.bot, state, null);

    if (result.needsTarget) {
      // Pause and wait for target selection from UI
      state.pendingEffect = {
        card,
        resolve: (target) => {
          removeFromHand(player, card);
          player.discard.push(card);
          state.actionsRemaining--;
          const r2 = CardManager.resolveEffect(card, player, state.bot, state, target);
          const msg = `You cast ${card.name}.`;
          addLog(msg, 'action');
          for (const l of r2.logs) addLog(l, 'damage');
          state.pendingEffect = null;
          notify();
          checkActionsExhausted();
        }
      };
      return { ok: true, needsTarget: true, validTargets: result.validTargets };
    }

    // Immediate effect
    removeFromHand(player, card);
    player.discard.push(card);
    state.actionsRemaining--;
    addLog(`You cast ${card.name}.`, 'action');
    for (const l of result.logs) addLog(l, 'damage');
    notify();

    if (checkGameOver()) return { ok: true };
    checkActionsExhausted();
    return { ok: true };
  }

  function playerResolveTarget(target) {
    if (!state.pendingEffect) return { error: 'No pending effect.' };
    state.pendingEffect.resolve(target);
    if (checkGameOver()) return { ok: true };
    return { ok: true };
  }

  function discardLessonFromPlay(player, lessonType) {
    const idx = player.lessonsInPlay.findIndex(l => l.lessonType === lessonType);
    if (idx === -1) return null;
    const [lesson] = player.lessonsInPlay.splice(idx, 1);
    player.discard.push(lesson);
    return lesson;
  }

  function playerPlayCreature(card) {
    const player = state.player;
    if (!CardManager.canAfford(card, player)) return { error: 'Cannot afford this creature.' };

    removeFromHand(player, card);
    player.creaturesInPlay.push({
      card,
      damageCounters: 0,
      turnPlayed: state.turnNumber,
    });
    state.actionsRemaining--;

    if (card.discardLessonTypeOnPlay) {
      const discarded = discardLessonFromPlay(player, card.discardLessonTypeOnPlay);
      if (discarded) addLog(`You discard ${discarded.name} to pay for ${card.name}.`, 'action');
    }

    addLog(`You play ${card.name} (${card.damage} dmg / ${card.health} hp).`, 'action');
    notify();
    checkActionsExhausted();
    return { ok: true };
  }

  function playerDrawCard() {
    if (!state.waitingForInput) return { error: 'Not your turn.' };
    if (state.actionsRemaining <= 0) return { error: 'No actions remaining.' };

    const player = state.player;
    if (player.deck.length === 0) {
      state.winner = state.bot;
      state.phase = PHASES.GAME_OVER;
      addLog(`Your deck is empty — Draco wins!`, 'system');
      notify();
      return { ok: true };
    }

    CardManager.drawCards(player, 1);
    const card = player.hand[player.hand.length - 1];
    state.actionsRemaining--;
    addLog(`You draw ${card.name}.`, 'draw');
    notify();
    checkActionsExhausted();
    return { ok: true };
  }

  function playerEndTurn() {
    if (!state.waitingForInput && state.phase !== PHASES.ACTIONS) {
      return { error: 'Not your turn.' };
    }
    state.waitingForInput = false;
    state.hermioneAbilityPending = false;
    state.pendingEffect = null;
    proceedToEndTurn();
    return { ok: true };
  }

  function checkActionsExhausted() {
    if (state.actionsRemaining <= 0 && state.waitingForInput) {
      state.waitingForInput = false;
      state.hermioneAbilityPending = false;
      setTimeout(() => proceedToEndTurn(), 300);
    }
  }

  function proceedToEndTurn() {
    state.phase = PHASES.END_TURN;
    addLog(`${state.currentPlayer.name} ends their turn.`, 'phase');
    notify();

    // Switch player
    const wasPlayer = state.currentPlayer;
    state.currentPlayer = wasPlayer === state.player ? state.bot : state.player;
    if (state.currentPlayer === state.player) state.turnNumber++;

    setTimeout(() => startTurn(), 600);
  }

  function checkGameOver() {
    if (state.winner) return true;
    // If a deck was wiped to 0 by a damage spell mid-turn, the player with 0 cards loses
    if (state.player.deck.length === 0 && !state.winner) {
      state.winner = state.bot;
      state.phase = PHASES.GAME_OVER;
      addLog(`Your deck is empty — Draco wins!`, 'system');
      notify();
      return true;
    }
    if (state.bot.deck.length === 0 && !state.winner) {
      state.winner = state.player;
      state.phase = PHASES.GAME_OVER;
      addLog(`Draco's deck is empty — you win!`, 'system');
      notify();
      return true;
    }
    return false;
  }

  // ─── BOT ACTION METHODS (called by bot.js) ────────────────────────

  function botPlayLesson(card) {
    const bot = state.bot;
    removeFromHand(bot, card);
    bot.lessonsInPlay.push(card);
    state.actionsRemaining--;
    addLog(`Draco plays ${card.name} (${card.lessonType} lesson).`, 'action');
    notify();
  }

  function botPlaySpell(card) {
    const bot = state.bot;
    removeFromHand(bot, card);
    bot.discard.push(card);
    state.actionsRemaining--;
    // Bot always targets opponent
    const result = CardManager.resolveEffect(card, bot, state.player, state, { type: 'opponent' });
    addLog(`Draco casts ${card.name}.`, 'action');
    for (const l of result.logs) addLog(l, 'damage');
    notify();
    return checkGameOver();
  }

  function botPlayCreature(card) {
    const bot = state.bot;
    removeFromHand(bot, card);
    bot.creaturesInPlay.push({
      card,
      damageCounters: 0,
      turnPlayed: state.turnNumber,
    });
    state.actionsRemaining--;

    if (card.discardLessonTypeOnPlay) {
      const discarded = discardLessonFromPlay(bot, card.discardLessonTypeOnPlay);
      if (discarded) addLog(`Draco discards ${discarded.name} to pay for ${card.name}.`, 'action');
    }

    addLog(`Draco plays ${card.name} (${card.damage} dmg / ${card.health} hp).`, 'action');
    notify();
  }

  function botDrawCard() {
    const bot = state.bot;
    if (bot.deck.length === 0) {
      state.winner = state.player;
      state.phase = PHASES.GAME_OVER;
      addLog(`Draco's deck is empty — you win!`, 'system');
      notify();
      return true;
    }
    CardManager.drawCards(bot, 1);
    const card = bot.hand[bot.hand.length - 1];
    state.actionsRemaining--;
    addLog(`Draco draws a card.`, 'draw');
    notify();
    return false;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────

  function removeFromHand(player, card) {
    const idx = player.hand.indexOf(card);
    if (idx !== -1) player.hand.splice(idx, 1);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getState() {
    return state;
  }

  return {
    PHASES,
    setupGame,
    startTurn,
    getState,
    getPlayableCards,
    playerPlayCard,
    playerHermioneBonusLesson,
    playerResolveTarget,
    playerDrawCard,
    playerEndTurn,
    // Bot-facing methods
    botPlayLesson,
    botPlaySpell,
    botPlayCreature,
    botDrawCard,
    proceedToEndTurn,
    addLog,
    notify,
    delay: (ms) => new Promise(r => setTimeout(r, ms)),
  };
})();
