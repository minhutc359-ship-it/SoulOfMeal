const MAX_EDGE = 2048;

export function canvasResolution(canvas, logicalWidth, logicalHeight, contain = false, density = globalThis.devicePixelRatio ?? 1) {
  const availableWidth = canvas.clientWidth || logicalWidth;
  const availableHeight = canvas.clientHeight || logicalHeight;
  const aspect = logicalWidth / logicalHeight;
  const width = contain ? Math.min(availableWidth, availableHeight * aspect) : availableWidth;
  const height = width / aspect;
  const ratio = Math.min(density, 3, MAX_EDGE / Math.max(width, height));
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}

export function canvasContext(canvas, [width, height], logicalWidth, logicalHeight, left = 0, top = 0) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  if (!context) return null;
  const x = width / logicalWidth;
  const y = height / logicalHeight;
  context.setTransform(x, 0, 0, y, -left * x, -top * y);
  context.imageSmoothingQuality = 'high';
  return context;
}
