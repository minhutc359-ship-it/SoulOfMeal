export function battleResultCover(outcome) {
  const title = outcome === 'victory' ? 'Chiến thắng' : outcome === 'draw' ? 'Hòa trận' : 'Thất bại';
  const art = outcome === 'defeat' ? 'defeat' : 'victory';
  return `<button type="button" class="battle-result-art" data-result-continue aria-label="${title}. Chạm để tiếp tục">
    <img src="./assets/original/ui/battle-${art}.webp" alt="" width="1200" height="800">
    <span class="battle-result-caption"><strong>${title}</strong><span>Chạm để tiếp tục</span></span>
  </button>`;
}

export function bindBattleResultCover(dialog) {
  const cover = dialog.querySelector('[data-result-continue]');
  const details = dialog.querySelector('[data-result-details]');
  cover.addEventListener('click', () => {
    const next = details.querySelector('[data-battle-result], [data-tcg-new], [data-chess-next], [data-chess-new]');
    if (next && !details.querySelector('[data-chess-loot]')) {
      dialog.close();
      next.click();
      return;
    }
    // A neutral-round item choice still needs the player's explicit selection.
    cover.hidden = true;
    details.hidden = false;
    dialog.classList.remove('battle-result-cover');
    details.querySelector('button')?.focus({ preventScroll: true });
  }, { once: true });
  cover.focus({ preventScroll: true });
}
