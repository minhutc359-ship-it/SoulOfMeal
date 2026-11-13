import { drawElementEffect } from './elementEffects.js';
import { BOARD_SPRITE } from './boardSprites.js';
import { canvasContext, canvasResolution } from './canvasSurface.js';

function position(field, id, bounds, renderer, clip) {
  if (!id || !bounds.width || !bounds.height) return null;
  const cell = field.querySelector(`[data-duel-id="${CSS.escape(id)}"]`);
  if (!cell) return null;
  const rect = (cell.querySelector('.tcg-unit-avatar') ?? cell).getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;
  const sprite = clip && cell.querySelector('[data-chibi-id]');
  const rig = sprite && renderer.rigs?.get(sprite.dataset.chibiId);
  const { width, height, x: baseX, baseline, scale } = BOARD_SPRITE;
  const socket = rig?.effectPoint(clip, baseX, baseline, sprite.dataset.chibiFacing, scale);
  if (socket) {
    const box = sprite.getBoundingClientRect();
    const drawnWidth = Math.min(box.width, box.height * width / height);
    const drawnHeight = drawnWidth * height / width;
    x = box.left + (box.width - drawnWidth) / 2 + socket.x / width * drawnWidth;
    y = box.top + (box.height - drawnHeight) / 2 + socket.y / height * drawnHeight;
  }
  return { x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height };
}

export class DuelEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.attacks = [];
  }

  queue(field, event, now, reducedMotion, clip) {
    const bounds = field?.getBoundingClientRect();
    const { target_player, target_lane, ultimate, effect_kind } = event.payload;
    const support = event.type === 'tcg_support_resolved';
    const source = `commander:p${support ? target_player : 1 - target_player}`;
    const to = bounds && (position(field, event.target_id, bounds, this.renderer)
      ?? position(field, `lane:p${target_player}:${target_lane}`, bounds, this.renderer));
    const from = bounds && (position(field, event.source_id, bounds, this.renderer, clip)
      ?? (support ? to : position(field, source, bounds, this.renderer)));
    const animated = !reducedMotion && Boolean(from && to);
    const windup = ultimate ? 130 : support ? 55 : 60;
    const flight = ultimate ? 200 : support ? 112 : effect_kind ? 175 : 123;
    const contact = now + (animated ? windup + flight : 0);
    this.attacks.push({ from, to, now, contact, launch: now + windup, event });
    return contact;
  }

  paint(canvas, matchId, now, reducedMotion, onContact) {
    const active = [];
    for (const attack of this.attacks) {
      if (attack.event.battle_id !== matchId) continue;
      if (reducedMotion || !attack.from || !attack.to || now >= attack.contact) onContact(attack.event);
      else active.push(attack);
    }
    this.attacks = active;
    if (!canvas || (!active.length && canvas.hidden)) return;
    canvas.hidden = !active.length;
    if (!active.length) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const context = canvasContext(canvas, canvasResolution(canvas, width, height), width, height);
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const attack of active) {
      const { element, ultimate } = attack.event.payload;
      const t = Math.max(0, (now - attack.launch) / Math.max(1, attack.contact - attack.launch));
      const dx = (attack.to.x - attack.from.x) * width;
      const dy = (attack.to.y - attack.from.y) * height;
      if (now < attack.launch || Math.hypot(dx, dy) < 8) {
        const charge = Math.min(1, (now - attack.now) / Math.max(1, attack.launch - attack.now));
        drawElementEffect(context, this.renderer, element, 'impact', {
          x: attack.from.x * width, y: attack.from.y * height, size: (ultimate ? 66 : 40) * (.55 + charge * .45),
          opacity: .27 + charge * .43,
        });
        continue;
      }
      drawElementEffect(context, this.renderer, element, 'trail', {
        x: attack.from.x * width + dx * t, y: attack.from.y * height + dy * t,
        angle: Math.atan2(dy, dx), size: (ultimate ? 65 : 37) + Math.min(22, width * .035),
        opacity: Math.min(1, .35 + t * 2),
      });
    }
  }

  clear() { this.attacks = []; }
}
