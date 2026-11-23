// Save and load through localStorage: cash, mission progress, settings.
const KEY = 'palmera-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: Math.round(game.player.cash),
      missionIndex: game.mission ? game.mission.index : 0,
      missionDone: game.mission ? game.mission.done : false,
      muted: game.audio.muted,
      earned: game.stats.earned,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable; the game plays on without it.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
