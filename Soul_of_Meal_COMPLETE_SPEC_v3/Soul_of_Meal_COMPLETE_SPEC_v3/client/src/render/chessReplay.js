import { ClipPlayer } from './clipPlayer.js';
import { actorArt, ELEMENT_ART, sceneArt } from './spriteAssets.js';
import { drawElementEffect } from './elementEffects.js';

export class ChessReplay {
  constructor(combat, renderer, reducedMotion) {
    this.combat = combat;
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.actors = new Map(combat.startActors.map((actor) => {
      return [actor.actorId, {
        ...actor, viewX: actor.x, viewY: actor.y,
        player: new ClipPlayer(renderer.sheets.get(actor.id)?.manifest, { direction: actor.team === 'player' ? 'E' : 'W', reducedMotion }),
      }];
    }));
    this.duration = Math.max(2, Math.min(7, combat.tick / 38));
    this.elapsed = 0;
    this.eventIndex = 0;
    this.impacts = [];
  }

  advance(delta, onImpact) {
    this.elapsed = Math.min(this.duration + .42, this.elapsed + delta);
    const tick = Math.min(this.combat.tick, Math.floor(this.elapsed * this.combat.tick / this.duration));
    while (this.combat.events[this.eventIndex]?.tick <= tick) {
      const event = this.combat.events[this.eventIndex++];
      const source = this.actors.get(event.source_id);
      if (event.type === 'move') {
        source.x = event.x;
        source.y = event.y;
        source.player.play('walk', { restart: false });
      } else if (event.type === 'hit_resolved') {
        const target = this.actors.get(event.target_id);
        target.hp = event.payload.hp;
        source.player.play('attack_a', { force: true });
        target.player.play(target.hp ? 'hit' : 'defeat', { force: true });
        this.impacts.push({ targetId: target.actorId, damage: event.payload.damage, element: source.element, end: this.elapsed + .38 });
        onImpact({ type: 'hit_resolved', payload: { element: source.element } });
      }
    }
    this.impacts = this.impacts.filter((impact) => impact.end > this.elapsed);
    for (const actor of this.actors.values()) {
      const fraction = this.reducedMotion ? 1 : Math.min(1, delta * 15);
      actor.viewX += (actor.x - actor.viewX) * fraction;
      actor.viewY += (actor.y - actor.viewY) * fraction;
      actor.player.advance(delta * 1000);
      if (Math.abs(actor.x - actor.viewX) + Math.abs(actor.y - actor.viewY) < .015) {
        actor.player.play('idle', { restart: false });
      }
    }
    return this.elapsed >= this.duration + .42;
  }

  draw(canvas) {
    const context = canvas.getContext('2d');
    context.fillStyle = '#182d27';
    context.fillRect(0, 0, 760, 480);
    this.renderer.drawImage(context, sceneArt('arena'), 0, 0, 760, 480);
    context.fillStyle = '#0d262577';
    context.fillRect(135, 46, 490, 396);
    for (let column = 0; column < 7; column += 1) {
      for (let row = 0; row < 8; row += 1) {
        const { x, y } = boardPoint(column, row);
        context.strokeStyle = row < 4 ? '#b5ecd071' : '#ffc29469';
        context.strokeRect(x - 34, y - 26, 68, 49);
      }
    }
    for (const actor of [...this.actors.values()].sort((a, b) => b.viewY - a.viewY)) {
      if (actor.hp <= 0) continue;
      const { x, y } = boardPoint(actor.viewX, actor.viewY);
      const drawn = this.renderer.drawSprite(context, actor.id, actor.player.snapshot(), x, y + 9, { scale: .36 });
      if (!drawn) {
        const asset = actorArt(actor.id);
        const image = this.renderer.images.get(asset);
        if (image?.naturalWidth) {
          const scale = Math.min(45 / image.naturalWidth, 44 / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          this.renderer.drawImage(context, asset, x - width / 2, y + 9 - height, width, height);
        }
      }
      context.fillStyle = '#151f1c';
      context.fillRect(x - 23, y - 46, 46, 5);
      context.fillStyle = actor.team === 'player' ? '#a6e3a5' : '#ff977b';
      context.fillRect(x - 22, y - 45, 44 * actor.hp / actor.maxHp, 3);
    }
    if (!this.reducedMotion) this.drawApproachingAttacks(context);
    for (const effect of this.impacts) {
      const target = this.actors.get(effect.targetId);
      const { x, y } = boardPoint(target.viewX, target.viewY);
      const progress = (effect.end - this.elapsed) / .38;
      context.save();
      context.globalAlpha = Math.min(1, progress * 2);
      drawElementEffect(context, this.renderer, effect.element, 'impact', {
        x, y: y - 23, size: 59 - progress * 12, opacity: Math.min(1, progress * 2),
      });
      context.textAlign = 'center';
      context.font = '800 18px system-ui';
      context.strokeStyle = '#172321';
      context.lineWidth = 4;
      const textY = y - 36 - (this.reducedMotion ? 0 : (1 - progress) * 16);
      context.strokeText('−' + effect.damage, x, textY);
      context.fillStyle = ELEMENT_ART[effect.element]?.color ?? '#fff5d7';
      context.fillText('−' + effect.damage, x, textY);
      context.restore();
    }
  }

  drawApproachingAttacks(context) {
    const lead = .20;
    for (let index = this.eventIndex; index < this.combat.events.length; index += 1) {
      const event = this.combat.events[index];
      const contact = event.tick * this.duration / this.combat.tick;
      if (contact > this.elapsed + lead) break;
      if (event.type !== 'hit_resolved') continue;
      const source = this.actors.get(event.source_id);
      const target = this.actors.get(event.target_id);
      if (!source || !target || source.hp <= 0 || target.hp <= 0) continue;
      const from = boardPoint(source.viewX, source.viewY);
      const to = boardPoint(target.viewX, target.viewY);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const progress = Math.max(0, 1 - (contact - this.elapsed) / lead);
      drawElementEffect(context, this.renderer, source.element, 'trail', {
        x: from.x + dx * progress, y: from.y + dy * progress - 21,
        size: 60, angle: Math.atan2(dy, dx), opacity: .86,
      });
    }
  }
}

function boardPoint(x, y) {
  return { x: 171 + x * 70, y: 72 + (7 - y) * 49 };
}
