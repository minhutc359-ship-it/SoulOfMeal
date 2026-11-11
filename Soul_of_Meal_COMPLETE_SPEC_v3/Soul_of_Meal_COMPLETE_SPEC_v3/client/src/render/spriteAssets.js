/**
 * Danh mục tải toàn bộ assets cho game Soul of Meal
 */

export const CINEMATIC = './assets/cinematic/';
export const GOLDEN_HERO = 'chr_bunbo_holinh';
export const BATTLE_HERO = 'chr_bunbo_holinh_battle';

export const ASSET_PATHS = Object.freeze({
  sprites: './assets/sprites',
  icons: './assets/sprites/icons',
  maps: './assets/sprites/maps',
  ui: './assets/sprites/ui',
  effects: './assets/sprites/effects',
  cards: './assets/cards',
  portraits: './assets/portraits',
  avatars: './assets/avatars',
});

export const CHARACTERS = Object.freeze([
  'chr_bunbo_holinh',
  'chr_pho_lamvu',
  'chr_goicuon_diepnhi',
  'chr_banhbao_bachngoc',
  'chr_caphe_davu',
  'boss_thief',
]);

export async function preloadGameAssets(renderer) {
  const promises = [];
  const manifests = {};

  for (const charId of CHARACTERS) {
    const path = charId === GOLDEN_HERO ? './assets/golden/bunbo' : `${ASSET_PATHS.sprites}/${charId}`;
    const image = charId === GOLDEN_HERO ? path + '.webp' : path + '.png';
    const manifest = charId === GOLDEN_HERO ? path + '.json' : path + '.manifest.json';
    promises.push(renderer.loadCharacter(charId, image, manifest).then((entry) => {
      if (entry.loaded && entry.manifest) manifests[charId] = entry.manifest;
    }));
  }
  promises.push(renderer.loadCharacter(BATTLE_HERO, './assets/golden/bunbo_battle.webp', './assets/golden/bunbo_battle.json').then((entry) => {
    if (entry.loaded && entry.manifest) manifests[BATTLE_HERO] = entry.manifest;
  }));
  promises.push(renderer.loadCharacter('vfx_fire', './assets/golden/fire.webp', './assets/golden/fire.json'));
  for (const id of ['village', 'arena', 'cutin', 'mushroom', 'pepper']) {
    promises.push(renderer.loadImage(CINEMATIC + id + '.webp'));
  }

  // 2. Tải map tiles và objects
  const mapAssets = [
    'tile_grass_light', 'tile_grass_dark', 'tile_path', 'tile_water',
    'tree_01', 'tree_02', 'house_kitchen', 'house_guild', 'house_merchant',
    'chest_closed', 'chest_open', 'portal'
  ];
  for (const asset of mapAssets) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.maps}/${asset}.png`));
  }

  for (const asset of ['hit_spark', 'fire_burst', 'water_splash', 'leaf_swirl', 'light_flash', 'shadow_fade', 'heal_glow']) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.effects}/${asset}.png`));
  }
  promises.push(renderer.loadImage(ASSET_PATHS.avatars + '/avatar_lilia.png'));

  await Promise.allSettled(promises);
  return manifests;
}
