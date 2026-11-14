import { restoreChapterThree, restoreChapterTwo, restoreForestClues } from '../modes/adventureStory.js';
import { restoreFinale } from '../modes/adventureFinale.js';
import { restoreSpiritProgress } from '../modes/spiritProgress.js';
import { restoreChallengeRecords } from '../modes/adventureChallenges.js';
import { newMeta, restoreMeta, spiritMember, SPIRITS, MAX_PARTY } from '../modes/metaProgress.js';
import { restoreInventory } from '../modes/adventureStore.js';
import { VILLAGE_ROOMS } from '../modes/villageRooms.js';

export const SAVE_KEY = 'soul-of-meal.save.v2';
export const SAVE_VERSION = 2;

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    meta: newMeta(),
    player: { name: 'Người Kết Vị', level: 1, experience: 0, gold: 120, essence: 24 },
    adventure: {
      map: 'village', x: 120, y: 310, quest: 'not_started', chestOpened: false,
      forestCleared: false, forestClues: [], rewardClaims: [], challengeRecords: {}, battle: null,
      chapterTwo: { stage: 'not_started', lanterns: 0 },
      chapterThree: { stage: 'not_started', clues: [] },
      finale: restoreFinale({ chapterThree: { stage: 'not_started' } }),
      spirits: { ownedGear: [], profiles: {} },
      inventory: { stacks: {}, gear: {}, revision: 0 },
    },
    roster: ['chr_bunbo_holinh', 'chr_pho_lamvu', 'chr_goicuon_diepnhi', 'chr_banhbao_bachngoc', 'chr_caphe_davu'].map(spiritMember),
    completedBattles: 0,
    modes: { tcg: null, chess: null },
    settings: { music: 70, sfx: 80, voice: 80, homeCompanion: null, effectsLimited: false, ambience: 65, reducedMotion: false, reducedSummonMotion: false, autoAdventureUltimate: false },
  };
}

export function migrateSave(input) {
  const fresh = createDefaultSave();
  if (!input || typeof input !== 'object') return fresh;
  const adventure = { ...fresh.adventure, ...input.adventure };
  adventure.forestClues = restoreForestClues(adventure);
  adventure.chapterTwo = restoreChapterTwo(adventure);
  adventure.chapterThree = restoreChapterThree(adventure);
  adventure.finale = restoreFinale(adventure);
  adventure.challengeRecords = restoreChallengeRecords(adventure.challengeRecords);
  adventure.inventory = restoreInventory(adventure.inventory);
  const mapAllowed = {
    village: true,
    forest: true,
    orchard: adventure.chestOpened === true,
    spice_garden: adventure.chestOpened === true,
    harbor: adventure.chapterTwo.stage === 'completed',
    caldera: adventure.chapterThree.stage === 'completed',
    sanctum: adventure.finale[4].stage === 'completed',
    ...Object.fromEntries(VILLAGE_ROOMS.map(key => [key, true])),
  };
  if (!Object.hasOwn(mapAllowed, adventure.map) || !mapAllowed[adventure.map]) {
    Object.assign(adventure, { map: fresh.adventure.map, x: fresh.adventure.x, y: fresh.adventure.y });
  }
  if (input.version === SAVE_VERSION) {
    const roster = Array.isArray(input.roster) && input.roster.length ? input.roster : fresh.roster;
    const meta = restoreMeta(input.meta, !Object.hasOwn(input, 'meta'), input.player?.name);
    const ownedIds = new Set(roster.map(member => member.id));
    for (const item of Object.values(adventure.inventory.gear)) {
      if (!ownedIds.has(item.owner)) item.owner = null;
    }
    if (Array.isArray(adventure.party)) {
      const owned = new Set(roster.filter(member => Object.hasOwn(SPIRITS, member.id)).map(member => member.id));
      adventure.party = [...new Set(adventure.party)].filter(id => owned.has(id)).slice(0, MAX_PARTY);
      if (!adventure.party.length) delete adventure.party;
    } else delete adventure.party;
    adventure.spirits = restoreSpiritProgress(adventure.spirits, roster);
    return {
      ...fresh,
      ...input,
      meta,
      player: { ...fresh.player, ...input.player, name: meta.profile?.name ?? input.player?.name ?? fresh.player.name },
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
      meta: restoreMeta(null, true, input.player?.name),
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
