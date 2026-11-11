const AUDIO_PATH = './assets/audio/';
const CUES = {
  quest_accepted: 'sfx_ui_confirm', chest_opened: 'sfx_ui_confirm',
  quest_completed: 'sfx_victory', trap_revealed: 'sfx_cast_fire',
  unit_summoned: 'sfx_ui_confirm', chess_unit_bought: 'sfx_ui_confirm',
  chess_units_merged: 'sfx_cast_fire', heal_resolved: 'sfx_ui_confirm',
  shield_applied: 'sfx_ui_confirm', boss_phase_changed: 'sfx_cast_fire',
};

export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.active = new Map();
    this.loops = {};
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

  updateLoops() {
    if (!this.unlocked) return;
    const tracks = {
      music: ({ home: 'village_theme', village: 'village_theme', forest: 'forest_theme', battle: 'battle_theme', tcg: 'forest_theme', chess: 'battle_theme' })[this.scene],
      ambience: this.scene === 'forest' ? 'forest_wind' : null,
    };
    for (const [channel, id] of Object.entries(tracks)) {
      let track = this.loops[channel];
      if (track?.id !== id) {
        track?.audio.pause();
        delete this.loops[channel];
        if (!id) continue;
        const audio = this.create(id, channel);
        audio.loop = true;
        track = { id, audio };
        this.loops[channel] = track;
      }
      if (!track) continue;
      track.audio.volume = this.volume(channel);
      if (track.audio.volume > 0) track.audio.play().catch(() => {});
      else track.audio.pause();
    }
  }

  setSettings(settings) {
    this.settings = settings;
    for (const [audio, channel] of this.active) audio.volume = this.volume(channel);
    this.updateLoops();
  }

  handle({ type, payload }) {
    if (type === 'hit_resolved') this.play(payload.element === 'fire' ? 'sfx_impact_fire' : 'sfx_hit');
    else if (type === 'attack_started') this.play(payload.clip_id === 'attack_b' ? 'sfx_slash_b' : 'sfx_slash_a');
    else if (type === 'cast_started') this.play(payload.element === 'fire' ? 'sfx_ultimate_fire' : 'sfx_cast_fire');
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
