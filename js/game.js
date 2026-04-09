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
  let onCardPlayAnimation = null; // async (card, side, type) hook for UI animations
  let onCardDrawAnimation = null; // (card, side) hook for draw animations (fire-and-forget)

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
      initialDeckSize: 0,
    };
  }

  async function setupGame(changeCallback, playerDeckFile, botDeckFile) {
    onStateChange = changeCallback;
    lastNotifiedLogIndex = 0;

    await CardManager.loadCards();

    const [playerDeckData, botDeckData] = await Promise.all([
      CardManager.loadDeck(playerDeckFile),
      CardManager.loadDeck(botDeckFile),
    ]);

    // Resolve starting character cards first so we can derive display names
    const playerCharCard = CardManager.getCard(playerDeckData.startingCharacter);
    const botCharCard = CardManager.getCard(botDeckData.startingCharacter);

    const player = createPlayer(playerCharCard ? playerCharCard.name : 'Player', true);
    player.deckName = playerDeckData.name;
    const bot = createPlayer(botCharCard ? botCharCard.name : 'Bot', false);
    bot.deckName = botDeckData.name;

    player.characterCard = playerCharCard;
    bot.characterCard = botCharCard;

    // Preload all card images and cache them before the game starts
    await CardManager.preloadImages([
      player.characterCard, bot.characterCard,
      ...playerDeckData.cards, ...botDeckData.cards
    ]);

    // Shuffle and assign decks
    player.deck = playerDeckData.cards;
    bot.deck = botDeckData.cards;
    CardManager.shuffle(player.deck);
    CardManager.shuffle(bot.deck);

    // Store initial deck sizes for health-bar calculations
    player.initialDeckSize = player.deck.length;
    bot.initialDeckSize = bot.deck.length;

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

  // ─── HELPERS ─────────────────────────────────────────────────────

  function removeFromHand(player, card) {
    const idx = player.hand.indexOf(card);
    if (idx !== -1) player.hand.splice(idx, 1);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Formatted subject for log messages: "You" for human, name for bot. */
  function who(player) {
    return player.isHuman ? 'You' : player.name;
  }

  /** Formatted verb: "You play" vs "Bot plays". */
  function whoVerb(player, verb) {
    return player.isHuman ? `You ${verb}` : `${player.name} ${verb}s`;
  }

  // ─── GAME-OVER CHECK (single source of truth) ──────────────────

  function checkGameOver() {
    if (state.winner) return true;
    if (state.player.deck.length === 0) {
      state.winner = state.bot;
      state.phase = PHASES.GAME_OVER;
      addLog(`Your deck is empty — ${state.bot.name} wins!`, 'system');
      notify();
      return true;
    }
    if (state.bot.deck.length === 0) {
      state.winner = state.player;
      state.phase = PHASES.GAME_OVER;
      addLog(`${state.bot.name}'s deck is empty — you win!`, 'system');
      notify();
      return true;
    }
    return false;
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
    if (checkGameOver()) return;
    const drawn = CardManager.drawCards(player, 1);
    if (drawn === 0) {
      // drawCards returned 0 because deck was empty; checkGameOver will catch it
      checkGameOver();
      return;
    }
    const card = player.hand[player.hand.length - 1];
    addLog(player.isHuman ? `You draw ${card.name}.` : `${player.name} draws a card.`, 'draw');
    if (onCardDrawAnimation) onCardDrawAnimation(card, player === state.player ? 'player' : 'bot');
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

  // ─── UNIFIED ACTION METHODS ────────────────────────────────────

  function discardLessonFromPlay(player, lessonType) {
    const idx = player.lessonsInPlay.findIndex(l => l.lessonType === lessonType);
    if (idx === -1) return null;
    const [lesson] = player.lessonsInPlay.splice(idx, 1);
    player.discard.push(lesson);
    return lesson;
  }

  /**
   * Play a lesson card for any player. Returns { lessonsBefore }.
   * Caller must handle Hermione ability check and actions-exhausted check.
   */
  function playLesson(player, card) {
    const lessonsBefore = player.lessonsInPlay.length;
    removeFromHand(player, card);
    player.lessonsInPlay.push(card);
    state.actionsRemaining--;
    addLog(`${whoVerb(player, 'play')} ${card.name} (${card.lessonType} lesson).`, 'action');
    return { lessonsBefore };
  }

  /**
   * Play a creature card for any player.
   */
  function playCreature(player, card) {
    removeFromHand(player, card);
    player.creaturesInPlay.push({
      card,
      damageCounters: 0,
      turnPlayed: state.turnNumber,
    });
    state.actionsRemaining--;

    if (card.discardLessonTypeOnPlay) {
      const discarded = discardLessonFromPlay(player, card.discardLessonTypeOnPlay);
      if (discarded) addLog(`${who(player)} discard${player.isHuman ? '' : 's'} ${discarded.name} to pay for ${card.name}.`, 'action');
    }

    addLog(`${whoVerb(player, 'play')} ${card.name} (${card.damage} dmg / ${card.health} hp).`, 'action');
  }

  /**
   * Draw a card for any player. Returns true if game over.
   */
  function drawCard(player) {
    if (checkGameOver()) return true;
    CardManager.drawCards(player, 1);
    if (player.deck.length === 0 && player.hand.length === 0) {
      // Edge case: tried to draw from empty deck
      return checkGameOver();
    }
    const card = player.hand[player.hand.length - 1];
    state.actionsRemaining--;
    const side = player === state.player ? 'player' : 'bot';
    addLog(player.isHuman ? `You draw ${card.name}.` : `${player.name} draws a card.`, 'draw');
    if (onCardDrawAnimation) onCardDrawAnimation(card, side);
    notify();
    return false;
  }

  // ─── PLAYER-FACING METHODS (called by UI) ──────────────────────

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
    const { lessonsBefore } = playLesson(state.player, card);

    // Hermione ability: only if this player's character has the ability,
    // and they had 2+ lessons before playing this one
    const hasHermioneAbility = state.player.characterCard?.effectCode === 'hermione_double_lesson';
    if (hasHermioneAbility && lessonsBefore >= 2) {
      const extraLessons = state.player.hand.filter(c => c.type === 'lesson');
      if (extraLessons.length > 0) {
        state.hermioneAbilityPending = true;
        notify();
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
    } else {
      removeFromHand(state.player, card);
      state.player.lessonsInPlay.push(card);
      addLog(`Hermione ability: You also play ${card.name} for free.`, 'action');
    }
    notify();
    checkActionsExhausted();
    return { ok: true };
  }

  function playerPlaySpell(card) {
    const player = state.player;
    if (!CardManager.canAfford(card, player)) return { error: 'Cannot afford this spell.' };

    const result = CardManager.resolveEffect(card, player, state.bot, state, null);

    if (result.needsTarget) {
      // Pause and wait for target selection from UI
      // Note: card is NOT removed from hand yet — only consumed when target is chosen.
      // If the player cancels, the card stays in hand and no action is spent.
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

    if (result.needsCardSelection) {
      // Pause and wait for card selection from UI (Accio, Hagrid, etc.)
      // Note: card is NOT removed from hand yet — only consumed when selection is confirmed.
      state.pendingEffect = {
        card,
        resolveCardSelection: (selectedCards) => {
          removeFromHand(player, card);
          player.discard.push(card);
          state.actionsRemaining--;
          addLog(`You cast ${card.name}.`, 'action');
          for (const c of selectedCards) {
            const idx = player.discard.indexOf(c);
            if (idx !== -1) player.discard.splice(idx, 1);
            player.hand.push(c);
          }
          if (selectedCards.length > 0) {
            addLog(`You return ${selectedCards.map(c => c.name).join(', ')} to your hand.`, 'action');
          } else {
            addLog('No cards returned.', 'action');
          }
          state.pendingEffect = null;
          notify();
          checkActionsExhausted();
        }
      };
      return {
        ok: true,
        needsCardSelection: true,
        eligibleCards: result.eligibleCards,
        maxSelect: result.maxSelect,
        cardTypeLabel: result.cardTypeLabel,
      };
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

  function playerResolveCardSelection(selectedCards) {
    if (!state.pendingEffect || !state.pendingEffect.resolveCardSelection) return { error: 'No pending card selection.' };
    state.pendingEffect.resolveCardSelection(selectedCards);
    if (checkGameOver()) return { ok: true };
    return { ok: true };
  }

  function playerPlayCreature(card) {
    if (!CardManager.canAfford(card, state.player)) return { error: 'Cannot afford this creature.' };
    playCreature(state.player, card);
    notify();
    checkActionsExhausted();
    return { ok: true };
  }

  function playerDrawCard() {
    if (!state.waitingForInput) return { error: 'Not your turn.' };
    if (state.actionsRemaining <= 0) return { error: 'No actions remaining.' };
    const gameOver = drawCard(state.player);
    if (gameOver) return { ok: true };
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
    if (state.actionsRemaining <= 0 && state.waitingForInput && !state.hermioneAbilityPending) {
      state.waitingForInput = false;
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

  // ─── BOT-FACING METHODS (called by bot.js) ────────────────────

  async function botPlayLesson(card) {
    if (onCardPlayAnimation) await onCardPlayAnimation(card, 'bot', 'lesson');
    playLesson(state.bot, card);
    notify();
  }

  async function botPlaySpell(card) {
    const bot = state.bot;
    removeFromHand(bot, card);
    bot.discard.push(card);
    state.actionsRemaining--;
    const result = CardManager.resolveEffect(card, bot, state.player, state, { type: 'opponent' });
    addLog(`${bot.name} casts ${card.name}.`, 'action');

    if (result.needsOpponentCreatureChoice) {
      // Player (opponent) must pick one of their own creatures to discard
      return new Promise(resolve => {
        state.pendingOpponentCreatureChoice = {
          resolve: (creature) => {
            if (creature) {
              const idx = state.player.creaturesInPlay.indexOf(creature);
              if (idx !== -1) {
                state.player.creaturesInPlay.splice(idx, 1);
                state.player.discard.push(creature.card);
                addLog(`You discard ${creature.card.name}.`, 'damage');
              }
            }
            state.pendingOpponentCreatureChoice = null;
            state.waitingForInput = false;
            notify();
            resolve(checkGameOver());
          }
        };
        state.waitingForInput = true;
        notify();
      });
    }

    for (const l of result.logs) addLog(l, 'damage');
    notify();
    return checkGameOver();
  }

  function playerResolveTakeRoot(creature) {
    if (!state.pendingOpponentCreatureChoice) return { error: 'No pending creature choice.' };
    state.pendingOpponentCreatureChoice.resolve(creature);
    return { ok: true };
  }

  async function botPlayCreature(card) {
    if (onCardPlayAnimation) await onCardPlayAnimation(card, 'bot', 'creature');
    playCreature(state.bot, card);
    notify();
  }

  function botDrawCard() {
    return drawCard(state.bot);
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────

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
    playerResolveCardSelection,
    playerResolveTakeRoot,
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
    delay,
    setCardPlayAnimation: (fn) => { onCardPlayAnimation = fn; },
    setCardDrawAnimation: (fn) => { onCardDrawAnimation = fn; },
  };
})();
