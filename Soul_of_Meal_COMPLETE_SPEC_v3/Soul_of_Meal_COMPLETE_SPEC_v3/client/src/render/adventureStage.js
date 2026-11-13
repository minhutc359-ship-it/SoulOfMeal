import { resolveCameraViewport, WORLD } from '../modes/adventure.js';

const FULL_ARENA = Object.freeze({ left: 0, top: 0, width: WORLD.width, height: WORLD.height });
const WIDE_ARENA = Object.freeze({ left: 0, top: 100, width: WORLD.width, height: 360 });
const PORTRAIT_ARENA = Object.freeze({ left: 52, top: 75, width: 856, height: 425 });

export const SPIRIT_RIG_SCALE = 1.03;

export function adventureViewport(inBattle, compactLandscape, compactPortrait) {
  if (!inBattle) return FULL_ARENA;
  if (compactLandscape) return WIDE_ARENA;
  return compactPortrait ? PORTRAIT_ARENA : FULL_ARENA;
}

export function battleActorPoint(actor, blend = 1, safeX) {
  const x = (actor.previousX ?? actor.x) * (1 - blend) + actor.x * blend;
  const y = (actor.previousY ?? actor.y) * (1 - blend) + actor.y * blend;
  if (actor.team !== 'player' || !Number.isFinite(actor.homeY)) return { x, y };
  // Keep the party's depth lanes readable when all melee units surround one target.
  const advance = Math.min(1, Math.max(0, (x - (actor.homeX ?? x)) / 120));
  const stagger = actor.role === 'fighter' ? 46 * advance : 0;
  // The fighter's screen position must stay on the correct side of a retreat warning.
  const shift = x > safeX ? Math.min(stagger, (x - safeX) * .5) : stagger;
  const depth = actor.role === 'guardian' ? -10 : actor.role === 'assassin' ? 6 : 0;
  return { x: x - shift, y: y + (actor.homeY - y) * .76 + depth * advance };
}

export function adventureCamera(player, bounds, screenWidth, screenHeight) {
  const aspect = Math.max(1, screenWidth) / Math.max(1, screenHeight);
  const width = Math.min(bounds.width, bounds.height * aspect);
  const height = width / aspect;
  const { x, y } = resolveCameraViewport(player.x, player.y, { width, height }, bounds.width, bounds.height);
  return { left: x, top: y, width, height };
}

export function battleCamera(arena, screenWidth, screenHeight) {
  const aspect = Math.max(1, screenWidth) / Math.max(1, screenHeight);
  const width = Math.max(arena.width, arena.height * aspect);
  const height = width / aspect;
  return {
    left: arena.left + (arena.width - width) / 2,
    top: arena.top + (arena.height - height) / 2,
    width,
    height,
  };
}
