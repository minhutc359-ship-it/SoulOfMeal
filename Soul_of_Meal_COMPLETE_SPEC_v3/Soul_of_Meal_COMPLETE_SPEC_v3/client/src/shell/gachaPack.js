import { SPIRITS } from '../modes/metaProgress.js';
import { cardBackIllustration, spiritIllustration, escapeArtText as text } from '../render/cardArtwork.js';
import { actorArt } from '../render/spriteAssets.js';

const ELEMENTS = { fire: 'Hỏa', water: 'Thủy', wood: 'Mộc', light: 'Quang', shadow: 'Âm' };

// Presentation reads the settled receipt: no rerolling, sorting or deduplication.
export function gachaResultCard(item, index, { profile = false, hd = false } = {}) {
  const spirit = SPIRITS[item.id];
  const art = spiritIllustration(item.id);
  const tag = profile ? 'button' : 'article';
  return `<${tag} class="gacha-art-card" data-rarity="${spirit.rarity}" data-result-index="${index}"
    ${profile ? `type="button" data-result-profile="${text(item.id)}" aria-label="Xem hồ sơ ${text(spirit.name)}"` : `aria-label="${text(spirit.name)} · ${spirit.rarity}"`}>
    <img src="${text(hd ? art?.hd ?? art?.preview ?? actorArt(item.id) : art?.preview ?? actorArt(item.id))}"
      ${hd && art ? `data-fallback-art="${text(art.preview)}"` : ''} alt="Minh họa ${text(spirit.name)}" decoding="async">
    <span class="gacha-card-top"><b>${spirit.rarity}</b><small>${ELEMENTS[spirit.element]}</small></span>
    <span class="gacha-card-caption"><strong>${text(spirit.name)}</strong>
      <small>${item.isNew ? 'MỚI · Đã thêm vào bộ sưu tập' : `Trùng · +${item.essence} Tinh Hoa`}</small></span>
    <span class="gacha-card-number">${String(index + 1).padStart(2, '0')} · SOUL OF MEAL</span>
  </${tag}>`;
}

export function revealGacha(host, receipt, { onProfile, onComplete, reducedMotion, playCue } = {}) {
  const items = receipt.items;
  let shown = 0;
  let completed = false;
  const root = document.createElement('section');
  root.className = 'gacha-pack-reader';
  root.dataset.motion = reducedMotion ? 'reduced' : 'full';
  root.innerHTML = `<p class="gacha-pack-progress" role="status" aria-live="polite">${items.length === 10 ? 'Gói Giao Ước · 10 lá Vị Linh' : 'Giao Ước Vị Linh'}</p>
    <div class="gacha-pack-stage">
      <div class="gacha-sealed-pack" aria-hidden="true"><img src="${cardBackIllustration().preview}" alt="">
        <span>GIAO ƯỚC VỊ LINH<b>${items.length} LÁ</b></span></div>
      <div class="gacha-pack-spotlight" hidden></div>
    </div>
    <div class="action-row gacha-pack-actions"><button type="button" class="button" data-pack-next>${items.length === 10 ? 'Mở gói 10 lá' : 'Lật thẻ đầu tiên'}</button>
      <button type="button" class="button light" data-reveal-all>Hiện tất cả</button></div>
    <div class="meta-reveal-grid gacha-summary" data-result-count="${items.length}" aria-label="Toàn bộ kết quả triệu hồi" hidden></div>`;
  host.append(root);
  const stage = root.querySelector('.gacha-pack-stage');
  const spotlight = root.querySelector('.gacha-pack-spotlight');
  const pack = root.querySelector('.gacha-sealed-pack');
  const progress = root.querySelector('[role=status]');
  const next = root.querySelector('[data-pack-next]');
  const all = root.querySelector('[data-reveal-all]');
  const summary = root.querySelector('.gacha-summary');
  function finish() {
    if (completed) return;
    completed = true;
    onComplete?.();
  }
  function showSummary() {
    stage.hidden = true;
    next.hidden = true;
    all.hidden = true;
    summary.innerHTML = items.map((item, index) => gachaResultCard(item, index, { profile: Boolean(onProfile) })).join('');
    summary.hidden = false;
    progress.textContent = `Đã nhận đủ ${items.length}/${items.length} Vị Linh · ${items.filter(item => item.isNew).length} mới`;
    finish();
  }
  function showNext() {
    if (shown === items.length) return showSummary();
    const item = items[shown];
    pack.hidden = true;
    spotlight.hidden = false;
    spotlight.innerHTML = gachaResultCard(item, shown, { hd: true });
    stage.dataset.rarity = SPIRITS[item.id].rarity;
    shown += 1;
    progress.textContent = `Lá ${shown}/${items.length} · ${SPIRITS[item.id].rarity} · ${SPIRITS[item.id].name}`;
    next.textContent = shown === items.length ? 'Xem toàn bộ kết quả' : `Lật lá tiếp theo · ${shown + 1}/${items.length}`;
    playCue?.(SPIRITS[item.id].rarity === 'SSR' ? 'sfx_victory' : 'sfx_ui_confirm', { gain: .55 });
    if (shown === items.length) finish();
  }
  next.addEventListener('click', showNext);
  all.addEventListener('click', showSummary);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-result-profile]');
    if (button && onProfile) { host.close?.(); onProfile(button.dataset.resultProfile); }
  });
  root.addEventListener('error', event => {
    const img = event.target;
    if (img.dataset?.fallbackArt) { img.src = img.dataset.fallbackArt; delete img.dataset.fallbackArt; }
  }, true);
  if (reducedMotion) showSummary();
  else if (items.length === 1) showNext();
}
