export async function animatePuzzleStep(board, step, reducedMotion) {
  if (reducedMotion || !board?.animate) return;
  const tiles = [...board.querySelectorAll('[data-puzzle-cell]')];
  const animations = [];
  if (step.kind === 'clear') {
    for (const at of step.cells) animations.push(tiles[at].animate([
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.15)', filter: 'brightness(1.9)', offset: .35 },
      { transform: 'scale(.15)', opacity: 0 },
    ], { duration: 360, fill: 'forwards', easing: 'ease-in' }));
  } else {
    const cell = tiles[0].getBoundingClientRect();
    const next = tiles[1].getBoundingClientRect();
    const stride = next.left - cell.left;
    for (const { from, to } of step.movements ?? []) {
      const x = ((from % step.size + step.size) % step.size - to % step.size) * stride;
      const y = (Math.floor(from / step.size) - Math.floor(to / step.size)) * stride;
      animations.push(tiles[to].animate([
        { transform: `translate(${x}px, ${y}px)`, opacity: from < 0 ? .2 : 1 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ], { duration: step.kind === 'swap' ? 300 : 430, easing: 'cubic-bezier(.2,.8,.3,1)' }));
    }
    if (!animations.length) animations.push(board.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 300 }));
  }
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
}
