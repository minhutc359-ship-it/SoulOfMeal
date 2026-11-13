import { SPIRITS } from '../modes/metaProgress.js';
import { actorArt, cutinArt, HERO_ID } from './spriteAssets.js';

export const BANQUET_ART = './assets/original/scenes/gacha_banquet.webp';
export const CINEMATIC_WIDTH = 960;
export const CINEMATIC_HEIGHT = 540;
export const RARITY_COLOR = { N: '#fff0ce', R: '#74d8ff', SR: '#d696ff', SSR: '#ffd279' };
const DURATIONS = { N: 5, R: 5, SR: 7, SSR: 10 };
const ELEMENTS = ['#ff8c52', '#76e2ff', '#98eb8e', '#ffeab0', '#d0a3ff'];
const ENDINGS = {
  [HERO_ID]: 'flame', chr_som_022: 'snow', chr_som_023: 'tide', chr_som_024: 'jade',
};
const TAU = Math.PI * 2;
const CX = CINEMATIC_WIDTH / 2;
const CY = 266;
const clamp = value => Math.max(0, Math.min(1, value));
const progress = (time, start, end) => clamp((time - start) / (end - start));
const smooth = value => value * value * (3 - 2 * value);
const between = (time, start, end) => smooth(progress(time, start, end));
const wave = (time, start, end) => Math.sin(progress(time, start, end) * Math.PI);

export function planGachaCinematic(receipt) {
  const cards = receipt.items.map(({ id }) => ({ id, rarity: SPIRITS[id].rarity, art: actorArt(id) }));
  const multi = cards.length === 10;
  const spotlight = multi ? cards.find(card => card.rarity === 'SSR') : cards[0];
  const rarity = multi ? 'SSR' : spotlight.rarity;
  const duration = multi ? 10 : DURATIONS[rarity];
  const reveal = multi ? 8 : rarity === 'SSR' ? 8 : rarity === 'SR' ? 5.5 : 4;
  const impact = multi ? 6 : rarity === 'SSR' ? 6.95 : rarity === 'SR' ? 4.55 : 3.6;
  const cues = [
    { time: .12, id: 'sfx_skill_ready', gain: .67 },
    { time: multi || rarity === 'SSR' || rarity === 'SR' ? 2 : 1.25, id: 'sfx_element_light_cast', gain: .6 },
    { time: impact, id: 'sfx_boss_break', gain: rarity === 'SSR' ? .86 : .38 },
    { time: reveal, id: spotlight?.rarity === 'SSR' ? 'sfx_victory' : 'sfx_ui_confirm', gain: .86 },
  ];
  if (!multi && rarity === 'SSR') cues.splice(2, 0, { time: 4.1, id: 'sfx_element_light_impact', gain: .8 });
  return { cards, multi, spotlight, rarity, duration, reveal, impact, cues,
    ending: ENDINGS[spotlight?.id], spotlightArt: spotlight?.id === HERO_ID ? cutinArt(HERO_ID) : spotlight?.art };
}

export async function loadGachaArt(plan, loadImage) {
  const urls = new Set([BANQUET_ART, ...plan.cards.map(card => card.art), plan.spotlightArt].filter(Boolean));
  return new Map(await Promise.all([...urls].map(async url => [url, await loadImage(url)])));
}

function stroke(ctx, color, width, paint) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  paint();
  ctx.stroke();
}

