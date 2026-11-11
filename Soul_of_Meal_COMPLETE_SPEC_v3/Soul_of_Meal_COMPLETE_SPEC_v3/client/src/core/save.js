import { restoreChapterTwo, restoreForestClues } from '../modes/adventureStory.js';
import { restoreSpiritProgress } from '../modes/spiritProgress.js';

export const SAVE_KEY = 'soul-of-meal.save.v2';
export const SAVE_VERSION = 2;

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    player: { name: 'Người Kết Vị', level: 1, experience: 0, gold: 120, essence: 24 },
    adventure: {
      map: 'village', x: 120, y: 310, quest: 'not_started', chestOpened: false,
      forestCleared: false, forestClues: [], rewardClaims: [], battle: null,
      chapterTwo: { stage: 'not_started', lanterns: 0 },
      spirits: { ownedGear: [], profiles: {} },
    },
    roster: [
      { id: 'chr_bunbo_holinh', hp: 3000, maxHp: 3000, atk: 320, def: 100, element: 'fire', role: 'fighter', energy: 0 },
      { id: 'chr_pho_lamvu', hp: 2200, maxHp: 2200, atk: 390, def: 60, element: 'water', role: 'mage', energy: 0 },
      { id: 'chr_goicuon_diepnhi', hp: 2500, maxHp: 2500, atk: 250, def: 90, element: 'wood', role: 'support', energy: 0 },
      { id: 'chr_banhbao_bachngoc', hp: 3400, maxHp: 3400, atk: 210, def: 150, element: 'light', role: 'guardian', energy: 0 },
      { id: 'chr_caphe_davu', hp: 2000, maxHp: 2000, atk: 430, def: 50, element: 'shadow', role: 'assassin', energy: 0 },
    ],
    completedBattles: 0,
    modes: { tcg: null, chess: null },
    settings: { music: 70, sfx: 80, voice: 80, ambience: 65, reducedMotion: false },
  };
}

export function migrateSave(input) {
  const fresh = createDefaultSave();
  if (!input || typeof input !== 'object') return fresh;
  const adventure = { ...fresh.adventure, ...input.adventure };
  adventure.forestClues = restoreForestClues(adventure);
  adventure.chapterTwo = restoreChapterTwo(adventure);
  if (input.version === SAVE_VERSION) {
    const roster = Array.isArray(input.roster) && input.roster.length ? input.roster : fresh.roster;
    adventure.spirits = restoreSpiritProgress(adventure.spirits, roster);
    return {
      ...fresh,
      ...input,
      player: { ...fresh.player, ...input.player },
      adventure,
      settings: { ...fresh.settings, ...input.settings },
      modes: { ...fresh.modes, ...input.modes },
      roster,
    };
  }
  if (input.version === 1) {
    adventure.spirits = restoreSpiritProgress(null, fresh.roster);
    const migrated = {
      ...fresh,
      player: { ...fresh.player, ...input.player },
      adventure,
      roster: fresh.roster,
      completedBattles: input.completedBattles ?? 0,
    };
    migrated.adventure.x = (input.adventure?.x ?? 0.5) * 960;
    migrated.adventure.y = (input.adventure?.y ?? 0.55) * 540;
    return migrated;
  }
  return fresh;
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY) ?? storage?.getItem('soul-of-meal.save.v1');
    return migrateSave(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn('Unable to read local save; using a fresh profile.', error);
    return createDefaultSave();
  }
}

export function persistSave(save, storage = globalThis.localStorage) {
  if (!storage) return false;
  storage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
  return true;
}
