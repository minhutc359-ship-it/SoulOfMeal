import { ClipPlayer } from './clipPlayer.js';
import { rigSample } from './chibiRig.js';
import { rigMotion } from './spiritRig.js';
import { canvasContext, canvasResolution } from './canvasSurface.js';

export const BOARD_SPRITE = { width: 128, height: 104, x: 64, baseline: 85, scale: .60 };

export class BoardSprites {
  constructor(renderer) {
    this.renderer = renderer;
    this.actors = new Map();
    this.frames = new WeakMap();
    this.cues = new Map();
  }

  cue(key, clip, now, actionSeq, contact) {
    const cues = this.cues.get(key) ?? [];
    if (!cues.some(cue => cue.clip === clip && cue.actionSeq === actionSeq)) {
      cues.push({ clip, now, actionSeq, contact });
      cues.sort((a, b) => a.now - b.now);
      this.cues.set(key, cues);
    }
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
      const cues = this.cues.get(key);
      while (cues?.length && cues[0].now <= now) {
        const cue = cues.shift();
        if (!reducedMotion && now - cue.now < 550) {
          actor.clip.play(cue.clip, { force: true });
          actor.timing = Number.isFinite(cue.contact) ? { start: cue.now, contact: cue.contact } : null;
        }
      }
      const frame = actor.clip.advance(delta * 1000);
      const rig = this.renderer.rigs?.get(id);
      const clip = rig?.clips[frame.requestedClipId];
      const progress = clip && frame.missingClip && frame.motionPhase != null && frame.loop
        ? (frame.motionPhase / clip.duration) % 1 : frame.motionPhase;
      const phase = clip ? rigMotion(clip, progress, actor.timing, now) : 0;
      const signature = clip ? `${frame.requestedClipId}:${direction}:${Math.floor(phase * 24)}`
        : `${frame.frameId}:${frame.flipX}:${rigSample(id, frame)}`;
      const { width, height, x, baseline, scale } = BOARD_SPRITE;
      const resolution = canvasResolution(canvas, width, height, true);
      const keyframe = signature + ':' + resolution.join('x');
      if (this.frames.get(canvas) === keyframe) continue;
      const context = canvasContext(canvas, resolution, width, height);
      if (!context) continue;
      context.clearRect(0, 0, width, height);
      const drawn = clip && rig.draw(context, { id: frame.requestedClipId, phase }, x, baseline, direction, scale);
      if (drawn || this.renderer.drawSprite(context, id, frame, x, baseline + 2, { scale: .61 })) {
        this.frames.set(canvas, keyframe);
      }
    }
    for (const key of this.actors.keys()) if (!current.has(key)) this.actors.delete(key);
    for (const [key, cues] of this.cues) if (!cues.length || now - cues.at(-1).now >= 550) this.cues.delete(key);
  }

  clear() {
    this.actors.clear();
    this.cues.clear();
  }
}
