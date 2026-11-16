const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bound = new WeakSet();
const handled = new WeakSet();

/** Every fallback belongs to the same character; never substitute another portrait. */
export function artworkImage(art, { hd = false, fallback, className = '', alt = '', characterId = '', lazy = false } = {}) {
  const sources = [...new Set([art?.preview, fallback].filter(Boolean))];
  if (!sources.length) return '';
  return `<img class="${escape(className)}" src="${escape(sources[0])}" alt="${escape(alt)}"
    data-art-character="${escape(characterId)}" data-art-fallbacks="${escape(JSON.stringify(sources.slice(1)))}"
    ${hd && art?.hd && art.hd !== sources[0] ? `data-art-hd="${escape(art.hd)}" fetchpriority="high"` : ''}
    decoding="async"${lazy ? ' loading="lazy"' : ''}>`;
}

/** Keep the preview on screen until the HD bytes are ready to paint. */
export function upgradeArtworkImage(image, createImage = () => new Image()) {
  const hd = image.dataset.artHd;
  if (!hd) return;
  delete image.dataset.artHd;
  const preview = image.getAttribute('src');
  const preload = createImage();
  preload.onload = () => {
    if (image.isConnected === false) return;
    const fallbacks = JSON.parse(image.dataset.artFallbacks ?? '[]');
    image.dataset.artFallbacks = JSON.stringify([...new Set([preview, ...fallbacks])]);
    image.setAttribute('src', hd);
    image.dataset.artQuality = 'hd';
  };
  preload.onerror = () => { image.dataset.artQuality = 'preview'; };
  preload.src = hd;
}

export function advanceArtworkFallback(image) {
  delete image.dataset.artHd;
  const queue = JSON.parse(image.dataset.artFallbacks ?? '[]');
  const current = image.getAttribute('src');
  const next = queue.findIndex(url => url !== current);
  if (next < 0) {
    image.dataset.artUnavailable = 'true';
    return false;
  }
  image.dataset.artFallbacks = JSON.stringify(queue.slice(next + 1));
  image.setAttribute('src', queue[next]);
  return true;
}

// Capture before image insertion: cached failures must not race per-screen listeners.
export function bindArtworkFallbacks(host) {
  if (bound.has(host)) return;
  bound.add(host);
  host.addEventListener('error', event => {
    const image = event.target;
    if (handled.has(event) || !image?.hasAttribute?.('data-art-fallbacks')) return;
    handled.add(event);
    advanceArtworkFallback(image);
  }, true);
  host.addEventListener('load', event => {
    const image = event.target;
    if (image?.hasAttribute?.('data-art-hd')) upgradeArtworkImage(image);
  }, true);
}
