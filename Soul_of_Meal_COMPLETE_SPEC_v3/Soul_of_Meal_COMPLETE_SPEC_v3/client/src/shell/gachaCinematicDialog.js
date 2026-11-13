import { canvasContext, canvasResolution } from '../render/canvasSurface.js';
import { CINEMATIC_HEIGHT, CINEMATIC_WIDTH, drawGachaCinematic, loadGachaArt, planGachaCinematic } from '../render/gachaCinematic.js';

export function playGachaCinematic(dialog, receipt, { renderer, playCue, reducedMotion, onComplete }) {
  const plan = planGachaCinematic(receipt);
  const header = dialog.querySelector('.story-heading');
  dialog.classList.add('gacha-cinematic-dialog');
  dialog.dataset.cinematic = plan.multi ? 'multi' : plan.rarity;
  dialog.insertAdjacentHTML('beforeend', `<div class="gacha-cinematic-stage">
    <canvas width="${CINEMATIC_WIDTH}" height="${CINEMATIC_HEIGHT}" aria-hidden="true"></canvas>
    <button type="button" class="button light" data-gacha-skip>Bỏ qua</button>
  </div>`);
  const stage = dialog.querySelector('.gacha-cinematic-stage');
  const canvas = stage.querySelector('canvas');
  const skip = stage.querySelector('button');
  const heroRig = plan.ending === 'flame' ? renderer.rigs?.get(plan.spotlight.id) : null;
  header.classList.add('gacha-cinematic-heading');
  header.querySelector('button').hidden = true;
  skip.focus({ preventScroll: true });
  let frame;
  let complete = false;
  let start;
  let cue = 0;
  const wait = setTimeout(finish, 2500);

  function cancelPlayback() {
    clearTimeout(wait);
    cancelAnimationFrame(frame);
  }

  function finish() {
    if (complete) return;
    complete = true;
    cancelPlayback();
    if (!dialog.open) return;
    dialog.removeEventListener('cancel', skipOnBack);
    dialog.classList.remove('gacha-cinematic-dialog');
    delete dialog.dataset.cinematic;
    stage.remove();
    header.classList.remove('gacha-cinematic-heading');
    const close = header.querySelector('button');
    close.hidden = false;
    onComplete();
    close.focus({ preventScroll: true });
  }

  function skipOnBack(event) {
    event.preventDefault();
    finish();
  }

  skip.addEventListener('click', finish);
  dialog.addEventListener('cancel', skipOnBack);
  dialog.addEventListener('close', cancelPlayback, { once: true });

  loadGachaArt(plan, url => renderer.loadImage(url)).then(assets => {
    clearTimeout(wait);
    if (complete || !dialog.open) return;
    let lastDraw = -Infinity;
    const draw = now => {
      if (!dialog.open || !dialog.isConnected) return cancelPlayback();
      if (reducedMotion()) return finish();
      start ??= now;
      const elapsed = (now - start) / 1000;
      if (elapsed >= plan.duration) return finish();
      if (now - lastDraw < 32) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;
      const resolution = canvasResolution(canvas, CINEMATIC_WIDTH, CINEMATIC_HEIGHT, true, Math.min(devicePixelRatio, 1.5));
      const ctx = canvasContext(canvas, resolution, CINEMATIC_WIDTH, CINEMATIC_HEIGHT);
      if (!ctx) return finish();
      try {
        drawGachaCinematic(ctx, plan, assets, elapsed, heroRig);
        while (plan.cues[cue]?.time <= elapsed) {
          const sound = plan.cues[cue++];
          if (elapsed - sound.time < .45) playCue(sound.id, { gain: sound.gain, priority: true });
        }
      } catch (error) {
        console.warn('Không phát được cảnh triệu hồi.', error);
        return finish();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  }).catch(finish);
}
