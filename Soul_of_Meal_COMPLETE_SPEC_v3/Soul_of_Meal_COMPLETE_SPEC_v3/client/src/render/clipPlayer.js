export const CLIP_PRIORITY = Object.freeze({
  idle: 0,
  walk: 1,
  run: 1,
  victory: 20,
  attack_a: 30,
  attack_b: 30,
  hit: 40,
  skill_01: 50,
  boss_release: 50,
  ultimate_01: 60,
  defeat: 100,
});

export function validateAnimationManifest(manifest, availableFrameIds) {
  const errors = [];
  if (!isRecord(manifest)) return { valid: false, errors: ['manifest must be an object'] };
  if (manifest.schema_version !== 1) errors.push('schema_version must equal 1');
  if (!isId(manifest.character_id)) errors.push('character_id must be a non-empty ID');
  if (!isId(manifest.skin_id)) errors.push('skin_id must be a non-empty ID');
  if (typeof manifest.asset_version !== 'string' || !manifest.asset_version) errors.push('asset_version must be a non-empty string');
  if (typeof manifest.atlas !== 'string' || !manifest.atlas) errors.push('atlas must be a non-empty asset path');
  if (!isRecord(manifest.clips)) errors.push('clips must be an object');

  if (isRecord(manifest.clips)) {
    for (const [clipId, clip] of Object.entries(manifest.clips)) {
      if (!isRecord(clip)) {
        errors.push(`clips.${clipId} must be an object`);
        continue;
      }
      if (typeof clip.loop !== 'boolean') errors.push(`clips.${clipId}.loop must be a boolean`);
      if (!Number.isFinite(clip.fps) || clip.fps <= 0 || clip.fps > 120) errors.push(`clips.${clipId}.fps must be between 0 and 120`);
      if (!isRecord(clip.directions) || Object.keys(clip.directions).length === 0) {
        errors.push(`clips.${clipId}.directions must be a non-empty object`);
        continue;
      }

      for (const [direction, directionData] of Object.entries(clip.directions)) {
        const path = `clips.${clipId}.directions.${direction}`;
        if (!isRecord(directionData)) {
          errors.push(`${path} must be an object`);
          continue;
        }
        if (!Array.isArray(directionData.frames) || directionData.frames.length === 0 || directionData.frames.some((frameId) => !isId(frameId))) {
          errors.push(`${path}.frames must contain non-empty frame IDs`);
        } else {
          if (new Set(directionData.frames).size !== directionData.frames.length) errors.push(`${path}.frames contains duplicates`);
          if (availableFrameIds) {
            for (const frameId of directionData.frames) {
              if (!availableFrameIds.has(frameId)) errors.push(`${path} references missing frame ${frameId}`);
            }
          }
        }
        const anchor = directionData.anchor_normalized;
        if (!Array.isArray(anchor) || anchor.length !== 2 || anchor.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
          errors.push(`${path}.anchor_normalized must be two numbers in [0, 1]`);
        }
        if (directionData.events !== undefined && (!Array.isArray(directionData.events) || directionData.events.some((event) => (
          !isRecord(event) || !Number.isInteger(event.frame) || event.frame < 0 || event.frame >= (directionData.frames?.length ?? 0) || !isId(event.name)
        )))) errors.push(`${path}.events contains an invalid frame event`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export class ClipPlayer {
  constructor(manifest = null, { direction = 'S', fallbackClip = 'idle', reducedMotion = false } = {}) {
    this.manifest = manifest;
    this.direction = direction;
    this.fallbackClip = fallbackClip;
    this.reducedMotion = reducedMotion;
    this.current = null;
    this.elapsedMs = 0;
    this.completed = false;
    this.missingClip = false;
    this.play(fallbackClip, { force: true });
  }

  setDirection(direction) {
    if (this.direction === direction) return;
    this.direction = direction;
    const requestedClipId = this.current?.requestedClipId ?? this.fallbackClip;
    const previousFrameIndex = this.frameIndex ?? 0;
    const resolved = this.#resolveClip(requestedClipId);
    this.current = { ...resolved, requestedClipId };
    this.frameIndex = Math.min(previousFrameIndex, resolved.frames.length - 1);
    this.missingClip = resolved.missing;
  }

  play(requestedClipId, { force = false, restart = true } = {}) {
    const resolved = this.#resolveClip(requestedClipId);
    const nextPriority = CLIP_PRIORITY[requestedClipId] ?? 10;
    const currentPriority = CLIP_PRIORITY[this.current?.requestedClipId] ?? 10;
    if (!force && this.current && !this.current.loop && !this.completed && nextPriority < currentPriority) return false;
    if (!restart && this.current?.clipId === resolved.clipId) return true;
    if (!force && this.current?.requestedClipId === requestedClipId && !this.completed && !restart) return true;

    this.current = { ...resolved, requestedClipId };
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.completed = false;
    this.missingClip = resolved.missing;
    return true;
  }

  advance(deltaMs) {
    if (!this.current || !Number.isFinite(deltaMs) || deltaMs <= 0) return this.snapshot();
    const frameCount = this.current.frames.length;
    this.elapsedMs += deltaMs;
    const frameDuration = 1000 / this.current.fps;
    const totalFramesElapsed = Math.floor(this.elapsedMs / frameDuration);
    if (this.current.loop) {
      this.frameIndex = totalFramesElapsed % frameCount;
    } else if (totalFramesElapsed >= frameCount) {
      this.completed = true;
      const completedClip = this.current.clipId;
      this.play(this.fallbackClip, { force: true });
      return { ...this.snapshot(), completedClip };
    } else {
      this.frameIndex = totalFramesElapsed;
    }
    return this.snapshot();
  }

  snapshot() {
    if (!this.current) return null;
    const frameIndex = Math.min(this.frameIndex ?? 0, this.current.frames.length - 1);
    return {
      clipId: this.current.clipId,
      requestedClipId: this.current.requestedClipId,
      frameIndex: this.reducedMotion ? 0 : frameIndex,
      frameId: this.current.frames[this.reducedMotion ? 0 : frameIndex],
      loop: this.current.loop,
      fps: this.current.fps,
      anchor: this.current.anchor,
      missingClip: this.missingClip,
      completed: this.completed,
    };
  }

  #resolveClip(clipId) {
    const requested = this.#readClip(clipId);
    if (requested) return { ...requested, missing: false };
    const fallback = this.#readClip(this.fallbackClip);
    if (fallback) return { ...fallback, missing: true };
    return {
      clipId: this.fallbackClip,
      frames: [`placeholder:${clipId}`],
      fps: 1,
      loop: true,
      anchor: [0.5, 0.9],
      missing: true,
    };
  }

  #readClip(clipId) {
    const clip = this.manifest?.clips?.[clipId];
    if (!clip) return null;
    const direction = clip.directions?.[this.direction] ?? Object.values(clip.directions ?? {})[0];
    if (!direction?.frames?.length) return null;
    return {
      clipId,
      frames: direction.frames,
      fps: clip.fps,
      loop: clip.loop,
      anchor: direction.anchor_normalized ?? [0.5, 0.9],
    };
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}