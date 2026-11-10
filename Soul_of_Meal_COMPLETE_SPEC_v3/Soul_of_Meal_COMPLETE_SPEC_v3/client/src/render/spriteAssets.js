/**
 * Danh mục tải toàn bộ assets cho game Soul of Meal
 */

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

  // 1. Tải sprite sheets nhân vật
  for (const charId of CHARACTERS) {
    promises.push(
      renderer.loadCharacter(
        charId,
        `${ASSET_PATHS.sprites}/${charId}.png`,
        `${ASSET_PATHS.sprites}/${charId}.manifest.json`
      )
    );
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

  // 3. Tải element icons
  const elements = ['fire', 'water', 'wood', 'light', 'shadow'];
  for (const el of elements) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.icons}/icon_${el}.png`));
  }

  // 4. Tải UI frames & badges
  const uiAssets = [
    'logo_mark', 'gold_coin', 'mana_gem', 'star_filled', 'star_empty',
    'hp_bar_frame', 'energy_bar_frame', 'card_frame_R', 'card_frame_SR', 'card_frame_SSR'
  ];
  for (const asset of uiAssets) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.ui}/${asset}.png`));
  }

  // 5. Tải visual effects
  const effectAssets = [
    'hit_spark', 'fire_burst', 'water_splash', 'leaf_swirl',
    'light_flash', 'shadow_fade', 'heal_glow'
  ];
  for (const asset of effectAssets) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.effects}/${asset}.png`));
  }

  // 6. Tải card arts cho 18 cards demo
  for (let i = 1; i <= 18; i++) {
    const num = String(i).padStart(2, '0');
    promises.push(renderer.loadImage(`${ASSET_PATHS.cards}/card_demo_${num}.png`));
  }

  // 7. Tải portraits và avatars
  for (const charId of CHARACTERS) {
    promises.push(renderer.loadImage(`${ASSET_PATHS.portraits}/${charId}.png`));
    promises.push(renderer.loadImage(`${ASSET_PATHS.avatars}/avatar_${charId.replace('chr_', '')}.png`));
  }

  const results = await Promise.allSettled(promises);
  return results;
}
