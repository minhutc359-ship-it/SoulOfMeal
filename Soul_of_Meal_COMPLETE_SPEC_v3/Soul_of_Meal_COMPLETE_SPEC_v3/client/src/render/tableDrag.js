/** One pointer owns a gesture. Rules stay in each mode's drop callback. */
export function bindTableDrag(surface, { sources, read, locate, drop, inspect, preview }) {
  let gesture;
  let suppressClick = false;
  const doc = surface.ownerDocument;

  function clear() {
    if (!gesture) return;
    const old = gesture;
    gesture = null;
    clearTimeout(old.hold);
    old.mark?.removeAttribute('data-drop-state');
    old.source.removeAttribute('data-dragging');
    old.ghost?.remove();
    old.listeners.abort();
    if (old.source.hasPointerCapture(old.id)) old.source.releasePointerCapture(old.id);
    return old;
  }

  function cancel() {
    if (gesture?.active) suppressClick = true;
    clear();
  }

  surface.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  surface.addEventListener('pointerdown', event => {
    if (gesture || event.button !== 0 || !event.isPrimary || doc.querySelector('dialog[open]')) return;
    suppressClick = false;
    const source = event.target.closest(sources);
    const payload = source && read(source);
    if (!payload) return;
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    const { clientX: x, clientY: y, pointerId: id } = event;
    gesture = { source, payload, id, x, y, listeners };
    if (inspect) gesture.hold = setTimeout(() => {
      const held = clear();
      if (held && surface.isConnected) {
        suppressClick = true;
        inspect(payload, source);
      }
    }, 380);

    doc.addEventListener('pointermove', event => {
      if (event.pointerId !== id || !gesture) return;
      if (!surface.isConnected) return cancel();
      if (!gesture.active && Math.hypot(event.clientX - x, event.clientY - y) < 7) return;
      clearTimeout(gesture.hold);
      if (event.pointerType !== 'touch') event.preventDefault();
      if (!gesture.active) {
        gesture.active = true;
        source.dataset.dragging = '';
        source.setPointerCapture(id);
        gesture.ghost = doc.createElement('div');
        gesture.ghost.className = 'table-drag-ghost';
        gesture.ghost.setAttribute('aria-hidden', 'true');
        preview(payload, gesture.ghost, source);
        doc.body.append(gesture.ghost);
      }
      const target = locate(payload, doc.elementFromPoint(event.clientX, event.clientY));
      if (gesture.mark !== target?.element) gesture.mark?.removeAttribute('data-drop-state');
      gesture.mark = target?.element;
      if (target) target.element.dataset.dropState = target.state;
      gesture.ghost.dataset.valid = String(Boolean(target && target.state !== 'blocked'));
      gesture.ghost.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    }, { ...options, passive: false });

    doc.addEventListener('pointerup', event => {
      if (event.pointerId !== id || !gesture) return;
      const target = gesture.active && surface.isConnected && locate(payload, doc.elementFromPoint(event.clientX, event.clientY));
      const old = clear();
      if (!old.active) {
        // Convert a touch tap exactly once, even after browser pointer capture has changed.
        if (event.pointerType === 'touch' && source.matches('button') && event.target.closest(sources) === source) {
          const tap = touch => {
            if (!surface.isConnected) return;
            touch.preventDefault();
            source.click();
          };
          doc.addEventListener('touchend', tap, { once: true, capture: true, passive: false });
          setTimeout(() => doc.removeEventListener('touchend', tap, true), 300);
        }
        return;
      }
      suppressClick = true;
      if (target && target.state !== 'blocked') drop(payload, target);
    }, options);
    doc.addEventListener('pointercancel', event => { if (event.pointerId === id) cancel(); }, options);
    source.addEventListener('lostpointercapture', event => { if (event.target === source) cancel(); }, options);
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); }, options);
    doc.defaultView.addEventListener('blur', cancel, options);
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) cancel(); }, options);
  });

  // Prevent browser image/text drag from competing with the pointer gesture.
  surface.addEventListener('dragstart', event => { if (event.target.closest(sources)) event.preventDefault(); });
}

export function paintTableGhost(ghost, image, label) {
  if (image) {
    const art = ghost.ownerDocument.createElement('img');
    art.src = image;
    art.alt = '';
    ghost.append(art);
  }
  const title = ghost.ownerDocument.createElement('b');
  title.textContent = label;
  ghost.append(title);
}
