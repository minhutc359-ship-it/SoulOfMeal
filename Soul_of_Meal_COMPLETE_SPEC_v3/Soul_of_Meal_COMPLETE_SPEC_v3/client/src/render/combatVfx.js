import { drawElementEffect } from './elementEffects.js';
import { ELEMENT_ART } from './spriteAssets.js';

const TAU = Math.PI * 2;
const ELEMENT_MOTION = {
  fire: { sparks: 10, stretch: 1.45, lift: .70, shape: 'ember' },
  water: { sparks: 8, stretch: 1.25, lift: .18, shape: 'droplet' },
  wood: { sparks: 7, stretch: .94, lift: .48, shape: 'leaf' },
  light: { sparks: 8, stretch: 1.05, lift: .41, shape: 'star' },
  shadow: { sparks: 9, stretch: .95, lift: .29, shape: 'shard' },
};

function unit(progress) { return Math.max(0, Math.min(1, progress)); }

function pathRing(context, x, y, radius, tilt = .48) {
  context.beginPath();
  context.ellipse(x, y, radius, radius * tilt, 0, 0, TAU);
  context.stroke();
}

function particle(context, shape, radius) {
  if (shape === 'droplet' || shape === 'leaf') {
    context.beginPath();
    context.ellipse(0, 0, radius, radius * (shape === 'leaf' ? .44 : .70), 0, 0, TAU);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(0, -radius * .65);
    context.lineTo(radius * (shape === 'ember' ? 1.8 : 1), 0);
    context.lineTo(0, radius * .65);
    context.closePath();
    context.fill();
    if (shape === 'star') context.fillRect(-.5, -radius * 1.45, 1, radius * 2.9);
  }
}

export function drawCombatAccent(context, renderer, {
  element = 'light', kind, x, y, size, progress, angle = 0, reducedMotion = false,
}) {
  const t = unit(progress);
  const { color, dark } = ELEMENT_ART[element] ?? ELEMENT_ART.light;
  const motion = ELEMENT_MOTION[element] ?? ELEMENT_MOTION.light;
  const charge = kind === 'charge';
  const guard = kind === 'guard' || kind === 'shield';
  const heal = kind === 'heal';
  const defeat = kind === 'defeat';
  const trap = kind === 'trap';
  const cast = kind === 'cast';
  const slash = kind === 'slash';
  const particleCount = reducedMotion ? 0 : defeat ? 6 : cast ? motion.sparks : Math.ceil(motion.sparks * .65);
  const phase = reducedMotion ? .35 : t;
  const opacity = charge ? .25 + .60 * t : Math.pow(1 - t, .8);
  const radius = size * (charge ? .39 - phase * .14 : .28 + phase * (cast ? .57 : .32));
  if (!(opacity > 0 && radius > 0)) return;

  context.save();
  if (!defeat) {
    drawElementEffect(context, renderer, heal || guard ? 'light' : element, slash ? 'trail' : 'impact', {
      x, y, size: size * (charge ? .60 + phase * .31 : .73 + phase * .55), opacity: opacity * .63, angle,
    });
  }
  context.translate(x, y);
  context.strokeStyle = guard ? '#c7ddff' : heal ? '#b6fbd2' : color;
  context.fillStyle = guard ? '#c7ddff' : heal ? '#b6fbd2' : color;
  context.lineWidth = reducedMotion ? 1.5 : 2.1;
  context.globalAlpha = opacity * (defeat ? .36 : .78);

  if (guard) {
    pathRing(context, 0, -radius * .35, radius, 1.37);
    context.globalAlpha *= .6;
    pathRing(context, 0, -radius * .35, radius * .84, 1.37);
  } else if (trap) {
    context.rotate(Math.PI / 4 + (reducedMotion ? 0 : phase * .45));
    context.strokeRect(-radius * .55, -radius * .55, radius * 1.1, radius * 1.1);
    context.strokeRect(-radius * .33, -radius * .33, radius * .66, radius * .66);
  } else if (slash) {
    context.rotate(angle);
    context.beginPath();
    context.ellipse(0, 0, radius * 1.24, radius * .52, -.48, -1.7, 1.58);
    context.stroke();
  } else {
    pathRing(context, 0, heal ? radius * .22 : 0, radius, charge ? .81 : .47);
    if (cast || charge) {
      context.globalAlpha *= .50;
      pathRing(context, 0, 0, radius * 1.17, .47);
    }
  }

  for (let index = 0; index < particleCount; index++) {
    const spread = (index + .19) / particleCount * TAU;
    const distance = radius * (.8 + (index % 3) * .19);
    const lift = phase * size * (heal ? .8 : motion.lift);
    context.save();
    context.translate(Math.cos(spread) * distance * motion.stretch, Math.sin(spread) * distance * .55 - lift);
    context.rotate(spread + phase);
    context.globalAlpha = opacity * (.58 + (index % 2) * .30);
    if (index % 3 === 0 && !heal && !guard) context.fillStyle = dark;
    particle(context, heal ? 'star' : motion.shape, Math.max(1.3, size * .041 * (1 - phase * .48)));
    context.restore();
  }
  context.restore();
}

export function drawCombatTrail(context, renderer, { element, from, to, progress, size, arc = 0 }) {
  const t = unit(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const arcOffset = p => Math.sin(Math.PI * p) * arc;
  const color = (ELEMENT_ART[element] ?? ELEMENT_ART.light).color;
  context.save();
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.lineWidth = Math.max(1.5, size * .041);
  context.globalAlpha = .32 + .28 * Math.sin(Math.PI * t);
  context.beginPath();
  for (let index = 0; index <= 4; index++) {
    const point = Math.max(0, t - (4 - index) * .055);
    context.lineTo(from.x + dx * point, from.y + dy * point - arcOffset(point));
  }
  context.stroke();
  context.restore();
  drawElementEffect(context, renderer, element, 'trail', {
    x: from.x + dx * t, y: from.y + dy * t - arcOffset(t),
    angle: Math.atan2(dy - Math.PI * arc * Math.cos(Math.PI * t), dx), size, opacity: .92,
  });
}
