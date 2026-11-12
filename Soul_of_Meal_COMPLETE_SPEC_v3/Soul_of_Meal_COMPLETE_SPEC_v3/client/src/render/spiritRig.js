import { HERO_ID, HERO_NAMES } from './spriteAssets.js';

const ASSETS = './assets/original/rigs/';
const RAD = Math.PI / 180;
const CLIPS = ['idle', 'walk', 'run', 'attack_a', 'attack_b', 'skill_01', 'ultimate_01', 'hit', 'victory', 'defeat'];
const clamp = value => Math.max(0, Math.min(1, value));
const keyTime = key => key.time ?? 0;

function trackValue(keys, time, property) {
  if (!keys?.length || time < keyTime(keys[0])) return 0;
  const end = keys.findIndex(key => keyTime(key) > time);
  if (end < 0) return keys.at(-1)[property] ?? 0;
  const from = keys[end - 1];
  const to = keys[end];
  const start = from[property] ?? 0;
  return start + ((to[property] ?? 0) - start) * (time - keyTime(from)) / (keyTime(to) - keyTime(from));
}

export class SpiritRig {
  constructor(data, regions, image) {
    this.image = image;
    this.bones = data.bones;
    const indexes = new Map();
    this.parents = this.bones.map((bone, index) => {
      const parent = bone.parent ? indexes.get(bone.parent) : -1;
      if (parent === undefined || indexes.has(bone.name)) throw new Error('Invalid rig bone hierarchy');
      indexes.set(bone.name, index);
      return parent;
    });
    this.tip = indexes.get('effect_tip') ?? indexes.get('blade_tip');
    if (this.tip === undefined) throw new Error('Missing effect socket');
    const skin = data.skins.find(item => item.name === 'default')?.attachments;
    this.slots = data.slots.map(slot => {
      const attachment = skin?.[slot.name]?.[slot.attachment];
      const region = regions[slot.attachment];
      const bone = indexes.get(slot.bone);
      if (!attachment || bone === undefined || !Array.isArray(region) || region.length !== 4
          || region.some(value => !Number.isInteger(value) || value < 0)
          || !region[2] || !region[3] || region[0] + region[2] > image.naturalWidth
          || region[1] + region[3] > image.naturalHeight) throw new Error('Invalid rig attachment');
      return { attachment, region, bone };
    });
    this.clips = Object.fromEntries(Object.entries(data.animations).map(([id, animation]) => {
      const duration = Math.max(...Object.values(animation.bones).flatMap(tracks =>
        Object.values(tracks).map(keys => keyTime(keys.at(-1)))));
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid rig timeline');
      const cue = animation.events?.find(event => ['effect_contact', 'effect_contact_alt', 'blade_contact'].includes(event.name));
      const socket = cue?.name === 'effect_contact_alt' ? indexes.get('effect_tip_alt') : this.tip;
      if (cue && (!Number.isFinite(cue.time) || cue.time <= 0 || cue.time >= duration || socket === undefined)) {
        throw new Error('Invalid rig contact cue');
      }
      return [id, { duration, contact: cue?.time, socket, tracks: animation.bones }];
    }));
    if (CLIPS.some(id => !Object.hasOwn(this.clips, id))) throw new Error('Incomplete spirit rig');
  }

  pose(clip, phase = 0) {
    const time = clip.duration * clamp(phase);
    const pose = [];
    for (const [index, bone] of this.bones.entries()) {
      const parent = pose[this.parents[index]];
      const track = clip.tracks[bone.name];
      const x = (bone.x ?? 0) + trackValue(track?.translate, time, 'x');
      const y = (bone.y ?? 0) + trackValue(track?.translate, time, 'y');
      const angle = ((bone.rotation ?? 0) + trackValue(track?.rotate, time, 'value')) * RAD + (parent?.angle ?? 0);
      const cos = parent ? Math.cos(parent.angle) : 1;
      const sin = parent ? Math.sin(parent.angle) : 0;
      pose.push({ x: (parent?.x ?? 0) + x * cos - y * sin, y: (parent?.y ?? 0) + x * sin + y * cos, angle });
    }
    return pose;
  }

