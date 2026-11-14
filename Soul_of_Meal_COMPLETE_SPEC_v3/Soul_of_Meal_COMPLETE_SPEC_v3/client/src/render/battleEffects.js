import { PRESENTATION } from "../core/rules.js";
const COLORS = {
  fire: "#ff8b45",
  water: "#69d8ff",
  wood: "#a8ed7d",
  light: "#ffe28b",
  shadow: "#c2a0ff",
};
export class BattleEffects {
  constructor() {
    this.effects = [];
  }
  add(event, positions, now = performance.now(), reducedMotion = false) {
    if (
      ![
        "hit_resolved",
        "heal_resolved",
        "attack_started",
        "cast_started",
      ].includes(event.type)
    )
      return;
    const target = positions.get(event.target_id);
    const source = positions.get(event.source_id);
    if (!target) return;
    this.effects.push({
      event,
      target: { ...target },
      source: source ? { ...source } : null,
      born: now,
      duration: reducedMotion
        ? 400
        : PRESENTATION.impactMs / PRESENTATION.combatSpeed,
      reducedMotion,
    });
    this.effects = this.effects.slice(-40);
  }
  draw(ctx, now = performance.now()) {
    this.effects = this.effects.filter((fx) => now - fx.born < fx.duration);
    for (const fx of this.effects) {
      const progress = Math.min(1, (now - fx.born) / fx.duration);
      const { event, target, source } = fx;
      const healing = event.type === "heal_resolved";
      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.8;
      const color = healing
        ? "#b2ff9c"
        : (COLORS[event.payload?.element] ?? "#ffe8af");
      if (!fx.reducedMotion && source && progress < 0.55) {
        const p = Math.min(1, progress / 0.55);
        const x = source.x + (target.x - source.x) * p;
        const y =
          source.y + (target.y - source.y) * p - Math.sin(p * Math.PI) * 25;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y - 20);
        ctx.lineTo(x, y - 20);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y - 20, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(target.x, target.y - 22, 10 + progress * 30, 0, Math.PI * 2);
        ctx.stroke();
        if (event.payload?.damage !== undefined || healing) {
          ctx.font = "bold 19px system-ui";
          ctx.textAlign = "center";
          ctx.fillStyle = "#182b29";
          ctx.fillText(
            `${healing ? "+" : "−"}${event.payload.healing ?? event.payload.damage}`,
            target.x + 1,
            target.y - 55 - progress * 24 + 1,
          );
          ctx.fillStyle = color;
          ctx.fillText(
            `${healing ? "+" : "−"}${event.payload.healing ?? event.payload.damage}`,
            target.x,
            target.y - 55 - progress * 24,
          );
        }
      }
      ctx.restore();
    }
  }
  clear() {
    this.effects = [];
  }
}
