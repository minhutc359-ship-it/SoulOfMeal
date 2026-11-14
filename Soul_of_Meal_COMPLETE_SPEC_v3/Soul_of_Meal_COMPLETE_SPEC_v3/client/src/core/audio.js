import { customSoundtrack, DEFAULT_SOUNDTRACKS } from './soundScenes.js';
import { createCompatibilityBank } from './mp3AudioBank.js';

const AUDIO_PATH = './assets/audio/';
const CUES = {
  quest_accepted: 'sfx_ui_confirm', chest_opened: 'sfx_ui_confirm',
  quest_completed: 'sfx_victory', trap_revealed: 'sfx_cast_fire',
  unit_summoned: 'sfx_ui_confirm', chess_unit_bought: 'sfx_ui_confirm',
  chess_units_merged: 'sfx_cast_fire', heal_resolved: 'sfx_ui_confirm',
  shield_applied: 'sfx_ui_confirm', boss_phase_changed: 'sfx_boss_warning',
  shield_broken: 'sfx_element_light_impact', boss_cast_released: 'sfx_impact_fire',
  boss_stove_destroyed: 'sfx_impact_fire', boss_cast_interrupted: 'sfx_boss_break',
  clue_discovered: 'sfx_ui_confirm',
  lantern_ward_activated: 'sfx_element_light_cast',
};

const ELEMENTS = new Set(['fire', 'water', 'wood', 'light', 'shadow']);
function elementalCue(element, phase, fallback) {
  return ELEMENTS.has(element) ? `sfx_element_${element}_${phase}` : fallback;
}