  draw(ctx, motion, x, y, direction, scale, opacity = 1) {
    const clip = this.clips[motion.id];
    if (!clip) return false;
    const pose = this.pose(clip, motion.phase);
    ctx.save();
    if (opacity !== 1) ctx.globalAlpha *= opacity;
    ctx.translate(x, y);
    ctx.scale(direction === 'W' ? -scale : scale, -scale);
    for (const { attachment, region, bone } of this.slots) {
      const joint = pose[bone];
      ctx.save();
      ctx.translate(joint.x, joint.y);
      ctx.rotate(joint.angle);
      ctx.scale(1, -1);
      ctx.drawImage(this.image, ...region, attachment.x - attachment.width / 2,
        -attachment.y - attachment.height / 2, attachment.width, attachment.height);
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  effectPoint(id, x, y, direction, scale, reducedMotion = false) {
    const clip = this.clips[id];
    if (!clip?.contact) return null;
    const joint = this.pose(clip, reducedMotion ? 0 : clip.contact / clip.duration)[clip.socket];
    return { x: x + joint.x * (direction === 'W' ? -scale : scale), y: y - joint.y * scale };
  }
}

export function rigMotion(clip, phase, timing, now) {
  if (phase == null) return 0;
  if (!clip?.contact || !timing) return phase;
  const { start, contact } = timing;
  const time = now < contact
    ? clip.contact * clamp((now - start) / Math.max(1, contact - start))
    : clip.contact + (now - contact) / 1000;
  return clamp(time / clip.duration);
}

export class BattleRigClock {
  constructor(rig, tickRate) {
    this.rig = rig;
    this.tickRate = tickRate;
    this.lastContact = null;
    this.defeat = null;
  }

  contact(battle, id) {
    const clip = this.rig.clips[id];
    if (!clip?.contact || (this.lastContact?.battle === battle && this.lastContact.tick === battle.tick)) return false;
    this.lastContact = { id, clip, battle, tick: battle.tick };
    return true;
  }

  motion(battle, actor, animation) {
    if (this.lastContact?.battle !== battle) this.lastContact = null;
    if (this.defeat?.battle !== battle || actor.alive) this.defeat = null;
    if (!actor.alive) {
      this.defeat ??= { battle, tick: battle.tick };
      const phase = battle.phase === 'battle_end' || animation?.motionPhase == null
        ? 1 : clamp((battle.tick - this.defeat.tick) / this.tickRate / this.rig.clips.defeat.duration);
      return { id: 'defeat', phase };
    }
    const fallback = { id: animation?.requestedClipId ?? (actor.alive ? 'idle' : 'defeat'), phase: animation?.motionPhase ?? 0 };
    if (animation?.motionPhase == null) return fallback;
    const { action } = actor;
    if (actor.alive && battle.phase === 'battle_running' && action) {
      const id = action.clip ?? (action.sourceKind === 'ultimate' ? 'ultimate_01' : 'attack_a');
      const clip = this.rig.clips[id];
      if (clip?.contact) {
        const tickMs = 1000 / this.tickRate;
        const timing = { start: (action.launchTick - action.windup) * tickMs, contact: action.launchTick * tickMs };
        const phase = rigMotion(clip, 0, timing, battle.tick * tickMs);
        return phase < 1 ? { id, phase } : { id: 'idle', phase: 0 };
      }
    }
    const previous = this.lastContact;
    if (previous && actor.alive && battle.phase === 'battle_running' && animation.requestedClipId !== 'hit') {
      const { id, clip, tick } = previous;
      const time = clip.contact + (battle.tick - tick) / this.tickRate;
      if (battle.tick >= tick && time < clip.duration) return { id, phase: time / clip.duration };
    }
    if (actor.moving && !['walk', 'run'].includes(fallback.id)) {
      return { id: 'run', phase: battle.tick / this.tickRate / this.rig.clips.run.duration % 1 };
    }
    return fallback;
  }
}

async function loadSpiritRig(renderer, id, signal) {
  const asset = id === HERO_ID ? 'bunbo' : id;
  const directory = ASSETS + asset + '/';
  async function json(name) {
    const response = await fetch(directory + name, { signal });
    if (!response.ok) throw new Error('Could not load spirit rig ' + id);
    return response.json();
  }
  try {
    const [data, regions, image] = await Promise.all([
      json(asset + '.json'), json('regions.json'), renderer.loadImage(directory + 'parts.webp'),
    ]);
    return image && new SpiritRig(data, regions, image);
  } catch {
    return null;
  }
}

export async function loadSpiritRigs(renderer, signal) {
  const entries = await Promise.all(Object.keys(HERO_NAMES).map(async id => [id, await loadSpiritRig(renderer, id, signal)]));
  return new Map(entries.filter(([, rig]) => rig));
}
