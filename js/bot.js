// bot.js — Bot AI for Draco

const BotAI = (() => {

  // Main entry: execute bot's full turn (auto-phases already done by game.js startTurn)
  async function executeBotTurn(gameState) {
    const bot = gameState.bot;
    const player = gameState.player;

    // Play up to 2 actions
    for (let action = 0; action < 2; action++) {
      if (gameState.winner) return;
      if (gameState.actionsRemaining <= 0) break;

      await GameEngine.delay(600);

      const decision = decideAction(bot, player, gameState);

      if (decision.type === 'play_lesson') {
        await GameEngine.botPlayLesson(decision.card);
      } else if (decision.type === 'play_spell') {
        const gameOver = await GameEngine.botPlaySpell(decision.card);
        if (gameOver) return;
      } else if (decision.type === 'play_creature') {
        await GameEngine.botPlayCreature(decision.card);
      } else if (decision.type === 'draw_card') {
        const gameOver = GameEngine.botDrawCard();
        if (gameOver) return;
      }
    }

    if (gameState.winner) return;
    await GameEngine.delay(500);
    GameEngine.proceedToEndTurn();
  }

  function decideAction(bot, player, gameState) {
    const hand = bot.hand;

    // Priority 1: Play a lesson (prioritize F, then C)
    const lessons = hand.filter(c => c.type === 'lesson');
    if (lessons.length > 0) {
      // Sort: F first, then C, then others
      const sorted = lessons.slice().sort((a, b) => {
        const order = { F: 0, C: 1, T: 2, P: 3, Q: 4 };
        return (order[a.lessonType] ?? 5) - (order[b.lessonType] ?? 5);
      });
      return { type: 'play_lesson', card: sorted[0] };
    }

    // Priority 2: Most expensive affordable spell (skip creature-targeting spells if player has none)
    const spells = hand
      .filter(c => c.type === 'spell' && CardManager.canAfford(c, bot))
      .filter(c => {
        if (c.effectCode === 'discard_opponent_creature' || c.effectCode === 'opponent_chooses_discard_creature') {
          return player.creaturesInPlay.length > 0;
        }
        return true;
      })
      .sort((a, b) => (b.powerCost || 0) - (a.powerCost || 0));
    if (spells.length > 0) {
      return { type: 'play_spell', card: spells[0] };
    }

    // Priority 3: Most expensive affordable creature
    const creatures = hand
      .filter(c => c.type === 'creature' && CardManager.canAfford(c, bot))
      .sort((a, b) => (b.powerCost || 0) - (a.powerCost || 0));
    if (creatures.length > 0) {
      return { type: 'play_creature', card: creatures[0] };
    }

    // Fallback: draw a card
    return { type: 'draw_card' };
  }

  return { executeBotTurn, decideAction };
})();
