import { cutinArt, ELEMENT_ART, HERO_NAMES } from './spriteAssets.js';
import { drawElementEffect } from './elementEffects.js';

export class BattleEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.effects = [];
  }

  handle({ type, payload, source_id, target_id, tick, battle_id }, battle) {
    if (!battle || battle_id !== battle.id) return;
    if (type === 'battle_started' || type === 'wave_completed') this.effects = [];
    const source = battle.actors.find((actor) => actor.actor_id === source_id);
    const target = battle.actors.find((actor) => actor.actor_id === target_id);
    const element = payload.element ?? source?.element;

    if (type === 'projectile_spawned') {
      this.add('projectile', element, payload.travel_ticks / 30 + .14, {
        from: payload.source, to: payload.target, targetId: target_id, tick, travelTicks: payload.travel_ticks,
      });
    } else if (type === 'attack_started' && source && target && !payload.travel_ticks) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      this.add('strike', element, Math.max(.18, payload.windup_ticks / 30), {
        x: source.x + dx * .46, y: source.y + dy * .46 - 43, angle: Math.atan2(dy, dx),
      });
    } else if (type === 'cast_started' && source) {
      this.add('cast', element, Math.max(.38, payload.windup_ticks / 30), { x: source.x, y: source.y - 35 });
      if (Object.hasOwn(HERO_NAMES, source_id)) {
        this.effects = this.effects.filter((effect) => effect.type !== 'cutin');
        this.add('cutin', element, .63, { id: source_id, text: payload.name });
      }
    } else if (target && ['hit_resolved', 'heal_resolved', 'shield_applied'].includes(type)) {
      const text = type === 'heal_resolved' ? '+' + payload.amount
        : type === 'shield_applied' ? 'Hộ thuẫn +' + payload.amount
          : payload.hp_damage ? '−' + payload.hp_damage : 'Chặn đòn';
      this.add('impact', element, .72, {
        x: target.x, y: target.y - 45, text,
        strong: type !== 'hit_resolved' || ['ultimate', 'boss_telegraph'].includes(payload.source_kind),
      });
    }
  }

  add(type, element, duration, data) {
    this.effects.push({ type, element, elapsed: 0, duration, ...data });
  }

  advance(delta) {
    for (const effect of this.effects) effect.elapsed += delta;
    this.effects = this.effects.filter((effect) => effect.elapsed < effect.duration);
  }

  draw(context, battle, reducedMotion) {
    let cutin;
    for (const effect of this.effects) {
      const progress = effect.elapsed / effect.duration;
      const fade = Math.min(1, (1 - progress) * 2.5);
      const color = ELEMENT_ART[effect.element]?.color ?? '#fff3d4';
      if (effect.type === 'cutin') {
        cutin = effect;
      } else if (effect.type === 'projectile') {
        const travel = (battle.tick - effect.tick) / effect.travelTicks;
        if (travel >= 1) continue;
        const target = battle.actors.find((actor) => actor.actor_id === effect.targetId && actor.alive) ?? effect.to;
        const dx = target.x - effect.from.x;
        const dy = target.y - effect.from.y;
        const x = effect.from.x + dx * travel;
        const y = effect.from.y - 42 + dy * travel - Math.sin(Math.PI * travel) * 20;
        drawElementEffect(context, this.renderer, effect.element, 'trail', {
          x, y, size: 96, angle: Math.atan2(dy, dx), opacity: .95,
        });
      } else {
        const strike = effect.type === 'strike';
        const size = strike ? 88 : effect.strong ? 144 : effect.type === 'cast' ? 104 : 85;
        const growth = reducedMotion ? 1 : .78 + progress * .42;
        drawElementEffect(context, this.renderer, effect.element, strike ? 'trail' : 'impact', {
          x: effect.x, y: effect.y, size: size * growth, opacity: fade, angle: effect.angle,
        });
        if (!effect.text) continue;
        context.save();
        context.globalAlpha = fade;
        context.textAlign = 'center';
        context.font = effect.strong ? '800 23px system-ui' : '700 17px system-ui';
        context.strokeStyle = '#14211e';
        context.lineWidth = 4;
        const y = effect.y - 21 - (reducedMotion ? 0 : progress * 30);
        context.strokeText(effect.text, effect.x, y);
        context.fillStyle = color;
        context.fillText(effect.text, effect.x, y);
        context.restore();
      }
    }
    if (cutin && !reducedMotion) this.drawCutin(context, cutin, cutin.elapsed / cutin.duration);
  }

  drawCutin(context, effect, progress) {
    const palette = ELEMENT_ART[effect.element] ?? ELEMENT_ART.light;
    const image = this.renderer.images.get(cutinArt(effect.id));
    const width = image?.naturalWidth ? 435 * image.naturalWidth / image.naturalHeight : 0;
    context.save();
    context.globalAlpha = Math.min(1, progress * 12, (1 - progress) * 8);
    const gradient = context.createLinearGradient(0, 0, 960, 0);
    gradient.addColorStop(0, '#210c18ed');
    gradient.addColorStop(1, palette.dark + 'dd');
    context.fillStyle = gradient;
    context.fillRect(0, 110, 960, 309);
    if (width) this.renderer.drawImage(context, cutinArt(effect.id), 744 - width / 2 + (1 - progress) * 42, 53, width, 435);
    context.fillStyle = palette.color;
    context.font = '700 20px system-ui';
    context.fillText(HERO_NAMES[effect.id].toLocaleUpperCase('vi'), 52, 246);
    context.fillStyle = '#fff1cd';
    context.font = '800 43px Georgia';
    context.fillText(effect.text, 52, 301, 500);
    context.restore();
  }
}
