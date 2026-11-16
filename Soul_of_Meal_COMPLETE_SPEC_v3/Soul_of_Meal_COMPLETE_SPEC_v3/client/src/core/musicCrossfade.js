/** Presentation-only music mixing; it never advances game simulation. */
export class MusicCrossfade {
  constructor({ duration = 800, now = () => performance.now(), schedule, cancel = timer => globalThis.clearInterval(timer) } = {}) {
    this.duration = duration;
    this.now = now;
    this.schedule = schedule ?? (callback => { const timer = setInterval(callback, 16); timer.unref?.(); return timer; });
    this.cancel = cancel;
    this.outgoing = [];
  }

  start(outgoing, incoming, volume, onTick) {
    this.advance(false);
    const retiring = [...new Set([...this.outgoing.map(item => item.track), outgoing])];
    if (this.timer !== undefined) this.cancel(this.timer);
    this.outgoing = retiring.filter(track => {
      if (!track || track.failed || (track.fadeGain ?? 1) <= 0) { track?.audio.pause(); return false; }
      return true;
    }).map(track => ({ track, gain: track.fadeGain ?? 1 }));
    this.current = incoming;
    this.volume = volume;
    this.onTick = onTick;
    this.started = this.now();
    incoming.fadeGain = 0;
    incoming.audio.volume = 0;
    this.timer = this.schedule(() => this.advance());
  }

  advance(present = true) {
    if (!this.current) return;
    const ratio = Math.min(1, Math.max(0, (this.now() - this.started) / this.duration));
    const volume = this.volume();
    for (const item of this.outgoing) {
      item.track.fadeGain = item.gain * (1 - ratio);
      item.track.audio.volume = volume * item.track.fadeGain;
    }
    this.current.fadeGain = ratio;
    this.current.audio.volume = volume * ratio;
    const onTick = this.onTick;
    if (ratio === 1) this.finish();
    if (present) onTick?.();
  }

  finish() {
    if (this.timer !== undefined) this.cancel(this.timer);
    this.timer = undefined;
    for (const item of this.outgoing) item.track.audio.pause();
    this.outgoing = [];
    if (this.current) this.current.fadeGain = 1;
    this.current = null;
  }
}
