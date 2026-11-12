const ASSETS = './assets/original/rigs/bunbo/';
const RAD = Math.PI / 180;
const clamp = value => Math.max(0, Math.min(1, value));

function trackValue(keys, time, property) {
  if (!keys?.length || time < keys[0].time) return 0;
  const end = keys.findIndex(key => key.time > time);
  if (end < 0) return keys.at(-1)[property] ?? 0;
  const from = keys[end - 1];
  const to = keys[end];
  const start = from[property] ?? 0;
  return start + ((to[property] ?? 0) - start) * (time - from.time) / (to.time - from.time);
}

export class BunBoBattleRig {
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
    this.tip = indexes.get('blade_tip');
    if (this.tip === undefined) throw new Error('Missing blade socket');
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
        Object.values(tracks).map(keys => keys.at(-1).time)));
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid rig timeline');
      const contact = animation.events?.find(event => event.name === 'blade_contact')?.time;
      return [id, { duration, contact, tracks: animation.bones }];
    }));
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

  draw(ctx, motion, x, y, direction, scale) {
    const clip = this.clips[motion.id];
    if (!clip) return false;
    const pose = this.pose(clip, motion.phase);
    ctx.save();
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

  bladeTip(id, x, y, direction, scale, reducedMotion = false) {
    const clip = this.clips[id];
    if (!clip?.contact) return null;
    const joint = this.pose(clip, reducedMotion ? 0 : clip.contact / clip.duration)[this.tip];
    return { x: x + joint.x * (direction === 'W' ? -scale : scale), y: y - joint.y * scale };
  }
}

export class BattleRigClock {
  constructor(rig, tickRate) {
    this.rig = rig;
    this.tickRate = tickRate;
    this.lastContact = null;
  }

  contact(battle, id) {
    const clip = this.rig.clips[id];
    if (!clip?.contact || (this.lastContact?.battle === battle && this.lastContact.tick === battle.tick)) return false;
    this.lastContact = { id, clip, battle, tick: battle.tick };
    return true;
  }

  motion(battle, actor, animation) {
    if (this.lastContact?.battle !== battle) this.lastContact = null;
    const fallback = { id: animation?.requestedClipId ?? (actor.alive ? 'idle' : 'defeat'), phase: animation?.motionPhase ?? 0 };
    if (animation?.motionPhase == null) return fallback;
    const { action } = actor;
    if (actor.alive && battle.phase === 'battle_running' && action) {
      const id = action.clip ?? (action.sourceKind === 'ultimate' ? 'ultimate_01' : 'attack_a');
      const clip = this.rig.clips[id];
      if (clip?.contact) {
        const windupPhase = clamp((battle.tick - action.launchTick + action.windup) / Math.max(1, action.windup));
        return { id, phase: windupPhase * clip.contact / clip.duration };
      }
    }
    const previous = this.lastContact;
    if (previous && actor.alive && battle.phase === 'battle_running' && animation.requestedClipId !== 'hit') {
      const { id, clip, tick } = previous;
      const time = clip.contact + (battle.tick - tick) / this.tickRate;
      if (battle.tick >= tick && time < clip.duration) return { id, phase: time / clip.duration };
    }
    return fallback;
  }
}

export async function loadBunBoRig(renderer, signal) {
  async function json(name) {
    const response = await fetch(ASSETS + name, { signal });
    if (!response.ok) throw new Error('Could not load Bún Bò rig');
    return response.json();
  }
  try {
    const [data, regions, image] = await Promise.all([
      json('bunbo.json'), json('regions.json'), renderer.loadImage(ASSETS + 'parts.webp'),
    ]);
    return image && new BunBoBattleRig(data, regions, image);
  } catch {
    return null;
  }
}
