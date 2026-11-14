import { validateAnimationManifest } from './clipPlayer.js';
import { META } from '../modes/metaProgress.js';
import { VILLAGE_ROOMS } from '../modes/villageRooms.js';

const ORIGINAL = './assets/original';
export const TCG_COMMANDER_ART = `${ORIGINAL}/cutins/tcg_commander.webp`;
export const HERO_ID = 'chr_bunbo_holinh';
export const TRAVEL_HERO = HERO_ID + '_travel';
export const MONSTER_IDS = ['mob_mushroom_01', 'mob_pepper_01'];
export const BOSS_ID = 'boss_bep_truong';
const ADVENTURE_SCENES = ['village', 'forest', 'arena', 'harbor', 'caldera', 'sanctum', ...VILLAGE_ROOMS];
const ENCOUNTER_PROPS = ['boss_stove', 'empty_bowl_seal', 'tidal_conch', 'hollow_cauldron'];
const COMBAT_EFFECTS = ['boss_warning', 'boss_cleave', 'shield_bubble', 'shield_break'];

export const HERO_NAMES = Object.freeze({
  [HERO_ID]: 'Bún Bò Hỏa Linh',
  chr_pho_lamvu: 'Phở Lam Vũ',
  chr_goicuon_diepnhi: 'Gỏi Cuốn Diệp Nhi',
  chr_banhbao_bachngoc: 'Bánh Bao Bạch Ngọc',
  chr_caphe_davu: 'Cà Phê Dạ Vũ',
});

const ACTORS = [...META.characters.map(spirit => spirit.id), 'npc_lilia', ...MONSTER_IDS, BOSS_ID];
const CARD_IDS = new Set([7, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((id) => 'card_demo_' + String(id).padStart(2, '0')));
const PROPS = ['house_kitchen', 'house_guild', 'house_merchant', 'tree', 'chest_closed', 'chest_open', 'portal', 'table', ...ENCOUNTER_PROPS];

export const ELEMENT_ART = Object.freeze({
  fire: { color: '#ffae69', dark: '#70241f' },
  water: { color: '#a5e8ff', dark: '#174d72' },
  wood: { color: '#b9ef8e', dark: '#2e6044' },
  light: { color: '#ffedaa', dark: '#755528' },
  shadow: { color: '#d7b6ff', dark: '#482452' },
});

export function sceneArt(id) { return `${ORIGINAL}/scenes/${id}.webp`; }
export function chapterArt(number) { return `${ORIGINAL}/chronicle/chapter-${number}.webp`; }
export function actorArt(id) { return ACTORS.includes(id) ? `${ORIGINAL}/actors/${id}.webp` : null; }
export function propArt(id) { return `${ORIGINAL}/props/${id}.webp`; }
export function originalCardArt(id) { return CARD_IDS.has(id) ? `${ORIGINAL}/cards/${id}.webp` : null; }
export function cutinArt(id) { return `${ORIGINAL}/cutins/${id}.webp`; }
export function combatArt(id) { return `${ORIGINAL}/effects/${id}.webp`; }
export function effectArt(element, phase) {
  const key = Object.hasOwn(ELEMENT_ART, element) ? element : 'light';
  return `${ORIGINAL}/effects/${key}_${phase}.webp`;
}

export async function preloadGameAssets(renderer) {
  const imagePaths = [
    ...ADVENTURE_SCENES.map(sceneArt),
    ...ACTORS.map(actorArt),
    ...['tcg_table', 'chess_court'].map(sceneArt),
    ...PROPS.map(propArt),
    ...Object.keys(HERO_NAMES).map(cutinArt),
    TCG_COMMANDER_ART,
    ...COMBAT_EFFECTS.map(combatArt),
    ...Object.keys(ELEMENT_ART).flatMap((id) => [effectArt(id, 'trail'), effectArt(id, 'impact')]),
  ];
  const requiredSprites = [TRAVEL_HERO, BOSS_ID, ...Object.keys(HERO_NAMES)];
  const loadSprites = [...requiredSprites, ...MONSTER_IDS].map(async (id) => {
    const path = `${ORIGINAL}/atlases/${id}`;
    const entry = await renderer.loadCharacter(id, path + '.webp', path + '.json');
    const manifest = entry.manifest;
    const frames = new Set(Object.keys(manifest?.frames ?? {}));
    if (entry.loaded && manifest?.character_id === id && manifest.clips?.idle
        && frames.size && validateAnimationManifest(manifest, frames).valid) return [id, manifest];
    renderer.sheets?.delete(id);
    return [id, null];
  });

  const [sprites, images] = await Promise.all([
    Promise.all(loadSprites),
    Promise.all(imagePaths.map(async path => [path, await renderer.loadImage(path)])),
  ]);
  const required = new Set([...ADVENTURE_SCENES.map(sceneArt), ...ENCOUNTER_PROPS.map(propArt)]);
  if (sprites.some(([id, manifest]) => !manifest && requiredSprites.includes(id))
      || images.some(([path, image]) => required.has(path) && !image)) {
    throw new Error('Không tải được bản đồ hoặc hoạt ảnh bắt buộc. Kiểm tra kết nối rồi thử lại.');
  }
  return Object.fromEntries(sprites.filter(([, manifest]) => manifest));
}
