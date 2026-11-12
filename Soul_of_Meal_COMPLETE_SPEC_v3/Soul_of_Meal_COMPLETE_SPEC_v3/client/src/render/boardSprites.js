import { ClipPlayer } from './clipPlayer.js';

export class BoardSprites {
  constructor(renderer) {
    this.renderer = renderer;
    this.actors = new Map();
    this.frames = new WeakMap();
    this.cues = new Map();
  }

  cue(key, clip, now, actionSeq) {
    const prior = this.cues.get(key);
    if (prior?.actionSeq === actionSeq && prior.clip === 'hit') return;
    this.cues.set(key, { clip, now, actionSeq });
  }

  paint(host, delta, now, reducedMotion) {
    const current = new Set();
    for (const canvas of host.querySelectorAll('[data-chibi-id]')) {
      const { chibiId: id, chibiKey: key, chibiFacing: direction } = canvas.dataset;
      current.add(key);
      let actor = this.actors.get(key);
      if (!actor || actor.id !== id) {
        actor = { id, clip: new ClipPlayer(this.renderer.sheets.get(id)?.manifest, { direction, reducedMotion }) };
        this.actors.set(key, actor);
      }
      actor.clip.setDirection(direction);
      actor.clip.reducedMotion = reducedMotion;
      const cue = this.cues.get(key);
      if (cue && cue !== actor.cue && !reducedMotion && now - cue.now < 550) {
        actor.cue = cue;
        actor.clip.play(cue.clip, { force: true });
      }
      const frame = actor.clip.advance(delta * 1000);
      const signature = frame.frameId + ':' + Boolean(frame.flipX);
      if (this.frames.get(canvas) === signature) continue;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.clearRect(0, 0, 96, 96);
      if (this.renderer.drawSprite(context, id, frame, 48, 79, { scale: .55 })) {
        this.frames.set(canvas, signature);
      }
    }
    for (const key of this.actors.keys()) if (!current.has(key)) this.actors.delete(key);
    for (const [key, cue] of this.cues) if (now - cue.now >= 550) this.cues.delete(key);
  }

  clear() {
    this.actors.clear();
    this.cues.clear();
  }
}