function glow(ctx, x, y, radius, color, opacity) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha *= opacity;
  const falloff = ctx.createRadialGradient(x, y, 0, x, y, radius);
  falloff.addColorStop(0, color);
  falloff.addColorStop(.2, `${color}7a`);
  falloff.addColorStop(1, `${color}00`);
  ctx.fillStyle = falloff;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function diamond(ctx, x, y, width, height, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x - width, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function art(ctx, image, x, y, width, height) {
  if (!image) return;
  const ratio = Math.min(width / image.width, height / image.height);
  const w = image.width * ratio, h = image.height * ratio;
  ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
}

function drawSeal(ctx, time, color, opacity, radius) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(CX, CY + 103);
  ctx.scale(1, .32);
  ctx.rotate(time * .23);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (const [scale, width] of [[1, 2], [.91, 1], [.72, 1], [.38, 1]]) {
    stroke(ctx, color, width, () => ctx.arc(0, 0, radius * scale, 0, TAU));
  }
  for (let i = 0; i < 24; i++) {
    ctx.rotate(TAU / 24);
    diamond(ctx, radius * .95, 0, 2 + (i % 3 === 0) * 4, 4, color);
    if (i % 4 === 0) stroke(ctx, color, 1.4, () => {
      ctx.moveTo(radius * .72, 0);
      ctx.lineTo(radius * .27, radius * .67);
      ctx.lineTo(-radius * .34, radius * .63);
    });
  }
  ctx.restore();
}

function drawRibbons(ctx, time, color, energy, count) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < count; i++) {
    const shade = count === 5 ? ELEMENTS[i] : color;
    for (let line = 0; line < 3; line++) {
      ctx.globalAlpha = energy * [.15, .28, .69][line];
      stroke(ctx, shade, [21, 9, 2][line], () => {
        for (let point = 0; point <= 40; point++) {
          const u = point / 40;
          const angle = i * TAU / count + time * (1.05 + energy) + u * 4.1;
          const radius = (1 - u) ** .72 * (215 + 28 * Math.sin(time + i));
          const x = CX + Math.cos(angle) * radius;
          const y = CY + 58 + Math.sin(angle) * radius * .37 - 66 * u;
          if (point === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
    }
  }
  ctx.restore();
}

function drawParticles(ctx, time, color, strength, burst) {
  const amount = Math.round(26 + strength * 100);
  for (let i = 0; i < amount; i++) {
    const angle = i * 2.39996 + time * (.19 + i % 3 * .11);
    const speed = .46 + (i * 17 % 31) / 32;
    const drift = (i * 73 % 281) + time * (9 + i % 9);
    const radius = 18 + (drift % 256) * speed + burst * 270 * speed;
    const x = CX + Math.cos(angle) * radius;
    const y = CY + 88 + Math.sin(angle) * radius * .59 - (drift % 118) * .67;
    const alpha = (.27 + .65 * Math.abs(Math.sin(time * 2.5 + i))) * (.45 + strength * .5);
    diamond(ctx, x, y, 1 + i % 4 * .8, (i % 6 === 0 ? 8 : 2) + strength * 3, i % 4 ? color : '#fff9dd', alpha);
  }
}

function drawCrystal(ctx, x, y, size, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  diamond(ctx, 0, 0, size * .58, size, color, .75);
  diamond(ctx, -size * .12, -size * .12, size * .26, size * .71, '#fff6de', .88);
  ctx.restore();
}

function drawCard(ctx, x, y, scale, angle, lean, color, face) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(scale * Math.max(.055, Math.abs(Math.cos(angle))), scale);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  const surface = ctx.createLinearGradient(-54, -78, 55, 75);
  surface.addColorStop(0, '#302345');
  surface.addColorStop(.5, '#1c2937');
  surface.addColorStop(1, '#442f3e');
  ctx.fillStyle = surface;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-54, -79, 108, 158, 10);
  else ctx.rect(-54, -79, 108, 158);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `${color}b0`;
  ctx.strokeRect(-46, -71, 92, 142);
  if (face) art(ctx, face, 0, 0, 87, 117);
  else {
    stroke(ctx, `${color}a8`, 1.3, () => ctx.arc(0, 0, 29, 0, TAU));
    stroke(ctx, `${color}82`, 1.1, () => ctx.arc(0, 0, 37, 0, TAU));
    diamond(ctx, 0, 0, 11, 27, color, .82);
    diamond(ctx, 0, 0, 22, 6, '#fff4d7', .9);
  }
  for (const corner of [-1, 1]) {
    for (const edge of [-1, 1]) diamond(ctx, corner * 46, edge * 70, 4, 7, color);
  }
  ctx.restore();
}

function drawShatter(ctx, time, color) {
  for (let i = 0; i < 75; i++) {
    const angle = i * 2.39996;
    const distance = (28 + i * 7 % 49) + time * (90 + i * 19 % 170);
    const x = CX + Math.cos(angle) * distance;
    const y = CY - 38 + Math.sin(angle) * distance * .67 + 29 * time * time;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i + time * (2 + i % 6));
    diamond(ctx, 0, 0, 1.5 + i % 4, 2 + i % 9, i % 3 ? color : '#fff2c0', clamp(1 - time / 1.35));
    ctx.restore();
  }
}

