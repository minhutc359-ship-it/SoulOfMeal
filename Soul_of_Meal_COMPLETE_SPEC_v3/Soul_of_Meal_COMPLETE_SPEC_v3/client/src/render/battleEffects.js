import { combatArt, cutinArt, ELEMENT_ART, HERO_NAMES } from './spriteAssets.js';
import { drawEffectTexture, drawElementEffect } from './elementEffects.js';
import { drawCombatAccent, drawCombatTrail } from './combatVfx.js';
import { findBattleTarget } from '../modes/adventure.js';
import { adventureViewport, battleActorPoint } from './adventureStage.js';

export class BattleEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.effects = [];
  }

  handle({ type, payload, source_id, target_id, tick, battle_id }, battle, origin) {
    if (!battle || battle_id !== battle.id) return;
    if (type === 'battle_started' || type === 'wave_completed') this.effects = [];
    const attacker = battle.actors.find((actor) => actor.actor_id === source_id);
    const defender = findBattleTarget(battle, target_id);
    const safeX = battle.bossTelegraph?.safeX;
    const source = attacker && battleActorPoint(attacker, 1, safeX);
    const target = defender && battleActorPoint(defender, 1, safeX);
    const element = payload.element ?? attacker?.element;

    if (type === 'projectile_spawned') {
      this.add('projectile', element, payload.travel_ticks / 30 + .14, {
        from: origin ?? { x: source?.x ?? payload.source.x, y: (source?.y ?? payload.source.y) - 42 },
        to: target ?? payload.target, targetId: target_id, tick, travelTicks: payload.travel_ticks,
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
    } else if (type === 'enemy_skill_released' && source) {
      const { x, y } = payload.aim ?? target ?? source;
      this.add('shockwave', element, .58, { x, y, radius: payload.radius ?? 56 });
    } else if (type === 'boss_cast_released' && source) {
      if (payload.safeX != null) {
        this.add('tide', element, .92, { x: payload.safeX, y: source.y });
      } else {
        this.add('shockwave', element, .95, { x: source.x, y: source.y, radius: 190 });
        if (element === 'fire') {
          const flipX = attacker.direction !== 'E';
          this.add('boss_cleave', element, .52, { x: source.x + (flipX ? -66 : 66), y: source.y - 54, flipX });
        }
      }
    } else if (type === 'boss_stove_destroyed' && target) {
      this.add('impact', element, .65, { x: target.x, y: target.y - 32, text: 'Bếp vỡ', strong: true });
    } else if (type === 'boss_cast_interrupted' && source) {
      this.add('impact', 'light', .85, { x: source.x, y: source.y - 76, text: 'Ngắt chiêu!', strong: true });
    } else if (type === 'lantern_ward_activated' && source) {
      this.add('impact', 'light', .75, { x: source.x - 175, y: source.y - 132, text: 'Đèn Giữ Vị' });
    } else if (type === 'actor_died' && target) {
      this.add('defeat', defender.element, .64, { x: target.x, y: target.y - 12 });
    } else if (type === 'shield_broken' && target) {
      this.add('shield_break', 'light', .38, { x: target.x, y: target.y - 39 });
    } else if (target && ['hit_resolved', 'heal_resolved', 'shield_applied'].includes(type)) {
      if (payload.guarded && this.effects.some(effect => effect.guarded)) return;
      const text = type === 'heal_resolved' ? '+' + payload.amount
        : type === 'shield_applied' ? 'Hộ thuẫn +' + payload.amount
          : payload.hp_damage ? '−' + payload.hp_damage : payload.guarded ? 'Hộ thuẫn bếp' : 'Chặn đòn';
      this.add('impact', element, .72, {
        x: target.x, y: target.y - (defender.stove ? 27 : 42), text, guarded: payload.guarded,
        accent: type === 'heal_resolved' ? 'heal' : type === 'shield_applied' ? 'shield'
          : payload.guarded || !payload.hp_damage ? 'guard' : 'hit',
        strong: type !== 'hit_resolved' || ['ultimate', 'boss_telegraph', 'enemy_skill'].includes(payload.source_kind),
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

  draw(context, battle, reducedMotion, view = adventureViewport(false), fraction = 0, blend = 1, effectsLimited = false) {
    let cutin;
    for (const effect of this.effects) {
      const progress = effect.elapsed / effect.duration;
      const fade = Math.min(1, (1 - progress) * 2.5);
      const color = ELEMENT_ART[effect.element]?.color ?? '#fff3d4';
      if (effect.type === 'cutin') {
        cutin = effect;
      } else if (effect.type === 'projectile') {
        const travel = (battle.tick - effect.tick + fraction) / effect.travelTicks;
        if (travel >= 1) continue;
        const tracked = findBattleTarget(battle, effect.targetId);
        const target = tracked?.alive ? battleActorPoint(tracked, blend, battle.bossTelegraph?.safeX) : effect.to;
        const to = { x: target.x, y: target.y - (tracked?.stove ? 26 : 42) };
        if (reducedMotion) {
          const x = travel < .65 ? effect.from.x : to.x;
          const y = travel < .65 ? effect.from.y : to.y;
          drawElementEffect(context, this.renderer, effect.element, 'trail', { x, y, size: 65, opacity: .6 });
        } else drawCombatTrail(context, this.renderer, {
          element: effect.element, from: effect.from, to, progress: travel, size: 81, arc: 20,
        });
      } else if (effect.type === 'tide') {
        const x = reducedMotion ? effect.x + 35 : 960 + (effect.x - 960) * progress;
        context.save();
        context.globalAlpha = fade * .52;
        const wash = context.createLinearGradient(effect.x, 0, 960, 0);
        wash.addColorStop(0, 'transparent');
        wash.addColorStop(.36, color);
        wash.addColorStop(1, '#a5f2ff');
        context.fillStyle = wash;
        context.fillRect(effect.x, 220, 960 - effect.x, 320);
        context.restore();
        for (const y of [275, 372, 468]) {
          drawElementEffect(context, this.renderer, effect.element, 'impact', { x, y, size: 180, opacity: fade * .86 });
        }
      } else if (effect.type === 'shockwave' || effect.type === 'defeat') {
        drawCombatAccent(context, this.renderer, { ...effect, kind: effect.type === 'defeat' ? 'defeat' : 'cast',
          size: effect.radius ? effect.radius * 1.46 : 69, progress, reducedMotion, effectsLimited });
      } else if (effect.type === 'boss_cleave' || effect.type === 'shield_break') {
        const size = (effect.type === 'boss_cleave' ? 220 : 90) * (reducedMotion ? 1 : .78 + .35 * progress);
        const options = { x: effect.x, y: effect.y, size, flipX: effect.flipX, opacity: fade };
        if (!drawEffectTexture(context, this.renderer, combatArt(effect.type), options)) {
          drawElementEffect(context, this.renderer, effect.element, 'impact', options);
        }
      } else {
        const strike = effect.type === 'strike';
        const size = strike ? 84 : effect.strong ? 120 : effect.type === 'cast' ? 86 : 64;
        drawCombatAccent(context, this.renderer, { ...effect, size, progress, reducedMotion, effectsLimited,
          kind: effect.accent ?? (strike ? 'slash' : effect.type === 'cast' ? 'charge' : 'hit'),
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
    if (cutin && !reducedMotion) this.drawCutin(context, cutin, cutin.elapsed / cutin.duration, view);
  }

  drawCutin(context, effect, progress, view) {
    const palette = ELEMENT_ART[effect.element] ?? ELEMENT_ART.light;
    const image = this.renderer.images.get(cutinArt(effect.id));
    const center = view.top + view.height / 2;
    const height = Math.min(435, view.height);
    const band = Math.min(309, view.height * .82);
    const width = image?.naturalWidth ? height * image.naturalWidth / image.naturalHeight : 0;
    const textX = view.left + 45;
    context.save();
    context.globalAlpha = Math.min(1, progress * 12, (1 - progress) * 8);
    const gradient = context.createLinearGradient(0, 0, 960, 0);
    gradient.addColorStop(0, '#210c18ed');
    gradient.addColorStop(1, palette.dark + 'dd');
    context.fillStyle = gradient;
    context.fillRect(view.left, center - band / 2, view.width, band);
    if (width) this.renderer.drawImage(context, cutinArt(effect.id), view.left + view.width * .78 - width / 2 + (1 - progress) * 42,
      center - height / 2, width, height);
    context.fillStyle = palette.color;
    context.font = '700 20px system-ui';
    context.fillText(HERO_NAMES[effect.id].toLocaleUpperCase('vi'), textX, center - 24);
    context.fillStyle = '#fff1cd';
    context.font = '800 43px Georgia';
    context.fillText(effect.text, textX, center + 31, view.width * .53);
    context.restore();
  }
}
