import { effectArt } from './spriteAssets.js';

// Use the same authored elemental textures in Adventure and in Auto Chess replays.
export function drawElementEffect(context, renderer, element, phase, {
  x, y, size, opacity = 1, angle = 0, height = size,
}) {
  const path = effectArt(element, phase);
  const image = renderer.images.get(path);
  if (!image?.naturalWidth) return;
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = size * Math.min(1, aspect);
  const drawHeight = height * Math.min(1, 1 / aspect);
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.globalAlpha = Math.min(1, Math.max(0, opacity));
  renderer.drawImage(context, path, -width / 2, -drawHeight / 2, width, drawHeight);
  context.restore();
}