function drawDragon(ctx, time, progress, color, jade) {
  const fade = jade ? 1 : 1 - between(progress, .45, .79);
  const angle = time * 3.9;
  const at = u => {
    const phase = angle - u * 5.1;
    return [CX + Math.cos(phase) * (124 + u * 64), CY + 59 - u * 215 + Math.sin(phase) * 47];
  };
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.lineCap = 'round';
  for (const [width, shade] of [[29, `${color}35`], [13, color], [3, '#fbfff0']]) {
    stroke(ctx, shade, width, () => {
      ctx.moveTo(...at(1));
      for (let i = 39; i >= 0; i--) ctx.lineTo(...at(i / 40));
    });
  }
  const [x, y] = at(0);
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(27, 2); ctx.lineTo(9, -9); ctx.lineTo(2, -21); ctx.lineTo(-7, -9);
  ctx.lineTo(-16, -17); ctx.lineTo(-12, 1); ctx.lineTo(0, 10); ctx.lineTo(17, 12);
  ctx.closePath(); ctx.fill();
  diamond(ctx, 9, 0, 4, 2.5, '#fff6c8');
  ctx.restore();
  if (!jade) {
    ctx.save();
    ctx.globalAlpha *= between(progress, .48, .84);
    ctx.translate(CX + 111, CY + 22);
    ctx.rotate(.18);
    stroke(ctx, color, 7, () => ctx.ellipse(0, 0, 39, 78, 0, -Math.PI / 2, Math.PI / 2));
    stroke(ctx, '#e4fbff', 1.5, () => { ctx.moveTo(0, -77); ctx.lineTo(0, 77); });
    ctx.restore();
  }
}

function drawSignature(ctx, ending, t, front) {
  const phase = clamp(t / 2);
  if (ending === 'snow' && !front) {
    glow(ctx, CX + 57, CY - 116, 158, '#a5deff', .68);
    ctx.fillStyle = '#d8f3ff';
    ctx.beginPath(); ctx.arc(CX + 57, CY - 116, 72, 0, TAU); ctx.fill();
  } else if (ending === 'snow') {
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996 + t * .4;
      const r = 45 + 175 * phase + i * 23 % 61;
      const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r * .8;
      for (let ray = 0; ray < 3; ray++) {
        const axis = ray * Math.PI / 3 + a, d = 4 + i % 8;
        stroke(ctx, '#d4f3ff', 1.1, () => {
          ctx.moveTo(x - Math.cos(axis) * d, y - Math.sin(axis) * d);
          ctx.lineTo(x + Math.cos(axis) * d, y + Math.sin(axis) * d);
        });
      }
    }
  } else if (ending === 'flame' && !front) {
    glow(ctx, CX, CY + 70, 245, '#ff773e', .85);
    drawRibbons(ctx, t + .25, '#ff934e', .74, 3);
  } else if (ending === 'flame') {
    const slash = wave(t, .69, 1.37);
    if (slash > 0) {
      ctx.save();
      ctx.globalAlpha *= slash;
      ctx.translate(CX, CY + 45);
      ctx.rotate(-.14);
      for (const [width, shade] of [[29, '#f8744a5e'], [12, '#ffa05e'], [3, '#fff0b5']]) {
        stroke(ctx, shade, width, () => ctx.ellipse(0, 0, 224, 48, 0, .2, Math.PI - .2));
      }
      ctx.restore();
    }
  } else if (ending === 'tide' && front) {
    drawDragon(ctx, t, phase, '#76e7ff', false);
  } else if (ending === 'jade' && !front) {
    drawSeal(ctx, t * .4, '#a2e98f', .95, 205);
    glow(ctx, CX, CY + 54, 229, '#8be47a', .52);
  } else if (ending === 'jade' && front) {
    drawDragon(ctx, t, phase, '#9cf096', true);
  }
}

