import { drawElementEffect } from './elementEffects.js';
import { ELEMENT_ART } from './spriteAssets.js';
import { canvasContext, canvasResolution } from './canvasSurface.js';

function position(field, id, bounds) {
  if (!id || !bounds.width || !bounds.height) return null;
  const cell = field.querySelector(`[data-duel-id="${CSS.escape(id)}"]`);
  if (!cell) return null;
  const rect = (cell.querySelector('.tcg-unit-avatar') ?? cell).getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return { x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height };
}

export class DuelEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.attacks = [];
  }

  queue(field, event, now, reducedMotion) {
    const bounds = field?.getBoundingClientRect();
    const { target_player, target_lane, ultimate, effect_kind } = event.payload;
    const support = event.type === 'tcg_support_resolved';
    const source = `commander:p${support ? target_player : 1 - target_player}`;
    const to = bounds && (position(field, event.target_id, bounds)
      ?? position(field, `lane:p${target_player}:${target_lane}`, bounds));
    const from = bounds && (position(field, event.source_id, bounds) ?? position(field, source, bounds) ?? to);
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
      const size = (ultimate ? 65 : 37) + Math.min(22, width * .035);
      const x = attack.from.x * width, y = attack.from.y * height;
      const color = (ELEMENT_ART[element] ?? ELEMENT_ART.light).color;
      if (now < attack.launch || Math.hypot(dx, dy) < 8) {
        const charge = Math.min(1, (now - attack.now) / Math.max(1, attack.launch - attack.now));
        drawElementEffect(context, this.renderer, element, 'impact', {
          x, y, size: size * (.55 + charge * .45), opacity: .27 + charge * .43,
        });
        continue;
      }
      context.save();
      context.strokeStyle = color;
      context.lineCap = 'round';
      context.lineWidth = ultimate ? 4 : 2;
      context.globalAlpha = .45 * Math.sin(Math.PI * t);
      context.beginPath();
      context.moveTo(x + dx * Math.max(0, t - .3), y + dy * Math.max(0, t - .3));
      context.lineTo(x + dx * t, y + dy * t);
      context.stroke();
      context.restore();
      drawElementEffect(context, this.renderer, element, 'trail', {
        x: x + dx * t, y: y + dy * t, angle: Math.atan2(dy, dx), size,
        opacity: Math.min(1, .35 + t * 2),
      });
    }
  }

  clear() { this.attacks = []; }
}
