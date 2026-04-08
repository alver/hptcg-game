// version.js — Game version and localStorage compatibility check
// Bump GAME_VERSION whenever saved data format changes to force a clean reset.

const GAME_VERSION = 1;

(function () {
  const KEY = 'hptcg-deck-choice';
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && (saved.version || 0) < GAME_VERSION) {
      localStorage.removeItem(KEY);
    }
  } catch (_) {
    localStorage.removeItem(KEY);
  }
})();
