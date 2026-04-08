// cards.js — Card loading and effect resolution

const CardManager = (() => {
  let cardDb = {};
  let onMillAnimation = null;

  // ─── SHARED HELPERS ────────────────────────────────────────────

  /** True if the card artwork uses landscape orientation (rotated 90° in CSS). */
  function isHorizontal(card) {
    const type = card?.type;
    return type === 'lesson' || type === 'creature' || type === 'character';
  }

  // ─── IMAGE PRELOADING ─────────────────────────────────────────

  // Warm the browser's HTTP cache so card images are ready before first render.
  // In production, serve assets/cards/* with a long-lived Cache-Control header
  // (e.g. `Cache-Control: public, max-age=31536000, immutable`) and the browser
  // will reuse the cached bytes for every subsequent <img> reference.
  async function preloadImages(cards) {
    const uniqueSrcs = [...new Set(cards.map(c => c.image).filter(Boolean))];
    await Promise.all(uniqueSrcs.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = src;
    })));
  }

  // ─── DATA LOADING ──────────────────────────────────────────────

  async function loadCards() {
    const res = await fetch('data/cards.json');
    if (!res.ok) throw new Error(`Failed to load card database: ${res.status} ${res.statusText}`);
    cardDb = await res.json();
    return cardDb;
  }

  async function loadDeck(deckFile) {
    const res = await fetch(deckFile);
    if (!res.ok) throw new Error(`Failed to load deck ${deckFile}: ${res.status} ${res.statusText}`);
    const deckData = await res.json();
    const cards = [];
    for (const entry of deckData.cards) {
      const card = cardDb[entry.id];
      if (!card) throw new Error(`Unknown card id: ${entry.id}`);
      for (let i = 0; i < entry.count; i++) {
        cards.push({ ...card });
      }
    }
    return { name: deckData.name, startingCharacter: deckData.startingCharacter, cards };
  }

  function getCard(id) {
    return cardDb[id] || null;
  }

  // ─── POWER / AFFORDABILITY ─────────────────────────────────────

  // Returns { total, byType } where byType = { C, T, F, P, Q }
  function getPlayerPower(player) {
    const byType = { C: 0, T: 0, F: 0, P: 0, Q: 0 };
    for (const lesson of player.lessonsInPlay) {
      if (lesson.lessonType && byType[lesson.lessonType] !== undefined) {
        byType[lesson.lessonType]++;
      }
    }
    const total = Object.values(byType).reduce((a, b) => a + b, 0);
    return { total, byType };
  }

  function canAfford(card, player) {
    if (!card.powerCost) return true; // free card
    const power = getPlayerPower(player);
    if (power.total < card.powerCost) return false;
    if (card.lessonCostType && power.byType[card.lessonCostType] < 1) return false;
    return true;
  }

  // ─── EFFECT HANDLER REGISTRY ──────────────────────────────────

  /**
   * Each handler receives (ctx, amount?) and returns { logs, needsTarget?, validTargets?, ... }
   * ctx = { card, caster, opponent, state, target }
   */
  const EFFECT_HANDLERS = {};

  function registerEffect(pattern, handler) {
    EFFECT_HANDLERS[pattern] = handler;
  }

  // damage_opponent_N — opponent discards N cards from deck
  registerEffect('damage_opponent', (ctx, amount) => {
    const logs = [];
    const lost = dealDamageToPlayer(ctx.opponent, amount);
    logs.push(`${ctx.opponent.name} discards ${lost} card(s) from deck (${amount} damage).`);
    return { logs };
  });

  // draw_N — caster draws N cards
  registerEffect('draw', (ctx, amount) => {
    const logs = [];
    const drawn = drawCards(ctx.caster, amount);
    logs.push(`${ctx.caster.name} draws ${drawn} card(s).`);
    return { logs };
  });

  // damage_creature_or_opponent_N — deal N damage to chosen target
  registerEffect('damage_creature_or_opponent', (ctx, amount) => {
    const logs = [];
    if (ctx.caster.isHuman && ctx.target === null) {
      return { logs: [], needsTarget: true, validTargets: buildTargets(ctx.opponent) };
    }
    if (ctx.target && ctx.target.type === 'creature') {
      const dead = dealDamageToCreature(ctx.target.creature, ctx.opponent, amount);
      logs.push(`${ctx.card.name} deals ${amount} damage to ${ctx.target.creature.card.name}.`);
      if (dead) logs.push(`${ctx.target.creature.card.name} is destroyed!`);
    } else {
      const lost = dealDamageToPlayer(ctx.opponent, amount);
      logs.push(`${ctx.opponent.name} discards ${lost} card(s) from deck (${amount} damage).`);
    }
    return { logs };
  });

  // damage_all_creatures_N — deal N to every creature in play
  registerEffect('damage_all_creatures', (ctx, amount) => {
    const logs = [];
    const allCreatures = [
      ...ctx.state.player.creaturesInPlay.map(c => ({ creature: c, owner: ctx.state.player })),
      ...ctx.state.bot.creaturesInPlay.map(c => ({ creature: c, owner: ctx.state.bot }))
    ];
    for (const { creature, owner } of allCreatures) {
      const dead = dealDamageToCreature(creature, owner, amount);
      logs.push(`${creature.card.name} takes ${amount} damage.`);
      if (dead) logs.push(`${creature.card.name} is destroyed!`);
    }
    return { logs };
  });

  // opponent_discard_hand_N — opponent discards N random cards from hand
  registerEffect('opponent_discard_hand', (ctx, amount) => {
    const logs = [];
    const discarded = discardFromHand(ctx.opponent, amount);
    logs.push(`${ctx.opponent.name} discards ${discarded} card(s) from hand.`);
    return { logs };
  });

  // return_from_discard_TYPE_N — return up to N cards of TYPE from discard to hand
  registerEffect('return_from_discard', (ctx, _amount, cardType, maxSelect) => {
    const eligibleCards = ctx.caster.discard.filter(c =>
      cardType === 'any' ? true : c.type === cardType
    );
    if (ctx.caster.isHuman) {
      return { logs: [], needsCardSelection: true, maxSelect, eligibleCards, cardTypeLabel: cardType };
    }
    // Bot: auto-pick up to maxSelect (most recently discarded first)
    const toReturn = eligibleCards.slice(-maxSelect);
    const logs = [];
    for (const c of toReturn) {
      ctx.caster.discard.splice(ctx.caster.discard.indexOf(c), 1);
      ctx.caster.hand.push(c);
    }
    if (toReturn.length > 0) {
      logs.push(`${ctx.caster.name} returns ${toReturn.map(c => c.name).join(', ')} to hand.`);
    } else {
      logs.push(`${ctx.caster.name} has no matching cards in discard — no effect.`);
    }
    return { logs };
  });

  // discard_opponent_lesson_X — discard one opponent lesson of type X
  registerEffect('discard_opponent_lesson', (ctx, _amount, lessonType) => {
    const logs = [];
    const idx = ctx.opponent.lessonsInPlay.findIndex(l => l.lessonType === lessonType);
    if (idx !== -1) {
      const lesson = ctx.opponent.lessonsInPlay.splice(idx, 1)[0];
      ctx.opponent.discard.push(lesson);
      logs.push(`${ctx.opponent.name}'s ${lesson.name} is discarded.`);
    } else {
      logs.push(`${ctx.opponent.name} has no matching lesson in play — no effect.`);
    }
    return { logs };
  });

  // discard_opponent_creature — caster picks one of opponent's creatures
  registerEffect('discard_opponent_creature', (ctx) => {
    const logs = [];
    if (ctx.caster.isHuman && ctx.target === null) {
      if (ctx.opponent.creaturesInPlay.length === 0) {
        return { logs: ['No opponent creatures in play — no effect.'] };
      }
      return { logs: [], needsTarget: true, validTargets: ctx.opponent.creaturesInPlay.map(c => ({ type: 'creature', creature: c })) };
    }
    let chosen = null;
    if (ctx.target && ctx.target.type === 'creature') {
      chosen = ctx.target.creature;
    } else if (!ctx.caster.isHuman) {
      chosen = ctx.opponent.creaturesInPlay.reduce(
        (best, c) => !best || (c.card.damage || 0) >= (best.card.damage || 0) ? c : best, null
      );
    }
    if (chosen) {
      const idx = ctx.opponent.creaturesInPlay.indexOf(chosen);
      if (idx !== -1) {
        ctx.opponent.creaturesInPlay.splice(idx, 1);
        ctx.opponent.discard.push(chosen.card);
        logs.push(`${chosen.card.name} is discarded from play.`);
      }
    } else {
      logs.push('No opponent creatures to discard — no effect.');
    }
    return { logs };
  });

  // opponent_chooses_discard_creature — opponent picks their own creature
  registerEffect('opponent_chooses_discard_creature', (ctx) => {
    const logs = [];
    if (!ctx.caster.isHuman) {
      // Bot casting: player must interactively choose
      if (ctx.opponent.creaturesInPlay.length === 0) {
        return { logs: ['No creatures to discard — no effect.'] };
      }
      return { logs: [], needsOpponentCreatureChoice: true };
    }
    // Player casting: bot auto-discards its weakest creature
    const chosen = ctx.opponent.creaturesInPlay.reduce(
      (weakest, c) => !weakest || (c.card.damage || 0) <= (weakest.card.damage || 0) ? c : weakest, null
    );
    if (chosen) {
      const idx = ctx.opponent.creaturesInPlay.indexOf(chosen);
      if (idx !== -1) {
        ctx.opponent.creaturesInPlay.splice(idx, 1);
        ctx.opponent.discard.push(chosen.card);
        logs.push(`${chosen.card.name} is discarded from play.`);
      }
    } else {
      logs.push('No opponent creatures to discard — no effect.');
    }
    return { logs };
  });

  // ─── EFFECT RESOLUTION (DISPATCHER) ────────────────────────────

  function resolveEffect(card, caster, opponent, gameState, target = null) {
    const code = card.effectCode || 'noop';
    const ctx = { card, caster, opponent, state: gameState, target };

    if (code === 'noop' || code === 'creature_standard') {
      return { logs: [], needsTarget: false, validTargets: [] };
    }

    // Character abilities — not resolved as spells
    if (code === 'hermione_double_lesson' || code === 'draco_hand_disruption') {
      return { logs: [], needsTarget: false, validTargets: [] };
    }

    // Try return_from_discard_TYPE_N (special: two trailing segments)
    const returnMatch = code.match(/^return_from_discard_(lesson|creature|spell|any)_(\d+)$/);
    if (returnMatch) {
      return EFFECT_HANDLERS['return_from_discard'](ctx, null, returnMatch[1], parseInt(returnMatch[2]));
    }

    // Try discard_opponent_lesson_X (trailing segment is lesson type letter)
    const lessonDiscardMatch = code.match(/^discard_opponent_lesson_([A-Z])$/);
    if (lessonDiscardMatch) {
      return EFFECT_HANDLERS['discard_opponent_lesson'](ctx, null, lessonDiscardMatch[1]);
    }

    // Try handlers with trailing numeric amount: handler_name_N
    const numericMatch = code.match(/^(.+?)_(\d+)$/);
    if (numericMatch && EFFECT_HANDLERS[numericMatch[1]]) {
      return EFFECT_HANDLERS[numericMatch[1]](ctx, parseInt(numericMatch[2]));
    }

    // Try exact-match handlers (no numeric suffix)
    if (EFFECT_HANDLERS[code]) {
      return EFFECT_HANDLERS[code](ctx);
    }

    return { logs: [`[Unknown effectCode: ${code}]`], needsTarget: false, validTargets: [] };
  }

  // ─── TARGET BUILDER ─────────────────────────────────────────────

  function buildTargets(opponent) {
    const targets = [{ type: 'opponent', label: opponent.name }];
    for (const creature of opponent.creaturesInPlay) {
      targets.push({ type: 'creature', creature, label: creature.card.name });
    }
    return targets;
  }

  // ─── GAME ACTIONS ──────────────────────────────────────────────

  // Move up to `amount` cards from player deck to discard, return actual count moved
  function dealDamageToPlayer(player, amount) {
    const actual = Math.min(amount, player.deck.length);
    if (onMillAnimation && actual > 0) onMillAnimation(player, actual);
    for (let i = 0; i < actual; i++) {
      player.discard.push(player.deck.pop());
    }
    return actual;
  }

  // Deal damage to a creature, return true if destroyed
  function dealDamageToCreature(creatureInPlay, owner, amount) {
    creatureInPlay.damageCounters += amount;
    if (creatureInPlay.damageCounters >= creatureInPlay.card.health) {
      const idx = owner.creaturesInPlay.indexOf(creatureInPlay);
      if (idx !== -1) {
        owner.creaturesInPlay.splice(idx, 1);
        owner.discard.push(creatureInPlay.card);
      }
      return true;
    }
    return false;
  }

  // Draw up to `amount` cards, return actual count drawn
  function drawCards(player, amount) {
    const actual = Math.min(amount, player.deck.length);
    for (let i = 0; i < actual; i++) {
      player.hand.push(player.deck.pop());
    }
    return actual;
  }

  // Discard `amount` random cards from hand, return count discarded
  function discardFromHand(player, amount) {
    const actual = Math.min(amount, player.hand.length);
    for (let i = 0; i < actual; i++) {
      const idx = Math.floor(Math.random() * player.hand.length);
      const [card] = player.hand.splice(idx, 1);
      player.discard.push(card);
    }
    return actual;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  return {
    loadCards,
    loadDeck,
    getCard,
    isHorizontal,
    preloadImages,
    canAfford,
    resolveEffect,
    getPlayerPower,
    dealDamageToPlayer,
    dealDamageToCreature,
    drawCards,
    shuffle,
    setMillAnimation: (fn) => { onMillAnimation = fn; },
  };
})();
