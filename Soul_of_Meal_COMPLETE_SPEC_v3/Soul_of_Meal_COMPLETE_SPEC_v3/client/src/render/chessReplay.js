import { chessHexOffset } from '../modes/chessCombat.js';
import { ClipPlayer } from './clipPlayer.js';
import { actorArt, ELEMENT_ART, sceneArt } from './spriteAssets.js';
import { drawCombatAccent, drawCombatTrail } from './combatVfx.js';
import { rigMotion } from './spiritRig.js';
import { canvasContext, canvasResolution } from './canvasSurface.js';

const ATTACK_LEAD = .20;
const FALL_DURATION = .36;
const REPLAY_WIDTH = 760;
const REPLAY_HEIGHT = 480;

export class ChessReplay {
  constructor(combat, renderer, reducedMotion) {
    this.combat = combat;
    this.hex = combat.geometry === 'hex';
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.actors = new Map(combat.startActors.map((actor) => {
      return [actor.actorId, {
        ...actor, viewX: actor.x, viewY: actor.y, attackCount: 0, preparedHit: -1,
        player: new ClipPlayer(renderer.sheets.get(actor.id)?.manifest, { direction: actor.team === 'player' ? 'E' : 'W', reducedMotion }),
      }];
    }));
    this.duration = Math.max(2, Math.min(7, combat.tick / 38));
    this.elapsed = 0;
    this.eventIndex = 0;
    this.impacts = [];
    this.approaching = [];
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = reducedMotion;
    for (const actor of this.actors.values()) actor.player.reducedMotion = reducedMotion;
  }

