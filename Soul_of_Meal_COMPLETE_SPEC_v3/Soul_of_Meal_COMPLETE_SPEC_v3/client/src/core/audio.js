import { customSoundtrack, DEFAULT_SOUNDTRACKS } from './soundScenes.js';

const AUDIO_PATH = './assets/audio/';
const CUES = {
  quest_accepted: 'sfx_ui_confirm', chest_opened: 'sfx_ui_confirm',
  quest_completed: 'sfx_victory', trap_revealed: 'sfx_cast_fire',
  unit_summoned: 'sfx_ui_confirm', chess_unit_bought: 'sfx_ui_confirm',
  chess_units_merged: 'sfx_cast_fire', heal_resolved: 'sfx_ui_confirm',
  shield_applied: 'sfx_ui_confirm', boss_phase_changed: 'sfx_cast_fire',
  shield_broken: 'sfx_element_light_impact', boss_cast_released: 'sfx_impact_fire',
  boss_stove_destroyed: 'sfx_impact_fire', boss_cast_interrupted: 'sfx_ui_confirm',
  clue_discovered: 'sfx_ui_confirm',
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
  }

  unlock() {
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

  updateLoop(channel, preferred, fallback) {
    let track = this.loops[channel];
    if (track?.preferred !== preferred || track?.fallback !== fallback) {
      track?.audio.pause();
      delete this.loops[channel];
      if (!preferred) return;
      track = this.startLoop(channel, preferred, fallback, preferred);
    }
    if (!track || track.failed) return;

    track.audio.volume = this.volume(channel);
    if (!track.audio.volume) {
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
    const audio = new Audio(AUDIO_PATH + path);
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
    for (const [audio, channel] of this.active) audio.volume = this.volume(channel);
    this.updateLoops();
  }

  handle({ type, payload }) {
    if (['hit_resolved', 'heal_resolved', 'shield_applied'].includes(type)) this.play(elementalCue(payload.element, 'impact', CUES[type] ?? 'sfx_hit'));
    else if (type === 'attack_started') this.play(payload.clip_id === 'attack_b' ? 'sfx_slash_b' : 'sfx_slash_a');
    else if (type === 'cast_started') this.play(elementalCue(payload.element, 'cast', 'sfx_cast_fire'));
    else if (type === 'battle_finished' && (payload.winner_team === 'player' || payload.winner === 0)) this.play('sfx_victory');
    else if (CUES[type]) this.play(CUES[type]);
  }

  play(id) {
    if (!this.unlocked || !this.volume('sfx') || this.active.size >= 12) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < 110) return;
    this.lastPlayed.set(id, now);
    const audio = this.create(id, 'sfx');
    const release = () => this.active.delete(audio);
    this.active.set(audio, 'sfx');
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    audio.play().catch(release);
  }

  create(id, channel) {
    const audio = new Audio(AUDIO_PATH + id + '.ogg');
    audio.volume = this.volume(channel);
    return audio;
  }

  volume(channel) {
    return Math.min(1, Math.max(0, (this.settings[channel] ?? 0) / 100)) * (channel === 'sfx' ? .44 : .65);
  }
}
