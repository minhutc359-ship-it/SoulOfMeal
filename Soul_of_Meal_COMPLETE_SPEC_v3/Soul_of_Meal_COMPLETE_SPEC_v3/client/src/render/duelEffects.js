import { drawElementEffect } from './elementEffects.js';

const CONTACT_MS = 175;

function center(field, id, bounds) {
  if (!id || !bounds.width || !bounds.height) return null;
  const cell = field.querySelector(`[data-duel-id="${CSS.escape(id)}"]`);
  if (!cell) return null;
  const rect = (cell.querySelector('.tcg-unit-avatar') ?? cell).getBoundingClientRect();
  return {
    x: (rect.left - bounds.left + rect.width / 2) / bounds.width,
    y: (rect.top - bounds.top + rect.height / 2) / bounds.height,
  };
}

export class DuelEffects {
  constructor(renderer) {
    this.renderer = renderer;
    this.attacks = [];
  }

  queue(field, event, now, reducedMotion) {
    const bounds = field?.getBoundingClientRect();
    const opponent = `commander:p${1 - event.payload.target_player}`;
    const from = bounds && (center(field, event.source_id, bounds) ?? center(field, opponent, bounds));
    const to = bounds && center(field, event.target_id, bounds);
    const animated = !reducedMotion && Boolean(from && to);
    const contact = now + (animated ? CONTACT_MS : 0);
    this.attacks.push({ from, to, now, contact, event });
    return contact;
  }

  paint(canvas, matchId, now, reducedMotion, onContact) {
    const active = [];
    for (const attack of this.attacks) {
      if (attack.event.battle_id !== matchId) continue;
      if (reducedMotion || now >= attack.contact) onContact(attack.event);
      else active.push(attack);
    }
    this.attacks = active;
    if (!canvas || (!active.length && canvas.hidden)) return;
    canvas.hidden = !active.length;
    if (!active.length) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const attack of active) {
      const t = Math.max(0, (now - attack.now) / (attack.contact - attack.now));
      const dx = (attack.to.x - attack.from.x) * width;
      const dy = (attack.to.y - attack.from.y) * height;
      drawElementEffect(context, this.renderer, attack.event.payload.element, 'trail', {
        x: attack.from.x * width + dx * t, y: attack.from.y * height + dy * t,
        angle: Math.atan2(dy, dx), size: 38 + Math.min(22, width * .035),
        opacity: Math.min(1, .35 + t * 2),
      });
    }
  }

  clear() { this.attacks = []; }
}
