import { effectArt } from './spriteAssets.js';

// Use the same authored elemental textures in Adventure and in Auto Chess replays.
export function drawElementEffect(context, renderer, element, phase, options) {
  return drawEffectTexture(context, renderer, effectArt(element, phase), options);
}

export function drawEffectTexture(context, renderer, path, {
  x, y, size, opacity = 1, angle = 0, height = size, flipX = false,
}) {
  const image = renderer.images.get(path);
  if (!image?.naturalWidth) return false;
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = size * Math.min(1, aspect);
  const drawHeight = height * Math.min(1, 1 / aspect);
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  if (flipX) context.scale(-1, 1);
  context.globalAlpha = Math.min(1, Math.max(0, opacity));
  renderer.drawImage(context, path, -width / 2, -drawHeight / 2, width, drawHeight);
  context.restore();
  return true;
}
