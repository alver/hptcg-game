// cards.js — Card loading and effect resolution

const CardManager = (() => {
  let cardDb = {};
  let onMillAnimation = null;

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

  async function loadCards() {
    const res = await fetch('data/cards.json');
    cardDb = await res.json();
    return cardDb;
  }

  async function loadDeck(deckFile) {
    const res = await fetch(deckFile);
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

  // Resolve an effect. Returns { logs: string[], needsTarget, validTargets }
  // needsTarget=true means the UI must ask the player to pick a target before resolving.
  function resolveEffect(card, caster, opponent, gameState, target = null) {
    const code = card.effectCode || 'noop';
    const logs = [];

    // Parse effectCode patterns like damage_opponent_3, draw_2, etc.
    const damageOpponentMatch = code.match(/^damage_opponent_(\d+)$/);
    const drawMatch = code.match(/^draw_(\d+)$/);
    const damageCreatureOrOpponentMatch = code.match(/^damage_creature_or_opponent_(\d+)$/);
    const damageAllCreaturesMatch = code.match(/^damage_all_creatures_(\d+)$/);
    const opponentDiscardHandMatch = code.match(/^opponent_discard_hand_(\d+)$/);
    const returnFromDiscardMatch = code.match(/^return_from_discard_(lesson|creature|spell|any)_(\d+)$/);

    if (code === 'noop' || code === 'creature_standard') {
      // no effect
    } else if (damageOpponentMatch) {
      const amount = parseInt(damageOpponentMatch[1]);
      const lost = dealDamageToPlayer(opponent, amount);
      logs.push(`${opponent.name} discards ${lost} card(s) from deck (${amount} damage).`);
    } else if (drawMatch) {
      const amount = parseInt(drawMatch[1]);
      const drawn = drawCards(caster, amount);
      logs.push(`${caster.name} draws ${drawn} card(s).`);
    } else if (damageCreatureOrOpponentMatch) {
      const amount = parseInt(damageCreatureOrOpponentMatch[1]);
      // If player is caster and no target chosen yet, signal need for target
      if (caster.isHuman && target === null) {
        return {
          logs: [],
          needsTarget: true,
          validTargets: buildTargets(opponent)
        };
      }
      // Bot or target already chosen
      if (target && target.type === 'creature') {
        const dead = dealDamageToCreature(target.creature, opponent, amount);
        logs.push(`${card.name} deals ${amount} damage to ${target.creature.card.name}.`);
        if (dead) logs.push(`${target.creature.card.name} is destroyed!`);
      } else {
        const lost = dealDamageToPlayer(opponent, amount);
        logs.push(`${opponent.name} discards ${lost} card(s) from deck (${amount} damage).`);
      }
    } else if (damageAllCreaturesMatch) {
      const amount = parseInt(damageAllCreaturesMatch[1]);
      // damage all creatures on both sides
      const allCreatures = [
        ...gameState.player.creaturesInPlay.map(c => ({ creature: c, owner: gameState.player })),
        ...gameState.bot.creaturesInPlay.map(c => ({ creature: c, owner: gameState.bot }))
      ];
      for (const { creature, owner } of allCreatures) {
        const dead = dealDamageToCreature(creature, owner, amount);
        logs.push(`${creature.card.name} takes ${amount} damage.`);
        if (dead) logs.push(`${creature.card.name} is destroyed!`);
      }
    } else if (opponentDiscardHandMatch) {
      const amount = parseInt(opponentDiscardHandMatch[1]);
      // bot discards randomly; player discards random for v1 (no choice UI needed)
      const discarded = discardFromHand(opponent, amount);
      logs.push(`${opponent.name} discards ${discarded} card(s) from hand.`);
    } else if (code.startsWith('discard_opponent_lesson_')) {
      const lessonType = code.split('_').pop();
      const idx = opponent.lessonsInPlay.findIndex(l => l.lessonType === lessonType);
      if (idx !== -1) {
        const lesson = opponent.lessonsInPlay.splice(idx, 1)[0];
        opponent.discard.push(lesson);
        logs.push(`${opponent.name}'s ${lesson.name} is discarded.`);
      } else {
        logs.push(`${opponent.name} has no matching lesson in play — no effect.`);
      }
    } else if (returnFromDiscardMatch) {
      const cardType = returnFromDiscardMatch[1]; // lesson | creature | spell | any
      const maxSelect = parseInt(returnFromDiscardMatch[2]);
      const eligibleCards = caster.discard.filter(c =>
        cardType === 'any' ? true : c.type === cardType
      );
      if (caster.isHuman) {
        // Player picks interactively — signal the UI
        return {
          logs: [],
          needsCardSelection: true,
          maxSelect,
          eligibleCards,
          cardTypeLabel: cardType,
        };
      }
      // Bot: auto-pick up to maxSelect (most recently discarded first)
      const toReturn = eligibleCards.slice(-maxSelect);
      for (const c of toReturn) {
        caster.discard.splice(caster.discard.indexOf(c), 1);
        caster.hand.push(c);
      }
      if (toReturn.length > 0) {
        logs.push(`${caster.name} returns ${toReturn.map(c => c.name).join(', ')} to hand.`);
      } else {
        logs.push(`${caster.name} has no matching cards in discard — no effect.`);
      }
    } else if (code === 'discard_opponent_creature') {
      // Caster picks one of opponent's creatures to discard immediately (no damage counters)
      if (caster.isHuman && target === null) {
        if (opponent.creaturesInPlay.length === 0) {
          logs.push('No opponent creatures in play — no effect.');
          return { logs };
        }
        return { logs: [], needsTarget: true, validTargets: opponent.creaturesInPlay.map(c => ({ type: 'creature', creature: c })) };
      }
      let chosen = null;
      if (target && target.type === 'creature') {
        chosen = target.creature;
      } else if (!caster.isHuman) {
        // Bot auto-picks highest-damage player creature
        chosen = opponent.creaturesInPlay.reduce(
          (best, c) => !best || (c.card.damage || 0) >= (best.card.damage || 0) ? c : best, null
        );
      }
      if (chosen) {
        const idx = opponent.creaturesInPlay.indexOf(chosen);
        if (idx !== -1) {
          opponent.creaturesInPlay.splice(idx, 1);
          opponent.discard.push(chosen.card);
          logs.push(`${chosen.card.name} is discarded from play.`);
        }
      } else {
        logs.push('No opponent creatures to discard — no effect.');
      }
    } else if (code === 'opponent_chooses_discard_creature') {
      // Opponent (not the caster) picks one of their own creatures to discard
      if (!caster.isHuman) {
        // Bot casting: player must interactively choose — signal the engine
        if (opponent.creaturesInPlay.length === 0) {
          logs.push('No creatures to discard — no effect.');
          return { logs };
        }
        return { logs: [], needsOpponentCreatureChoice: true };
      }
      // Player casting: bot (opponent) auto-discards its weakest creature
      const chosen = opponent.creaturesInPlay.reduce(
        (weakest, c) => !weakest || (c.card.damage || 0) <= (weakest.card.damage || 0) ? c : weakest, null
      );
      if (chosen) {
        const idx = opponent.creaturesInPlay.indexOf(chosen);
        if (idx !== -1) {
          opponent.creaturesInPlay.splice(idx, 1);
          opponent.discard.push(chosen.card);
          logs.push(`${chosen.card.name} is discarded from play.`);
        }
      } else {
        logs.push('No opponent creatures to discard — no effect.');
      }
    } else if (code === 'hermione_double_lesson' || code === 'draco_hand_disruption') {
      // Character abilities — not resolved as spells
    } else {
      logs.push(`[Unknown effectCode: ${code}]`);
    }

    return { logs, needsTarget: false, validTargets: [] };
  }

  function buildTargets(opponent) {
    const targets = [{ type: 'opponent', label: opponent.name }];
    for (const creature of opponent.creaturesInPlay) {
      targets.push({ type: 'creature', creature, label: creature.card.name });
    }
    return targets;
  }

  // Move up to `amount` cards from player deck to discard, return actual count moved
  function dealDamageToPlayer(player, amount) {
    const actual = Math.min(amount, player.deck.length);
    if (onMillAnimation && actual > 0) onMillAnimation(player, actual);
    for (let i = 0; i < actual; i++) {
      player.discard.push(player.deck.shift());
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
      player.hand.push(player.deck.shift());
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
