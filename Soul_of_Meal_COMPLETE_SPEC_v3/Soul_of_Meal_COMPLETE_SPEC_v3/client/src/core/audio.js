// Original procedural score, synthesized locally. No speech synthesis or remote audio.
const SCORES = Object.freeze({
  village: [60, 64, 67, 72, 69, 67, 64, 62],
  adventure: [62, 65, 69, 74, 72, 69, 65, 67],
  tcg: [57, 60, 64, 67, 65, 64, 60, 59],
  chess: [55, 62, 67, 70, 69, 67, 62, 58],
  epic_boss_battle: [45, 52, 57, 60, 58, 57, 52, 55],
});
export function trackForContext(page, boss = false) {
  return boss
    ? "epic_boss_battle"
    : page === "adventure"
      ? "adventure"
      : page === "tcg"
        ? "tcg"
        : page === "chess"
          ? "chess"
          : "village";
}
export class GameAudio {
  constructor(settings = {}) {
    this.settings = settings;
    this.track = "village";
    this.context = null;
    this.index = 0;
  }
  async unlock() {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) return;
    try {
      if (!this.context) {
        this.context = new Context();
        this.musicGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
        this.applySettings(this.settings);
        this.timer = setInterval(() => this.pulse(), 350);
      }
      await this.context.resume();
    } catch {
      /* A device may deny audio; the game remains playable. */
    }
  }
  applySettings(settings) {
    this.settings = settings;
    if (this.musicGain)
      this.musicGain.gain.setTargetAtTime(
        ((settings.music ?? 70) / 100) * 0.08,
        this.context.currentTime,
        0.12,
      );
  }
  setTrack(track) {
    if (this.track === track) return;
    const old = this.musicGain;
    this.track = SCORES[track] ? track : "village";
    this.index = 0;
    if (!this.context) return;
    // Voices finish their envelopes on the old bus while the next score fades in.
    old.gain.setTargetAtTime(0, this.context.currentTime, 0.25);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.context.destination);
    this.applySettings(this.settings);
    setTimeout(() => old.disconnect(), 1500);
  }
  pulse() {
    if (!this.context || this.context.state !== "running") return;
    const notes = SCORES[this.track];
    const note = notes[this.index++ % notes.length];
    this.note(note, 0.55, "triangle", this.musicGain, 1);
    if (this.index % 4 === 0)
      this.note(note - 12, 0.9, "sine", this.musicGain, 0.8);
  }
  effect(kind = "hit") {
    if (!this.context || !this.settings.sfx || this.context.state !== "running")
      return;
    const gain = this.context.createGain();
    gain.gain.value = (this.settings.sfx / 100) * 0.045;
    gain.connect(this.context.destination);
    const note = kind.includes("heal")
      ? 81
      : kind.includes("win") || kind.includes("reward")
        ? 76
        : kind.includes("spell")
          ? 69
          : 48;
    this.note(note, 0.16, kind === "hit" ? "sawtooth" : "sine", gain, 1, () =>
      gain.disconnect(),
    );
  }
  note(midi, duration, type, bus, volume, done) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const envelope = this.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope);
    envelope.connect(bus);
    osc.start(now);
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
      done?.();
    };
  }
  dispose() {
    clearInterval(this.timer);
    this.context?.close();
  }
}
