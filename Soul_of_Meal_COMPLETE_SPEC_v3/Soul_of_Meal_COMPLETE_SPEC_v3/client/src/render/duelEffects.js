import { drawCombatAccent, drawCombatTrail } from './combatVfx.js';
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
    this.impacts = [];
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
      if (reducedMotion || !attack.from || !attack.to || now >= attack.contact) {
        onContact(attack.event);
        if (attack.to) this.impacts.push({ ...attack, start: now });
      }
      else active.push(attack);
    }
    this.attacks = active;
    this.impacts = this.impacts.filter(impact => impact.event.battle_id === matchId && now - impact.start < 330);
    const visible = active.length || this.impacts.length;
    if (!canvas || (!visible && canvas.hidden)) return;
    canvas.hidden = !visible;
    if (!visible) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const context = canvasContext(canvas, canvasResolution(canvas, width, height), width, height);
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const attack of active) {
      const { element, ultimate, source_kind } = attack.event.payload;
      const from = { x: attack.from.x * width, y: attack.from.y * height };
      const to = { x: attack.to.x * width, y: attack.to.y * height };
      const dx = to.x - from.x, dy = to.y - from.y;
      const size = (ultimate ? 65 : 37) + Math.min(22, width * .035);
      const charge = now < attack.launch || Math.hypot(dx, dy) < 8;
      if (charge) {
        drawCombatAccent(context, this.renderer, { element, kind: 'charge', ...from, size,
          progress: (now - attack.now) / Math.max(1, attack.launch - attack.now) });
      } else {
        const progress = (now - attack.launch) / (attack.contact - attack.launch);
        if (source_kind === 'tcg_combat') {
          drawCombatAccent(context, this.renderer, { element, kind: 'slash',
            x: from.x + dx * progress, y: from.y + dy * progress, size, progress: .15 + progress * .48, angle: Math.atan2(dy, dx) });
        } else drawCombatTrail(context, this.renderer, { element, from, to, size, progress, arc: ultimate ? 23 : 8 });
      }
    }
    for (const { event, to, start } of this.impacts) {
      const { element, absorbed, hp_damage, ultimate, kind: support, effect_kind } = event.payload;
      const kind = event.type === 'tcg_support_resolved' ? support : absorbed > 0 && !hp_damage ? 'guard'
        : effect_kind === 'trap' ? 'trap' : ultimate ? 'cast' : 'hit';
      drawCombatAccent(context, this.renderer, { element, kind, x: to.x * width, y: to.y * height,
        size: ultimate ? 92 : 57, progress: (now - start) / 330, reducedMotion });
    }
  }

  clear() { this.attacks = []; this.impacts = []; }
}
