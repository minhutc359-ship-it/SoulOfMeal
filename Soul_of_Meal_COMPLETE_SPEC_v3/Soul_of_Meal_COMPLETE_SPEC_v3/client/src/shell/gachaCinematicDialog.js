import { canvasContext, canvasResolution } from '../render/canvasSurface.js';
import { CINEMATIC_HEIGHT, CINEMATIC_WIDTH, drawGachaCinematic, loadGachaArt, planGachaCinematic } from '../render/gachaCinematic.js';

export const shouldPlayGachaCinematic = ({ fresh, reducedMotion }) => Boolean(fresh && !reducedMotion);

export function playGachaCinematic(dialog, receipt, { renderer, playCue, reducedMotion, onComplete }) {
  const plan = planGachaCinematic(receipt);
  const header = dialog.querySelector('.story-heading');
  dialog.classList.add('gacha-cinematic-dialog');
  dialog.dataset.cinematic = plan.multi ? 'multi' : plan.rarity;
  dialog.insertAdjacentHTML('beforeend', `<div class="gacha-cinematic-stage">
    <canvas width="${CINEMATIC_WIDTH}" height="${CINEMATIC_HEIGHT}" aria-label="Hoạt ảnh triệu hồi ${receipt.items.length} Vị Linh"></canvas>
    <p role="status" class="gacha-cinematic-status">Đang triệu hồi ×${receipt.items.length} · Hội tụ hương vị…</p>
    <button type="button" class="button light" data-gacha-skip>Bỏ qua</button>
  </div>`);
  const stage = dialog.querySelector('.gacha-cinematic-stage');
  const canvas = stage.querySelector('canvas');
  const skip = stage.querySelector('button');
  const status = stage.querySelector('[role=status]');
  const heroRig = plan.ending === 'flame' ? renderer.rigs?.get(plan.spotlight.id) : null;
  header.classList.add('gacha-cinematic-heading');
  header.querySelector('button').hidden = true;
  skip.focus({ preventScroll: true });
  let frame, previous;
  let elapsed = 0, cue = 0, phase = 0;
  let complete = false;
  // Start with already loaded assets. Slow or failed artwork never skips the intro.
  let assets = new Map(renderer.images ?? []);
  const resetClock = () => { previous = undefined; };
  document.addEventListener?.('visibilitychange', resetClock);

  function cancelPlayback() {
    cancelAnimationFrame(frame);
    document.removeEventListener?.('visibilitychange', resetClock);
  }
  function finish() {
    if (complete) return;
    complete = true;
    cancelPlayback();
    dialog.removeEventListener('cancel', skipOnBack);
    if (!dialog.open) return;
    dialog.classList.remove('gacha-cinematic-dialog');
    delete dialog.dataset.cinematic;
    stage.remove();
    header.classList.remove('gacha-cinematic-heading');
    const close = header.querySelector('button');
    close.hidden = false;
    onComplete();
    close.focus({ preventScroll: true });
  }
  function skipOnBack(event) { event.preventDefault(); finish(); }
  skip.addEventListener('click', finish);
  dialog.addEventListener('cancel', skipOnBack);
  dialog.addEventListener('close', () => {
    complete = true;
    cancelPlayback();
    dialog.removeEventListener('cancel', skipOnBack);
  }, { once: true });

  loadGachaArt(plan, url => renderer.loadImage(url)).then(loaded => {
    if (!complete) assets = loaded;
  }).catch(error => console.warn('Đang dùng hiệu ứng và ảnh đã tải cho cảnh triệu hồi.', error));

  let lastDraw = -Infinity;
  function draw(now) {
    if (complete || !dialog.open || !dialog.isConnected) return cancelPlayback();
    if (reducedMotion()) return finish();
    const delta = previous === undefined || document.hidden ? 0 : Math.max(0, (now - previous) / 1000);
    previous = now;
    elapsed += delta;
    if (elapsed >= plan.duration) return finish();
    if (!document.hidden && now - lastDraw >= 32) {
      lastDraw = now;
      const resolution = canvasResolution(canvas, CINEMATIC_WIDTH, CINEMATIC_HEIGHT, true, Math.min(globalThis.devicePixelRatio ?? 1, 1.5));
      const ctx = canvasContext(canvas, resolution, CINEMATIC_WIDTH, CINEMATIC_HEIGHT);
      if (!ctx) return finish();
      try {
        drawGachaCinematic(ctx, plan, assets, elapsed, heroRig);
        while (plan.cues[cue]?.time <= elapsed) {
          const sound = plan.cues[cue++];
          if (elapsed - sound.time < .45) playCue(sound.id, { gain: sound.gain, priority: true });
        }
        const next = elapsed >= plan.reveal ? 2 : elapsed >= plan.impact ? 1 : 0;
        if (phase !== next) {
          phase = next;
          status.textContent = `Đang triệu hồi ×${receipt.items.length} · ${next === 1 ? 'Ấn giao ước thức tỉnh…' : 'Chuẩn bị lật thẻ…'}`;
        }
      } catch (error) {
        console.warn('Không phát được cảnh triệu hồi.', error);
        return finish();
      }
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
}
