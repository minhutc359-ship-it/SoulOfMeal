// Each skin follows its grounded root, hip and chest, with extra motion at the head.
// Coordinates are normalized to the untrimmed frame, including the transparent margin.
const RIGS = Object.freeze({
  chr_bunbo_holinh: [.60, .76, 1],
  chr_bunbo_holinh_travel: [.58, .75, .85],
  chr_pho_lamvu: [.57, .75, .92],
  chr_goicuon_diepnhi: [.59, .76, .90],
  chr_banhbao_bachngoc: [.48, .70, .63],
  chr_caphe_davu: [.58, .75, 1],
  mob_mushroom_01: [.50, .73, .72],
  mob_pepper_01: [.53, .74, .78],
});

export function rigSample(id, animation) {
  if (!Object.hasOwn(RIGS, id) || animation?.motionPhase == null) return null;
  return Math.floor(animation.motionPhase * 24);
}

export function drawRiggedSprite(context, image, frame, id, animation, scale, anchor, flipX) {
  const sample = rigSample(id, animation);
  if (sample === null || animation.missingClip || frame.sourceHeight < 16) return false;
  const [chest, hip, amplitude] = RIGS[id];
  const phase = sample / 24;
  const cycle = phase * Math.PI * 2;
  const forward = (animation.direction === 'W' ? -1 : 1) * (flipX ? -1 : 1);
  let sway = 0;
  let stretch = 0;
  switch (animation.requestedClipId) {
    case 'idle':
      sway = 1.3 * Math.sin(cycle);
      stretch = 1.6 * Math.cos(cycle);
      break;
    case 'walk':
    case 'run':
      sway = forward * (2.2 + 1.5 * Math.sin(cycle));
      stretch = 2.4 * Math.cos(cycle * 2);
      break;
    case 'attack_a':
    case 'attack_b':
      sway = forward * (phase < .25 ? -4 * Math.sin(phase * 4 * Math.PI) : 8 * Math.sin((phase - .25) / .75 * Math.PI));
      stretch = 2.4 * Math.sin(Math.PI * phase);
      break;
    case 'hit':
      sway = -forward * 6 * (1 - phase) ** 2;
      stretch = -4 * (1 - phase) ** 2;
      break;
    case 'skill_01':
    case 'ultimate_01':
      sway = 2 * Math.sin(cycle);
      stretch = 5 * Math.sin(Math.PI * phase);
      break;
    default: return false;
  }
  const height = frame.sourceHeight;
  const dx = sway * amplitude * height / 160;
  const dy = -stretch * amplitude * height / 160;
  const root = Math.min(1, Math.max(hip, anchor[1]));
  const joints = [
    [0, dx, dy], [Math.round(chest * height), dx * .58, dy * .56],
    [Math.round(hip * height), dx * .16, dy * .21],
    [Math.round(root * height), 0, 0], [height, 0, 0],
  ];

  for (let index = 1; index < joints.length; index++) {
    const [top, x, y] = joints[index - 1];
    const [bottom, endX, endY] = joints[index];
    const start = Math.max(top, frame.offsetY);
    const end = Math.min(bottom, frame.offsetY + frame.height);
    if (end <= start) continue;
    const shear = (endX - x) / (bottom - top);
    const slope = (endY - y) / (bottom - top);
    context.save();
    context.transform(scale, 0, shear * scale, (1 + slope) * scale,
      (frame.offsetX - anchor[0] * frame.sourceWidth + x + shear * (start - top)) * scale,
      (start - anchor[1] * height + y + slope * (start - top)) * scale);
    context.drawImage(image, frame.x, frame.y + start - frame.offsetY, frame.width, end - start,
      0, 0, frame.width, end - start);
    context.restore();
  }
  return true;
}
