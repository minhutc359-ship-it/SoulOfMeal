const ORIGINAL = './assets/original';
export const HERO_ID = 'chr_bunbo_holinh';
export const TRAVEL_HERO = HERO_ID + '_travel';
export const BOSS_ID = 'boss_bep_truong';
const COMBAT_EFFECTS = ['boss_warning', 'boss_cleave', 'shield_bubble', 'shield_break'];

export const HERO_NAMES = Object.freeze({
  [HERO_ID]: 'Bún Bò Hỏa Linh',
  chr_pho_lamvu: 'Phở Lam Vũ',
  chr_goicuon_diepnhi: 'Gỏi Cuốn Diệp Nhi',
  chr_banhbao_bachngoc: 'Bánh Bao Bạch Ngọc',
  chr_caphe_davu: 'Cà Phê Dạ Vũ',
});

const ACTORS = [...Object.keys(HERO_NAMES), 'npc_lilia', 'mob_mushroom_01', 'mob_pepper_01', BOSS_ID];
const CARD_IDS = new Set([7, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((id) => 'card_demo_' + String(id).padStart(2, '0')));
const PROPS = ['house_kitchen', 'house_guild', 'house_merchant', 'tree', 'chest_closed', 'chest_open', 'portal', 'table'];

export const ELEMENT_ART = Object.freeze({
  fire: { color: '#ffae69', dark: '#70241f' },
  water: { color: '#a5e8ff', dark: '#174d72' },
  wood: { color: '#b9ef8e', dark: '#2e6044' },
  light: { color: '#ffedaa', dark: '#755528' },
  shadow: { color: '#d7b6ff', dark: '#482452' },
});

export function sceneArt(id) { return `${ORIGINAL}/scenes/${id}.webp`; }
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
    ...['village', 'forest', 'arena'].map(sceneArt),
    ...ACTORS.map(actorArt),
    ...PROPS.map(propArt),
    ...Object.keys(HERO_NAMES).map(cutinArt),
    ...COMBAT_EFFECTS.map(combatArt),
    ...Object.keys(ELEMENT_ART).flatMap((id) => [effectArt(id, 'trail'), effectArt(id, 'impact')]),
  ];
  const loadSprites = [TRAVEL_HERO, BOSS_ID, ...Object.keys(HERO_NAMES)].map(async (id) => {
    const path = `${ORIGINAL}/atlases/${id}`;
    const entry = await renderer.loadCharacter(id, path + '.webp', path + '.json');
    return [id, entry.loaded ? entry.manifest : null];
  });

  const [sprites] = await Promise.all([
    Promise.all(loadSprites),
    Promise.all(imagePaths.map((path) => renderer.loadImage(path))),
  ]);
  return Object.fromEntries(sprites.filter(([, manifest]) => manifest));
}