  advance(delta, onCue) {
    this.elapsed = Math.min(this.duration + .42, this.elapsed + delta);
    const tick = Math.min(this.combat.tick, Math.floor(this.elapsed * this.combat.tick / this.duration));
    while (this.combat.events[this.eventIndex]?.tick <= tick) {
      const index = this.eventIndex++;
      const event = this.combat.events[index];
      const source = this.actors.get(event.source_id);
      if (event.type === 'move') {
        if (event.x !== source.x) source.player.setDirection(event.x > source.x ? 'E' : 'W');
        source.x = event.x;
        source.y = event.y;
        source.player.play('walk', { restart: false });
      } else if (event.type === 'hit_resolved') {
        const target = this.actors.get(event.target_id);
        const { hp, damage, absorbed = 0, sourceMana, targetMana, shield } = event.payload;
        target.hp = hp;
        if (Number.isFinite(sourceMana)) source.mana = sourceMana;
        if (Number.isFinite(targetMana)) target.mana = targetMana;
        if (Number.isFinite(shield)) target.shield = shield;
        this.prepareAttack(source, target, index);
        target.player.play(target.hp ? 'hit' : 'defeat', { force: true });
        if (target.hp <= 0) target.fallUntil = this.elapsed + FALL_DURATION;
        this.impacts.push({ targetId: target.actorId, text: damage > absorbed ? '−' + (damage - absorbed) : 'Chặn',
          element: source.element, kind: hp <= 0 ? 'defeat' : damage <= absorbed ? 'guard' : event.payload.skill ? 'cast' : 'hit',
          start: this.elapsed, end: this.elapsed + .38 });
        onCue({ type: 'hit_resolved', payload: { element: source.element, absorbed, hp_damage: damage - absorbed } });
      } else if (event.type === 'ability') {
        const target = this.actors.get(event.target_id);
        const { amount, hp, shield, sourceMana } = event.payload;
        source.mana = sourceMana;
        target.hp = hp;
        target.shield = shield;
        source.player.play('skill_01', { force: true });
        this.impacts.push({ targetId: target.actorId, text: amount ? '+' + amount : '', element: source.element,
          kind: source.job === 'guardian' ? 'shield' : 'heal', start: this.elapsed, end: this.elapsed + .45 });
        onCue({ type: 'cast_started', payload: { element: source.element } });
      }
    }
    this.trackApproachingAttacks(onCue);
    this.impacts = this.impacts.filter((impact) => impact.end > this.elapsed);
    for (const actor of this.actors.values()) {
      const fraction = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 19);
      actor.viewX += (actor.x - actor.viewX) * fraction;
      actor.viewY += (actor.y - actor.viewY) * fraction;
      actor.player.advance(delta * 1000);
      if (actor.hp > 0 && Math.abs(actor.x - actor.viewX) + Math.abs(actor.y - actor.viewY) < .015) {
        actor.player.play('idle', { restart: false });
      }
    }
    return this.elapsed >= this.duration + .42;
  }

  draw(canvas) {
    const resolution = canvasResolution(canvas, REPLAY_WIDTH, REPLAY_HEIGHT, true);
    const context = canvasContext(canvas, resolution, REPLAY_WIDTH, REPLAY_HEIGHT);
    if (!context) return;
    context.fillStyle = '#182d27';
    context.fillRect(0, 0, REPLAY_WIDTH, REPLAY_HEIGHT);
    this.renderer.drawImage(context, sceneArt('chess_court'), 0, 0, REPLAY_WIDTH, REPLAY_HEIGHT);
    for (const actor of [...this.actors.values()].sort((a, b) => b.viewY - a.viewY)) {
      const standing = actor.hp > 0;
      if (!standing && (this.reducedMotion || !(actor.fallUntil > this.elapsed))) continue;
      const opacity = standing ? 1 : (actor.fallUntil - this.elapsed) / FALL_DURATION;
      const { x, y } = boardPoint(actor.viewX, actor.viewY, this.hex);
      const animation = actor.player.snapshot();
      const rig = this.renderer.rigs?.get(actor.id);
      const clip = rig?.clips[animation.requestedClipId];
      const timing = actor.timing?.id === animation.requestedClipId ? actor.timing : null;
      const phase = rigMotion(clip, animation.motionPhase, timing, this.elapsed * 1000);
      if (standing) {
        context.beginPath();
        context.ellipse(x, y + 11, 23, 6, 0, 0, Math.PI * 2);
        context.fillStyle = '#14271fcc';
        context.fill();
        context.strokeStyle = actor.team === 'player' ? '#afe4b5bf' : '#ffae89bf';
        context.stroke();
      }
      const drawn = (clip && rig.draw(context, { id: animation.requestedClipId, phase }, x, y + 9, animation.direction, .59, opacity))
        || this.renderer.drawSprite(context, actor.id, animation, x, y + 9, { scale: .43, opacity });
      if (!drawn) {
        const asset = actorArt(actor.id);
        const image = this.renderer.images.get(asset);
        if (image?.naturalWidth) {
          const scale = Math.min(55 / image.naturalWidth, 53 / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          context.save();
          context.globalAlpha = opacity;
          this.renderer.drawImage(context, asset, x - width / 2, y + 9 - height, width, height);
          context.restore();
        }
      }
      if (!standing) continue;
      context.fillStyle = '#151f1c';
      context.fillRect(x - 19, y + 17, 38, 5);
      context.fillStyle = actor.team === 'player' ? '#a6e3a5' : '#ff977b';
      context.fillRect(x - 18, y + 18, 36 * actor.hp / actor.maxHp, 3);
      if (this.hex) {
        context.fillStyle = '#162727';
        context.fillRect(x - 19, y + 22, 38, 4);
        context.fillStyle = '#7ccbe6';
        context.fillRect(x - 18, y + 23, 36 * actor.mana / 100, 2);
        if (actor.shield > 0) {
          context.strokeStyle = '#f6d891c7';
          context.beginPath();
          context.ellipse(x, y - 10, 24, 31, 0, 0, Math.PI * 2);
          context.stroke();
        }
      }
    }
    if (!this.reducedMotion) this.drawApproachingAttacks(context);
    for (const effect of this.impacts) {
      const target = this.actors.get(effect.targetId);
      const { x, y } = boardPoint(target.viewX, target.viewY, this.hex);
      const progress = (this.elapsed - effect.start) / (effect.end - effect.start);
      context.save();
      drawCombatAccent(context, this.renderer, { ...effect, x, y: y - 23,
        size: ['cast', 'shield'].includes(effect.kind) ? 74 : 51, progress, reducedMotion: this.reducedMotion });
      context.globalAlpha = Math.min(1, (1 - progress) * 2);
      context.textAlign = 'center';
      context.font = '800 18px system-ui';
      context.strokeStyle = '#172321';
      context.lineWidth = 4;
      const textY = y - 36 - (this.reducedMotion ? 0 : progress * 16);
      context.strokeText(effect.text, x, textY);
      context.fillStyle = ELEMENT_ART[effect.element]?.color ?? '#fff5d7';
      context.fillText(effect.text, x, textY);
      context.restore();
    }
  }

  prepareAttack(actor, target, eventIndex) {
    if (actor.preparedHit === eventIndex) return;
    actor.preparedHit = eventIndex;
    if (target.x !== actor.x) actor.player.setDirection(target.x > actor.x ? 'E' : 'W');
    const skill = this.combat.events[eventIndex].payload.skill;
    const clip = skill ? 'skill_01' : actor.attackCount++ % 2 === 0 ? 'attack_a' : 'attack_b';
    const contact = this.combat.events[eventIndex].tick * this.duration / this.combat.tick;
    actor.timing = { id: clip, start: (contact - ATTACK_LEAD) * 1000, contact: contact * 1000 };
    actor.player.play(clip, { force: true });
    return clip;
  }

  trackApproachingAttacks(onCue) {
    this.approaching = [];
    const preparing = new Set();
    for (let index = this.eventIndex; index < this.combat.events.length; index += 1) {
      const event = this.combat.events[index];
      const contact = event.tick * this.duration / this.combat.tick;
      if (contact > this.elapsed + ATTACK_LEAD) break;
      if (event.type !== 'hit_resolved') continue;
      const source = this.actors.get(event.source_id);
      const target = this.actors.get(event.target_id);
      if (!source || !target || source.hp <= 0 || target.hp <= 0 || preparing.has(source.actorId)) continue;
      preparing.add(source.actorId);
      const clip = this.prepareAttack(source, target, index);
      if (clip) onCue({
        type: clip === 'skill_01' ? 'cast_started' : ['mage', 'ranged', 'support'].includes(source.job) ? 'spell_launched' : 'attack_started',
        payload: { element: source.element, clip_id: clip },
      });
      this.approaching.push({ source, target, contact });
    }
  }

  drawApproachingAttacks(context) {
    for (const { source, target, contact } of this.approaching) {
      const from = boardPoint(source.viewX, source.viewY, this.hex);
      const to = boardPoint(target.viewX, target.viewY, this.hex);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const progress = Math.max(0, 1 - (contact - this.elapsed) / ATTACK_LEAD);
      const ranged = ['mage', 'ranged', 'support'].includes(source.job);
      const skill = source.timing?.id === 'skill_01';
      const point = { x: from.x, y: from.y - 21 };
      if (progress < .42 && skill) drawCombatAccent(context, this.renderer, {
        element: source.element, kind: 'charge', ...point, size: 57, progress: progress / .42,
      });
      if (ranged) {
        drawCombatTrail(context, this.renderer, { element: source.element, from: point, to: { x: to.x, y: to.y - 21 },
          size: skill ? 67 : 48, progress, arc: skill ? 22 : 9 });
      } else if (progress >= .56) drawCombatAccent(context, this.renderer, {
        element: source.element, kind: 'slash', x: from.x + dx * progress, y: from.y + dy * progress - 21,
        size: skill ? 78 : 59, progress: (progress - .56) * 1.6, angle: Math.atan2(dy, dx),
      });
    }
  }
}

function boardPoint(x, y, hex = false) {
  if (!hex) return { x: 104 + x * 92, y: 72 + (7 - y) * 49 };
  const row = Math.floor(y);
  const shift = chessHexOffset(row) * (row + 1 - y) + chessHexOffset(row + 1) * (y - row);
  return { x: 83 + (x + shift) * 90, y: 72 + (7 - y) * 49 };
}
