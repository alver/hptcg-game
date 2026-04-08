// version.js — Game version, shared constants, and localStorage compatibility check
// Bump GAME_VERSION whenever saved data format changes to force a clean reset.

const GAME_VERSION = 1;
const STORAGE_KEY = 'hptcg-deck-choice';

(function () {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && (saved.version || 0) < GAME_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
})();