function drawMultiCards(ctx, plan, assets, time) {
  const build = between(time, 1.8, 3.7);
  if (!build) return;
  const grid = between(time, 5.65, 6.6);
  const hide = plan.spotlight ? 1 - between(time, 7.65, 8.06) : 1;
  ctx.save();
  ctx.globalAlpha *= build * hide;
  const orbit = time * .43 * (1 - grid);
  for (let i = 0; i < plan.cards.length; i++) {
    const card = plan.cards[i];
    const angle = i * TAU / 10 + orbit - Math.PI / 2;
    const x = CX + (1 - grid) * Math.cos(angle) * 249 + grid * ((i % 5) - 2) * 135;
    const y = CY + (1 - grid) * Math.sin(angle) * 143 + grid * (i < 5 ? -78 : 78);
    const flip = between(time, 4, 5.9) * TAU + between(time, 6 + .115 * i, 6.36 + .115 * i) * Math.PI;
    const tint = time < 4 ? '#ffe4a1' : RARITY_COLOR[card.rarity];
    drawCard(ctx, x, y, (.47 + grid * .33) * (.55 + build * .45), flip, Math.cos(angle) * .12 * (1 - grid), tint,
      time > 6.18 + .115 * i ? assets.get(card.art) : null);
  }
  ctx.restore();
}

