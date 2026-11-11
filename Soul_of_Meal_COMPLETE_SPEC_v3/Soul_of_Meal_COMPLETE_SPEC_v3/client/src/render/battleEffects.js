import { CINEMATIC, ASSET_PATHS } from './spriteAssets.js';

const ELEMENTS = {
  fire: ['fire_burst', '#ffae69'],
  water: ['water_splash', '#a5e8ff'],
  wood: ['leaf_swirl', '#b9ef8e'],
  light: ['light_flash', '#ffedaa'],
  shadow: ['shadow_fade', '#d7b6ff'],
};

export class BattleEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.effects = [];
  }

  handle(event, battle) {
    if (!battle || event.battle_id !== battle.id) return;
    const { type, payload, source_id, target_id } = event;
    if (type === 'battle_started' || type === 'wave_completed') this.effects = [];
    if (type === 'projectile_spawned') {
      this.effects.push({ type: 'projectile', element: payload.element, from: payload.source, to: payload.target, targetId: target_id, elapsed: 0, duration: payload.travel_ticks / 30 });
    }
    const target = battle.actors.find((actor) => actor.actor_id === target_id);
    if (target && ['hit_resolved', 'heal_resolved', 'shield_applied'].includes(type)) {
      const text = type === 'heal_resolved' ? '+' + payload.amount
        : type === 'shield_applied' ? 'Hộ thuẫn +' + payload.amount
          : payload.hp_damage ? '−' + payload.hp_damage : 'Chặn đòn';
      this.effects.push({ type, element: payload.element, x: target.x, y: target.y - 45, text, elapsed: 0, duration: .72, strong: payload.source_kind === 'ultimate' });
    }
    if (type === 'cast_started') {
      const source = battle.actors.find((actor) => actor.actor_id === source_id);
      if (source) this.effects.push({ type: 'cast', element: payload.element, x: source.x, y: source.y - 21, elapsed: 0, duration: Math.max(.38, payload.windup_ticks / 30) });
      if (source_id === 'chr_bunbo_holinh') this.effects.push({ type: 'cutin', text: payload.name, elapsed: 0, duration: .7 });
    }
  }

  advance(delta) {
    for (const effect of this.effects) effect.elapsed += delta;
    this.effects = this.effects.filter((effect) => effect.elapsed < effect.duration);
  }

  draw(context, battle, reducedMotion) {
    for (const effect of this.effects) {
      const progress = effect.elapsed / effect.duration;
      const [texture, color] = ELEMENTS[effect.element] ?? ['hit_spark', '#fff3d4'];
      if (effect.type === 'cutin') {
        if (!reducedMotion) this.drawCutin(context, effect, progress);
        continue;
      }
      context.save();
      context.globalAlpha = Math.min(1, (1 - progress) * 2.5);
      if (effect.type === 'projectile') {
        const target = battle.actors.find((actor) => actor.actor_id === effect.targetId && actor.alive) ?? effect.to;
        const x = effect.from.x + (target.x - effect.from.x) * progress;
        const y = effect.from.y - 42 + (target.y - effect.from.y) * progress - Math.sin(Math.PI * progress) * 27;
        const fire = effect.element === 'fire' && this.drawFire(context, 'projectile', effect.elapsed, x, y, .68);
        if (!fire) this.renderer.drawImage(context, ASSET_PATHS.effects + '/' + texture + '.png', x - 30, y - 30, 60, 60);
      } else {
        const radius = effect.strong ? 118 : effect.type === 'cast' ? 90 : 68;
        const fireClip = effect.type === 'cast' ? 'ring' : 'burst';
        const fire = effect.element === 'fire' && this.drawFire(context, fireClip, effect.elapsed, effect.x, effect.y, radius / 90);
        if (!fire) {
          const image = effect.type === 'heal_resolved' ? 'heal_glow' : texture;
          this.renderer.drawImage(context, ASSET_PATHS.effects + '/' + image + '.png', effect.x - radius / 2, effect.y - radius / 2, radius, radius);
        }
        if (effect.text) {
          context.textAlign = 'center';
          context.font = effect.strong ? '800 23px system-ui' : '700 17px system-ui';
          context.strokeStyle = '#14211e';
          context.lineWidth = 4;
          const textY = effect.y - 21 - (reducedMotion ? 0 : progress * 30);
          context.strokeText(effect.text, effect.x, textY);
          context.fillStyle = color;
          context.fillText(effect.text, effect.x, textY);
        }
      }
      context.restore();
    }
  }

  drawFire(context, clip, seconds, x, y, scale) {
    const entry = this.renderer.sheets.get('vfx_fire');
    const data = entry?.manifest?.clips?.[clip];
    if (!data) return false;
    const variant = data.directions.E;
    const index = Math.min(variant.frames.length - 1, Math.floor(seconds * data.fps));
    return this.renderer.drawSprite(context, 'vfx_fire', { frameId: variant.frames[index], anchor: variant.anchor_normalized }, x, y, { scale });
  }

  drawCutin(context, effect, progress) {
    context.save();
    context.globalAlpha = Math.min(1, progress * 12, (1 - progress) * 8);
    const gradient = context.createLinearGradient(0, 0, 960, 0);
    gradient.addColorStop(0, '#210c18e8');
    gradient.addColorStop(1, '#9a2c12b0');
    context.fillStyle = gradient;
    context.fillRect(0, 100, 960, 330);
    this.renderer.drawImage(context, CINEMATIC + 'cutin.webp', 440 + (1 - progress) * 80, 38, 470, 470);
    context.fillStyle = '#ffcb92';
    context.font = '700 20px system-ui';
    context.fillText('BÚN BÒ HỎA LINH', 52, 248);
    context.fillStyle = '#fff1cd';
    context.font = '800 46px Georgia';
    context.fillText(effect.text, 52, 303);
    context.restore();
  }
}
