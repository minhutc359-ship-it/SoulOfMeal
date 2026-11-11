export const DEFAULT_SOUNDTRACKS = Object.freeze({
  login: 'village_theme.ogg',
  village: 'village_theme.ogg',
  forest: 'forest_theme.ogg',
  tcg: 'forest_theme.ogg',
  chess: 'battle_theme.ogg',
  adventure: 'village_theme.ogg',
  adventure_battle: 'battle_theme.ogg',
  epic_boss_battle: 'battle_theme.ogg',
});

export function resolveSoundScene(page, adventure) {
  if (page === 'title') return 'login';
  if (page === 'tcg' || page === 'deck') return 'tcg';
  if (page === 'chess') return 'chess';
  if (page === 'journey') return 'adventure';
  if (page === 'adventure') {
    if (adventure.battle) {
      return adventure.battle.actors.some(actor => actor.boss) ? 'epic_boss_battle' : 'adventure_battle';
    }
    if (adventure.map === 'forest') return 'forest';
    return adventure.map === 'village' ? 'village' : 'adventure';
  }
  return 'village';
}

export function customSoundtrack(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!/\.(ogg|mp3|m4a|wav|aac|opus|flac|webm)$/i.test(path)) return null;
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\:?#%\u0000-\u001f]/.test(segment))) return null;
  return segments.map(encodeURIComponent).join('/');
}
