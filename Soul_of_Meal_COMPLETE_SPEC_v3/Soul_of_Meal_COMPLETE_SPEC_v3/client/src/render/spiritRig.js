import { actorArt, FIELD_MONSTER_IDS, HERO_ID, HERO_NAMES } from './spriteAssets.js';
import { SPIRITS } from '../modes/metaProgress.js';

const ASSETS = './assets/original/rigs/';
const RAD = Math.PI / 180;
const CLIPS = ['idle', 'walk', 'run', 'attack_a', 'attack_b', 'skill_01', 'ultimate_01', 'hit', 'victory', 'defeat'];
const clamp = value => Math.max(0, Math.min(1, value));
const keyTime = key => key.time ?? 0;

function trackSlope(from, to, property) {
  return ((to[property] ?? 0) - (from[property] ?? 0)) / (keyTime(to) - keyTime(from));
}

function tangent(before, after) {
  return before * after > 0 ? 2 * before * after / (before + after) : 0;
}

function trackValue(keys, time, property) {
  if (!keys?.length || time < keyTime(keys[0])) return 0;
  const end = keys.findIndex(key => keyTime(key) > time);
  if (end < 0) return keys.at(-1)[property] ?? 0;
  const from = keys[end - 1];
  const to = keys[end];
  const start = from[property] ?? 0;
  const span = keyTime(to) - keyTime(from);
  const t = (time - keyTime(from)) / span;
  const slope = trackSlope(from, to, property);
  const enter = end > 1 ? tangent(trackSlope(keys[end - 2], from, property), slope) : 0;
  const exit = end + 1 < keys.length ? tangent(slope, trackSlope(to, keys[end + 1], property)) : 0;
  // Stop at changes of direction and carry speed across the other key poses.
  return start + ((to[property] ?? 0) - start) * t * t * (3 - 2 * t)
    + span * t * (1 - t) * (enter * (1 - t) - exit * t);
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
      return { attachment, region, bone, name: slot.name };
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
    this.feet = this.slots.filter(slot => slot.name === 'leg_near' || slot.name === 'leg_far');
    this.floor = this.feet.length ? this.lowestFoot(this.pose(this.clips.idle, 0)) : 0;
  }

  lowestFoot(pose) {
    return Math.min(...this.feet.map(({ bone, attachment }) => {
      const joint = pose[bone];
      const { x = attachment.x, y = attachment.y - attachment.height / 2 + 1 } = attachment.sole ?? {};
      return joint.y + x * Math.sin(joint.angle) + y * Math.cos(joint.angle);
    }));
  }

  pose(clip, phase = 0, transition) {
    const time = clip.duration * clamp(phase);
    const fromTime = transition && transition.clip.duration * clamp(transition.phase);
    const pose = [];
    for (const [index, bone] of this.bones.entries()) {
      const parent = pose[this.parents[index]];
      const track = clip.tracks[bone.name];
      const from = transition?.clip.tracks[bone.name];
      const sample = (kind, property) => {
        const value = trackValue(track?.[kind], time, property);
        if (!transition) return value;
        const previous = trackValue(from?.[kind], fromTime, property);
        return previous + (value - previous) * transition.mix;
      };
      const x = (bone.x ?? 0) + sample('translate', 'x');
      const y = (bone.y ?? 0) + sample('translate', 'y');
      const angle = ((bone.rotation ?? 0) + sample('rotate', 'value')) * RAD + (parent?.angle ?? 0);
      const cos = parent ? Math.cos(parent.angle) : 1;
      const sin = parent ? Math.sin(parent.angle) : 0;
      pose.push({ x: (parent?.x ?? 0) + x * cos - y * sin, y: (parent?.y ?? 0) + x * sin + y * cos, angle });
    }
    return pose;
  }

  groundedPose(clip, motion) {
    const { transition } = motion;
    const pose = this.pose(clip, motion.phase, transition);
    const locomotion = id => id === 'walk' || id === 'run';
    const ground = Number(locomotion(motion.id)) * (transition?.mix ?? 1)
      + Number(locomotion(transition?.id)) * (1 - (transition?.mix ?? 1));
    if (ground && this.feet.length) {
      const correction = (this.floor - this.lowestFoot(pose)) * ground;
      for (const joint of pose) joint.y += correction;
    }
    return pose;
  }

  draw(ctx, motion, x, y, direction, scale, opacity = 1) {
    const clip = this.clips[motion.id];
    if (!clip) return false;
    const pose = this.groundedPose(clip, motion);
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
      const left = attachment.x - attachment.width / 2;
      const top = -attachment.y - attachment.height / 2;
      if (attachment.mask) {
        ctx.beginPath();
        for (const [u, v] of attachment.mask) ctx.lineTo(left + u * attachment.width, top + v * attachment.height);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(this.image, ...region, left, top, attachment.width, attachment.height);
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

  motion(battle, actor, animation, tickFraction = 0) {
    const tick = battle.tick + tickFraction;
    if (this.lastContact?.battle !== battle) this.lastContact = null;
    if (this.defeat?.battle !== battle || actor.alive) this.defeat = null;
    if (!actor.alive) {
      this.defeat ??= { battle, tick: battle.tick };
      const phase = battle.phase === 'battle_end' || animation?.motionPhase == null
        ? 1 : clamp((tick - this.defeat.tick) / this.tickRate / this.rig.clips.defeat.duration);
      return { id: 'defeat', phase };
    }
    const id = animation?.requestedClipId ?? 'idle';
    const fallbackClip = this.rig.clips[id];
    const rawPhase = animation?.motionPhase ?? 0;
    const phase = animation?.missingClip && fallbackClip
      ? (['idle', 'walk', 'run'].includes(id) ? (rawPhase / fallbackClip.duration) % 1 : clamp(rawPhase / fallbackClip.duration))
      : rawPhase;
    const fallback = { id, phase };
    if (animation?.motionPhase == null) return fallback;
    const { action } = actor;
    if (actor.alive && battle.phase === 'battle_running' && action) {
      const id = action.clip ?? (action.sourceKind === 'ultimate' ? 'ultimate_01' : 'attack_a');
      const clip = this.rig.clips[id];
      if (clip?.contact) {
        const tickMs = 1000 / this.tickRate;
        const timing = { start: (action.launchTick - action.windup) * tickMs, contact: action.launchTick * tickMs };
        const phase = rigMotion(clip, 0, timing, (battle.tick === action.launchTick ? battle.tick : tick) * tickMs);
        return phase < 1 ? { id, phase } : { id: 'idle', phase: 0 };
      }
    }
    const previous = this.lastContact;
    if (previous && actor.alive && battle.phase === 'battle_running' && animation.requestedClipId !== 'hit') {
      const { id, clip, tick } = previous;
      const elapsed = battle.tick === tick ? 0 : battle.tick + tickFraction - tick;
      const time = clip.contact + elapsed / this.tickRate;
      if (battle.tick >= tick && time < clip.duration) return { id, phase: time / clip.duration };
    }
    if (actor.moving && !['walk', 'run'].includes(fallback.id)) {
      return { id: 'run', phase: tick / this.tickRate / this.rig.clips.run.duration % 1 };
    }
    return fallback;
  }

  frame(battle, actor, animation, tickFraction = 0) {
    const motion = this.motion(battle, actor, animation, tickFraction);
    const now = battle.tick + tickFraction;
    if (this.lastFrame?.battle !== battle || this.lastFrame.wave !== battle.wave
        || animation?.motionPhase == null || battle.phase === 'battle_end') {
      this.transition = null;
    } else if (this.lastFrame.motion.id !== motion.id) {
      const from = this.lastFrame.motion;
      const clip = this.rig.clips[from.id];
      this.transition = clip ? { id: from.id, clip, phase: from.phase, start: now } : null;
    }
    this.lastFrame = { battle, wave: battle.wave, motion };
    if (this.transition) {
      const mix = clamp((now - this.transition.start) / (this.tickRate * .11));
      if (mix < 1) return { ...motion, transition: { ...this.transition, mix: mix * mix * (3 - 2 * mix) } };
      this.transition = null;
    }
    return motion;
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
  const actors = [...Object.values(SPIRITS), ...FIELD_MONSTER_IDS.map(id => ({ id, role: 'fighter' }))];
  const entries = await Promise.all(actors.map(async spirit => {
    const id = spirit.id;
    const rig = Object.hasOwn(HERO_NAMES, id) && await loadSpiritRig(renderer, id, signal);
    return [id, rig || await loadPortraitRig(renderer, spirit)];
  }));
  return new Map(entries.filter(([, rig]) => rig));
}

// Body seams and the forward hand side are measured on each original portrait.
const neckAndHip = {
  '002': [.54, .79], '003': [.57, .80], '004': [.48, .75], '005': [.51, .74],
  '006': [.44, .78], '007': [.46, .75], '008': [.50, .75], '009': [.48, .76],
  '010': [.49, .78], '011': [.49, .75], '012': [.50, .77], '013': [.53, .79],
  '016': [.50, .77], '017': [.51, .76], '019': [.49, .76], '020': [.51, .77],
  '022': [.48, .79], '023': [.44, .74], '024': [.46, .75],
};

const handSeams = {
  '002': .65, '003': .73, '004': .66, '005': .69, '006': .62, '007': .64,
  '008': .67, '009': .62, '010': .64, '011': .65, '012': .62, '013': .63,
  '016': .65, '017': .64, '019': .70, '020': .64, '022': .71, '023': .62, '024': .56,
};

async function loadPortraitRig(renderer, spirit) {
  const image = await renderer.loadImage(actorArt(spirit.id));
  if (!image) return null;
  const width = image.naturalWidth, height = image.naturalHeight;
  const soles = Object.hasOwn(handSeams, spirit.id.slice(-3)) ? measurePortraitSoles(image, width, height) : null;
  return new SpiritRig(...portraitRigDefinition(spirit, width, height, soles), image);
}

function measurePortraitSoles(image, width, height) {
  if (!globalThis.document) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    return portraitSoles(pixels, width, height);
  } catch {
    return null;
  }
}

export function portraitSoles(pixels, width, height) {
  const split = Math.round(width * .51);
  return [[0, split], [split, width]].map(([start, end]) => {
    for (let y = height - 1; y >= height * .78; y--) {
      let count = 0, sum = 0;
      for (let x = start; x < end; x++) {
        if (pixels[(y * width + x) * 4 + 3] >= 144) {
          count++;
          sum += x;
        }
      }
      if (count >= Math.max(2, Math.floor(width * .015))) return { x: sum / count, y };
    }
    return null;
  });
}

export function portraitRigDefinition(spirit, width, height, soles = null) {
  const [neck, hip] = neckAndHip[spirit.id.slice(-3)] ?? [.49, .75];
  const size = Math.min(89 / height, 106 / width);
  const neckY = Math.round(neck * height), hipY = Math.round(hip * height);
  const overlap = Math.max(2, Math.round(height * .022));
  const hand = handSeams[spirit.id.slice(-3)];
  const shift = hand == null ? 0 : (hand - .5) * width * size;
  const soleY = Math.max(0, ...(soles ?? []).map(sole => sole?.y ?? 0)) || height;
  const shoulder = hand == null ? 0 : (hipY - neckY) * .76 * size;
  const shin = (height - hipY) * .53 * size;
  const spread = width * size * .12;
  const strips = [
    ['feet', hipY - overlap, height, height],
    ['head', 0, neckY + overlap, neckY],
    ['body', neckY - overlap, hipY + overlap, hipY],
  ];
  if (hand != null) {
    const bodyMask = [[0, 0], [hand + .06, 0], [hand - .065, .42], [hand + .05, 1], [0, 1]];
    const armMask = [[hand + .04, 0], [1, 0], [1, 1], [hand + .02, 1], [hand - .1, .42]];
    strips.splice(0, 1,
      ['leg_far', hipY - overlap, height, height - shin / size, -spread, [[0, 0], [.51, 0], [.51, 1], [0, 1]]],
      ['leg_near', hipY - overlap, height, height - shin / size, spread, [[.51, 0], [1, 0], [1, 1], [.51, 1]]]);
    strips.splice(3, 1, ['body', neckY - overlap, hipY + overlap, hipY, 0, bodyMask],
      ['hand', neckY - overlap, hipY + overlap, hipY - shoulder / size, shift, armMask]);
  }
  const regions = {}, attachments = {};
  const slots = strips.map(([name, top, bottom, pivot, x = 0, mask]) => {
    regions[name] = [0, top, width, bottom - top];
    const sole = name === 'leg_far' ? soles?.[0] : name === 'leg_near' ? soles?.[1] : null;
    const isLeg = name === 'feet' || name.startsWith('leg_');
    const localY = isLeg ? pivot - (height - soleY) : pivot;
    attachments[name] = { [name]: { x: -x, y: (localY - (top + bottom) / 2) * size,
      width: width * size, height: (bottom - top) * size, mask,
      ...(sole ? { sole: { x: (sole.x - width / 2) * size - x, y: (localY - sole.y) * size } } : {}),
    } };
    return { name, bone: name, attachment: name };
  });
  const bones = [{ name: 'feet' }, { name: 'body', parent: 'feet', y: (soleY - hipY) * size },
    { name: 'head', parent: 'body', y: (hipY - neckY) * size }];
  if (hand != null) bones.push({ name: 'hand', parent: 'body', x: shift, y: shoulder },
    { name: 'leg_far', parent: 'feet', x: -spread, y: shin }, { name: 'leg_near', parent: 'feet', x: spread, y: shin });
  bones.push({ name: 'effect_tip', parent: hand == null ? 'body' : 'hand',
    x: Math.min(36, width * size * .4) - shift, y: height * size * .28 - shoulder });
  const melee = ['guardian', 'fighter', 'assassin'].includes(spirit.role);
  const track = (duration, pivot, middle) => [{ time: 0, ...pivot }, { time: duration / 2, ...middle }, { time: duration, ...pivot }];
  const motion = (duration, x, y, turn, contact, end = {}) => ({
    bones: {
      feet: { translate: [{ time: 0, x: 0, y: 0 }, { time: contact ?? duration / 2, x, y }, { time: duration, x: end.x ?? 0, y: 0 }] },
      body: { rotate: [{ time: 0, value: 0 }, { time: contact ?? duration / 2, value: turn }, { time: duration, value: end.turn ?? 0 }] },
      head: { rotate: track(duration, { value: 0 }, { value: -turn * .82 }) },
      ...(hand == null ? {} : { hand: { rotate: [
        { time: 0, value: 0 }, { time: (contact ?? duration / 2) * .48, value: contact ? 5 : 0 },
        { time: contact ?? duration / 2, value: contact ? -9 + turn * .3 : -turn }, { time: duration, value: 0 },
      ] } }),
    },
    ...(contact ? { events: [{ time: contact, name: 'effect_contact' }] } : {}),
  });
  const gait = (duration, lift, lean) => {
    const clip = motion(duration, 0, lift, -lean);
    clip.bones.feet.translate = [0, .25, .5, .75, 1].map((beat, i) => ({
      time: duration * beat, x: [0, 1.5, 0, -1.5, 0][i], y: i % 2 ? lift : 0,
    }));
    clip.bones.body.rotate = track(duration, { value: -lean }, { value: -lean * .4 });
    if (hand != null) {
      for (const [leg, sign] of [['leg_far', 1], ['leg_near', -1]]) {
        clip.bones[leg] = { rotate: [0, .25, .5, .75, 1].map((beat, i) => ({
          time: duration * beat, value: [0, 4 * sign, 0, -4 * sign, 0][i],
        })) };
      }
    }
    return clip;
  };
  const animations = {
    idle: motion(1.8, 0, .75, 1), walk: gait(.58, 1.7, 2.5), run: gait(.40, 2.25, 4),
    attack_a: motion(.54, melee ? 8 : 2, 1, melee ? -12 : -4, .28),
    attack_b: motion(.56, melee ? 6 : 2, 2, melee ? -9 : 4, .29),
    skill_01: motion(.72, 3, 3, -6, .39), ultimate_01: motion(.93, 6, 5, -9, .50),
    hit: motion(.30, -4, 0, 8), victory: motion(1.0, 0, 6, -3), defeat: motion(.59, -4, 0, 14, null, { x: -6, turn: 34 }),
  };
  return [{ bones, slots, skins: [{ name: 'default', attachments }], animations }, regions];
}
