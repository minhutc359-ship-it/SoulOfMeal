import { ClipPlayer } from './clipPlayer.js';
import { ASSET_PATHS, BATTLE_HERO, CINEMATIC, GOLDEN_HERO } from './spriteAssets.js';

const COLORS = { fire: '#ffad7b', water: '#94dcff', wood: '#b8e69c', light: '#fff0ae', shadow: '#d4b8ff' };
const ELEMENT_TEXTURES = { fire: 'fire_burst', water: 'water_splash', wood: 'leaf_swirl', light: 'light_flash', shadow: 'shadow_fade' };

export class ChessReplay {
  constructor(combat, renderer, reducedMotion) {
    this.combat = combat;
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.actors = new Map(combat.startActors.map((actor) => {
      const visualId = actor.id === GOLDEN_HERO && actor.team === 'player' && renderer.isLoaded(BATTLE_HERO) ? BATTLE_HERO : actor.id;
      return [actor.actorId, {
        ...actor, visualId, viewX: actor.x, viewY: actor.y,
        player: new ClipPlayer(renderer.sheets.get(visualId)?.manifest, { direction: actor.team === 'player' ? 'E' : 'W', reducedMotion }),
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
    }
    return this.elapsed >= this.duration + .42;
  }

  draw(canvas) {
    const context = canvas.getContext('2d');
    context.fillStyle = '#182d27';
    context.fillRect(0, 0, 760, 480);
    this.renderer.drawImage(context, CINEMATIC + 'arena.webp', 0, 0, 760, 480);
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
      const scale = actor.visualId === BATTLE_HERO ? .24 : actor.id === GOLDEN_HERO ? .39 : .9;
      const drawn = this.renderer.drawSprite(context, actor.visualId, actor.player.snapshot(), x, y + 9, { scale, flipX: actor.team === 'enemy' });
      if (!drawn) {
        const asset = ({ mob_mushroom_01: CINEMATIC + 'mushroom.webp', mob_pepper_01: CINEMATIC + 'pepper.webp' })[actor.id] ?? ASSET_PATHS.avatars + '/avatar_lilia.png';
        this.renderer.drawImage(context, asset, x - 21, y - 36, 42, 42);
      }
      context.fillStyle = '#151f1c';
      context.fillRect(x - 23, y - 46, 46, 5);
      context.fillStyle = actor.team === 'player' ? '#a6e3a5' : '#ff977b';
      context.fillRect(x - 22, y - 45, 44 * actor.hp / actor.maxHp, 3);
    }
    for (const effect of this.impacts) {
      const target = this.actors.get(effect.targetId);
      const { x, y } = boardPoint(target.viewX, target.viewY);
      const progress = (effect.end - this.elapsed) / .38;
      context.save();
      context.globalAlpha = Math.min(1, progress * 2);
      this.renderer.drawImage(context, ASSET_PATHS.effects + '/' + ELEMENT_TEXTURES[effect.element] + '.png', x - 25, y - 46, 50, 50);
      context.textAlign = 'center';
      context.font = '800 18px system-ui';
      context.strokeStyle = '#172321';
      context.lineWidth = 4;
      const textY = y - 36 - (this.reducedMotion ? 0 : (1 - progress) * 16);
      context.strokeText('−' + effect.damage, x, textY);
      context.fillStyle = COLORS[effect.element];
      context.fillText('−' + effect.damage, x, textY);
      context.restore();
    }
  }
}

function boardPoint(x, y) {
  return { x: 171 + x * 70, y: 72 + (7 - y) * 49 };
}