export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.active = new Map();
    this.loops = {};
    this.soundtracks = {};
    this.lastPlayed = new Map();
    this.unlocked = false;
    this.compatibilityBank = createCompatibilityBank(AUDIO_PATH);
  }

  unlock() {
    this.compatibilityBank?.unlock();
    this.unlocked = true;
    this.updateLoops();
  }

  setScene(scene) {
    this.scene = scene;
    this.updateLoops();
  }

  async loadSoundtracks(fetchRequest = globalThis.fetch) {
    try {
      const response = await fetchRequest(AUDIO_PATH + 'soundtracks.json', { cache: 'no-cache' });
      if (!response.ok) return;
      const config = await response.json();
      this.soundtracks = Object.fromEntries(Object.keys(DEFAULT_SOUNDTRACKS)
        .map(key => [key, customSoundtrack(config?.[key])]));
      this.updateLoops();
    } catch {
      // The demo tracks are already available while configuration is loading.
    }
  }

  updateLoops() {
    if (!this.unlocked) return;
    const music = DEFAULT_SOUNDTRACKS[this.scene];
    this.updateLoop('music', this.soundtracks[this.scene] ?? music, music);
    const wind = this.scene === 'forest' ? 'forest_wind.ogg' : undefined;
    this.updateLoop('ambience', wind, wind);
  }

  syncVisibility(hidden) {
    if (hidden) {
      for (const audio of this.active.keys()) audio.pause();
      this.active.clear();
    } else if (this.unlocked) {
      this.compatibilityBank?.unlock();
    }
    this.updateLoops();
  }

  updateLoop(channel, preferred, fallback) {
    let track = this.loops[channel];
    if (track?.preferred !== preferred || track?.fallback !== fallback) {
      track?.audio.pause();
      delete this.loops[channel];
      if (!preferred) return;
      track = this.startLoop(channel, preferred, fallback, preferred);
    }
    if (!track || track.failed) return;
    const hidden = globalThis.document?.hidden;

    track.audio.volume = this.volume(channel);
    if (!track.audio.volume || hidden) {
      track.audio.pause();
      track.requested = false;
      track.attempt += 1;
    } else if (!track.requested) {
      track.requested = true;
      const attempt = ++track.attempt;
      track.audio.play().catch(error => {
        if (this.loops[channel] !== track || track.attempt !== attempt) return;
        track.requested = false;
        if (error?.name === 'NotSupportedError' || error?.name === 'EncodingError') this.failLoop(channel, track);
      });
    }
  }

  startLoop(channel, preferred, fallback, path) {
    const audio = this.createTrack(path);
    audio.loop = true;
    const track = { audio, preferred, fallback, path, requested: false, failed: false, attempt: 0 };
    this.loops[channel] = track;
    audio.addEventListener('error', () => this.failLoop(channel, track), { once: true });
    return track;
  }

  failLoop(channel, track) {
    if (this.loops[channel] !== track || track.failed) return;
    track.failed = true;
    track.audio.pause();
    if (!track.fallback || track.path === track.fallback) return;
    this.startLoop(channel, track.preferred, track.fallback, track.fallback);
    this.updateLoops();
  }

  setSettings(settings) {
    this.settings = settings;
    for (const [audio, gain] of this.active) audio.volume = Math.min(1, this.volume('sfx') * gain);
    this.updateLoops();
  }

  footstep(surface, distance) {
    if (this.stepSurface !== surface) {
      this.stepSurface = surface;
      this.stepDistance = 0;
      this.stepSide = 0;
    }
    this.stepDistance += distance;
    if (this.stepDistance < 48) return;
    this.stepDistance %= 48;
    this.stepSide ^= 1;
    const cue = surface === 'forest'
      ? (this.stepSide ? 'sfx_footstep_leaves_a' : 'sfx_footstep_leaves_b')
      : (this.stepSide ? 'sfx_footstep' : 'sfx_footstep_stone_b');
    this.play(cue, { gain: .54 });
  }

  handle({ type, payload }) {
    if (type === 'hit_resolved' && (payload.guarded || (payload.absorbed > 0 && payload.hp_damage === 0))) {
      this.play('sfx_guard_contact', { gain: .76 });
    } else if (['hit_resolved', 'heal_resolved', 'shield_applied'].includes(type)) {
      const strong = payload.source_kind === 'ultimate' || payload.source_kind === 'boss_telegraph';
      this.play(elementalCue(payload.element, 'impact', CUES[type] ?? 'sfx_hit'), {
        gain: strong ? 1.15 : .84, priority: strong,
      });
    } else if (type === 'attack_started' && !payload.travel_ticks) {
      this.play(payload.clip_id === 'attack_b' ? 'sfx_slash_b' : 'sfx_slash_a', { gain: .57 });
    } else if (type === 'projectile_spawned' || type === 'spell_launched') {
      this.play(elementalCue(payload.element, 'cast', 'sfx_cast_fire'), { gain: .61 });
    } else if (type === 'cast_started') {
      const enemy = payload.source_kind === 'enemy_skill';
      this.play(elementalCue(payload.element, enemy ? 'cast' : 'ultimate', 'sfx_ultimate_fire'),
        { gain: enemy ? .77 : 1.14, priority: !enemy });
    } else if (type === 'boss_phase_changed' || type === 'boss_cast_interrupted') {
      this.play(CUES[type], { gain: 1.12, priority: true });
    } else if (['boss_cast_released', 'enemy_skill_released'].includes(type)) this.play(elementalCue(payload.element, 'impact'));
    else if (type === 'battle_finished' && (payload.winner_team === 'player' || payload.winner === 'player' || payload.winner === 0)) this.play('sfx_victory', { priority: true });
    else if (CUES[type]) this.play(CUES[type]);
  }

  play(id, { gain = 1, priority = false } = {}) {
    if (!this.unlocked || globalThis.document?.hidden || !this.volume('sfx') || this.active.size >= (priority ? 12 : 10)) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < 110) return;
    this.lastPlayed.set(id, now);
    const audio = this.createTrack(id + '.ogg');
    audio.volume = Math.min(1, this.volume('sfx') * gain);
    const release = () => this.active.delete(audio);
    this.active.set(audio, gain);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    audio.play().catch(release);
  }

  createTrack(path) {
    return this.compatibilityBank?.create(path) ?? new Audio(AUDIO_PATH + path);
  }

  volume(channel) {
    const level = Math.min(1, Math.max(0, (this.settings[channel] ?? 0) / 100));
    return level * (channel === 'sfx' ? .44 : .65);
  }
}