export function drawGachaCinematic(ctx, plan, assets, seconds, heroRig) {
  const time = Math.min(plan.duration, Math.max(0, seconds));
  const color = RARITY_COLOR[plan.rarity];
  const premium = plan.rarity === 'SSR';
  const intensity = { N: .22, R: .44, SR: .65, SSR: 1 }[plan.rarity];
  const sealStart = premium || plan.rarity === 'SR' ? 1.7 : .55;
  const charge = wave(time, sealStart, plan.impact + .48);
  const strike = wave(time, plan.impact - .12, plan.impact + .68);
  const firstBlast = premium && !plan.multi ? wave(time, 3.9, 4.63) : 0;
  const ending = time >= plan.reveal;
  const endTime = Math.max(0, time - plan.reveal);
  const zoom = 1 + .14 * between(time, 0, 3.8) + .045 * between(time, plan.reveal, plan.duration);
  const shake = (strike + firstBlast) * intensity;
  const backdrop = assets.get(BANQUET_ART);
  ctx.fillStyle = '#201a2a';
  ctx.fillRect(0, 0, CINEMATIC_WIDTH, CINEMATIC_HEIGHT);
  if (backdrop) {
    const w = CINEMATIC_WIDTH * zoom, h = CINEMATIC_HEIGHT * zoom;
    ctx.drawImage(backdrop, (CINEMATIC_WIDTH - w) / 2 + Math.sin(time * 75) * shake * 4,
      (CINEMATIC_HEIGHT - h) / 2 + Math.sin(time * 92) * shake * 3, w, h);
  }
  const vignette = ctx.createRadialGradient(CX, CY, 90, CX, CY, 540);
  vignette.addColorStop(0, '#140e1b05');
  vignette.addColorStop(1, '#100d20d8');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CINEMATIC_WIDTH, CINEMATIC_HEIGHT);
  glow(ctx, CX, CY + 33, 343, color, .13 + charge * intensity * .36 + (ending ? .25 : 0));
  drawSeal(ctx, time, color, between(time, sealStart, sealStart + .75) * (.55 + charge * .4), (102 + 81 * intensity) * (.55 + between(time, sealStart, sealStart + 1.6) * .45));
  const beamCount = plan.multi ? 10 : Math.round(intensity * 8) + 3;
  for (let i = 0; i < beamCount; i++) {
    const lift = progress(time, 0, plan.multi ? 2 : 2.7);
    const angle = i * TAU / beamCount + time * .96;
    const radius = plan.multi ? 235 * (1 - lift) + 25 : 114 + i * 11;
    const x = CX + Math.cos(angle) * radius;
    const y = CY + 86 - lift * (90 + i * 37 % 130) + Math.sin(angle) * 30;
    if (plan.multi && time < 2) {
      stroke(ctx, `${color}88`, 2.2, () => { ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * 100 * (1 - lift), y + 70); });
    }
    if (plan.rarity !== 'N' || i % 3 === 0) drawCrystal(ctx, x, y, 3 + i % 5 * 1.5, angle, color);
    if (!plan.multi && time < 3.2 && i % 3 === 1) {
      ctx.save();
      ctx.translate(x + 13, y + 24);
      ctx.rotate(angle * 1.6);
      ctx.fillStyle = i % 2 ? '#a5cf75' : '#ee8a61';
      ctx.globalAlpha *= 1 - between(time, 2, 3.2);
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.7, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  if (charge > 0) drawRibbons(ctx, time, color, charge * (.3 + intensity * .63), premium ? 5 : intensity > .4 ? 3 : 2);
  drawParticles(ctx, time, color, intensity, strike);
  if (plan.multi) drawMultiCards(ctx, plan, assets, time);
  else {
    const start = premium ? 4.05 : plan.rarity === 'SR' ? 2.85 : 1.4;
    const form = between(time, start, start + .73);
    if (form > 0 && time < plan.impact + (premium ? 0 : .28)) {
      const tilt = premium ? (time - start) * 2.5 : between(time, plan.impact - .58, plan.impact + .2) * Math.PI;
      ctx.save();
      ctx.globalAlpha *= form;
      glow(ctx, CX, CY - 37, 171, color, .28);
      drawCard(ctx, CX, CY - 36 + Math.sin(time * 3) * 7, (.55 + .74 * form) * (premium ? 1.2 : 1), tilt,
        Math.sin(time * 1.6) * .12, color, !premium && time > plan.impact ? assets.get(plan.spotlight.art) : null);
      ctx.restore();
    }
    if (premium && time >= plan.impact && time < plan.impact + 1.35) drawShatter(ctx, time - plan.impact, color);
  }
  glow(ctx, CX, CY - 29, 393, color, Math.min(.84, (strike + firstBlast) * (.42 + intensity * .37)));
  if (ending && plan.spotlight) {
    const appear = between(endTime, 0, .43);
    ctx.save();
    ctx.globalAlpha *= appear;
    drawSignature(ctx, plan.ending, endTime, false);
    const image = assets.get(plan.spotlightArt) ?? assets.get(plan.spotlight.art);
    const rigTime = endTime - .43;
    if (plan.ending === 'flame' && heroRig) {
      const attacking = rigTime > 0 && rigTime < 1;
      const motion = attacking ? { id: 'attack_b', phase: rigTime } : { id: 'idle', phase: endTime % 1 };
      heroRig.draw(ctx, motion, CX, CY + 150 + 21 * (1 - appear), 'E', 2.85);
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = premium ? 24 : 14;
      art(ctx, image, CX, CY - 11 + 20 * (1 - appear) + Math.sin(endTime * 3) * 4, 410, premium ? 366 : 299);
      ctx.shadowBlur = 0;
    }
    drawSignature(ctx, plan.ending, endTime, true);
    ctx.restore();
  }
}
