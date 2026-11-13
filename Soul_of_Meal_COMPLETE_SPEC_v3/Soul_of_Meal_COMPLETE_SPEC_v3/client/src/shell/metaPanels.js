import { ADVENTURE_OFFERS, GEAR_MAX_LEVEL, GEAR_SLOTS, STORE_UPGRADE_GOLD, STORE_UPGRADE_STONES, itemBonus } from '../modes/adventureStore.js';
import { BANNERS, META, SPIRITS, bannerOdds } from '../modes/metaProgress.js';
import { actorArt, cutinArt, HERO_NAMES } from '../render/spriteAssets.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const RARITIES = Object.keys(META.rates);
const ELEMENTS = { fire: 'Hỏa', water: 'Thủy', wood: 'Mộc', light: 'Quang', shadow: 'Âm' };
const signs = { fire: '✹', water: '◈', wood: '✿', light: '✦', shadow: '☾' };
const statNames = { atk: 'ATK', def: 'DEF', maxHp: 'HP', speed: 'tốc độ/giây' };

export function spiritImage(id, large = false) {
  const art = actorArt(id);
  if (art) return `<img class="spirit-art" src="${escapeHtml(large && Object.hasOwn(HERO_NAMES, id) ? cutinArt(id) : art)}" alt="">`;
  const spirit = Object.hasOwn(SPIRITS, id) ? SPIRITS[id] : null;
  return `<span aria-hidden="true" class="spirit-emblem element-${spirit?.element ?? 'light'}">${signs[spirit?.element] ?? '✦'}</span>`;
}

export function renderOnboarding(app, name, create) {
  app.innerHTML = `<main class="entry entry-onboarding"><form class="meta-onboarding panel">
    <header><h1>Gặp gỡ Vị Linh</h1><p>Lilia tặng bạn Bánh Bao Bạch Ngọc. Chọn thêm một Vị Linh SR để cùng khám phá Làng Ẩm Thực.</p></header>
    <label>Tên Người Kết Vị<input name="name" maxlength="19" required autocomplete="nickname"></label>
    <fieldset><legend>Ảnh đại diện</legend><div class="meta-avatar-options">${META.onboardingAvatars.map((id, index) =>
      `<label title="${SPIRITS[id].name}"><input type="radio" name="avatar" value="${id}" ${index === 0 ? 'checked' : ''} aria-label="${SPIRITS[id].name}">${spiritImage(id)}</label>`).join('')}</div></fieldset>
    <fieldset><legend>Vị Linh đồng hành</legend><div class="meta-starter-options">${META.starters.map(id =>
      `<label><input type="radio" name="starter" value="${id}" required>${spiritImage(id)}<b>${SPIRITS[id].name}</b><small>${ELEMENTS[SPIRITS[id].element]} · SR</small></label>`).join('')}</div></fieldset>
    <button type="submit" class="button">Vào Làng Ẩm Thực</button><p class="notice" role="status"></p>
  </form></main>`;
  const form = app.querySelector('form');
  form.elements.name.value = name ?? '';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await create(Object.fromEntries(new FormData(form)));
    } catch (error) {
      form.querySelector('[role=status]').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}

export function gachaPanel(save, bannerId, payment) {
  const banner = BANNERS[bannerId];
  const { state, remaining } = bannerOdds(save.meta, banner);
  const highlight = SPIRITS[banner.featured ?? META.mascot];
  const drawButton = count => {
    const cost = count * (payment === 'gem' ? META.gemCost : 1);
    return `<button type="button" class="button" data-gacha-draw="${count}" ${remaining < count || save.meta.wallet[payment] < cost ? 'disabled' : ''}>Triệu hồi ${count} · ${cost} ${payment === 'gem' ? 'Tinh Thạch' : 'vé'}</button>`;
  };
  return `<section class="meta-gacha panel">
    <div class="meta-banner-tabs" role="group" aria-label="Chọn giao ước">${META.banners.map(item =>
      `<button class="button light" data-gacha-banner="${item.id}" aria-pressed="${item.id === banner.id}">${item.name}</button>`).join('')}</div>
    <div class="meta-gacha-hero" data-rarity="${highlight.rarity}">${spiritImage(highlight.id, true)}</div>
    <div class="meta-gacha-controls">
      <h2>${banner.featured ? highlight.name : banner.name}</h2>
      ${banner.featured ? '<p>Vị Linh SSR nổi bật</p>' : ''}
      <p class="meta-wallet">${save.meta.wallet.gem} Tinh Thạch · ${save.meta.wallet.ticket} vé</p>
      <p>SSR sau tối đa ${META.ssrPity - state.sinceSsr} lượt · SR trở lên sau tối đa ${META.srPity - state.sinceSr} lượt</p>
      ${banner.featured ? `<p>Khi ra SSR, ${state.featuredGuaranteed ? 'bảo đảm ra Vị Linh nổi bật.' : 'có 50% cơ hội ra Vị Linh nổi bật.'}</p>` : ''}
      ${Number.isFinite(remaining) ? `<p>Còn ${remaining}/${banner.limit} lượt.</p>` : ''}
      <div class="action-row"><label>Thanh toán <select data-gacha-payment>
        <option value="ticket" ${payment === 'ticket' ? 'selected' : ''}>Vé triệu hồi</option>
        <option value="gem" ${payment === 'gem' ? 'selected' : ''}>Tinh Thạch</option></select></label></div>
      <div class="action-row">${drawButton(1)}${drawButton(10)}</div>
      <div class="action-row"><button class="button light" data-gacha-odds>Tỷ lệ</button><button class="button light" data-gacha-history>Lịch sử</button></div>
      ${!Number.isFinite(remaining) && remaining >= 1 && save.meta.wallet[payment] < (payment === 'gem' ? META.gemCost : 1)
        ? `<p class="muted-copy">${save.meta.serverOwned ? 'Đổi loại thanh toán để dùng số dư còn lại.' : 'Nhận thêm vé khi vượt ải Adventure lần đầu.'}</p>` : ''}
    </div>
  </section>`;
}

export function gachaOdds(save, banner) {
  const { rates } = bannerOdds(save.meta, banner);
  return `<p>Tỷ lệ của lượt kế tiếp. Bảo đảm tính riêng theo nhóm giao ước.</p>
    <table class="meta-odds"><thead><tr><th>Độ hiếm</th><th>Cơ bản</th><th>Lượt kế</th></tr></thead><tbody>
    ${RARITIES.map(tier => `<tr><th>${tier}</th><td>${META.rates[tier]}%</td><td>${rates[tier]}%</td></tr>`).join('')}</tbody></table>
    <p>Từ lượt ${META.srPity} liên tiếp thiếu SR trở lên, áp dụng 86% SR và 14% SSR. Từ lượt ${META.ssrPity} liên tiếp thiếu SSR, áp dụng 100% SSR.</p>
    ${banner.featured ? '<p>Nếu SSR vừa nhận thuộc nhóm thường, SSR kế tiếp trong nhóm giao ước nổi bật sẽ là Vị Linh quảng bá.</p>' : ''}
    <p class="muted-copy">Tỷ lệ và chi phí đang dùng cho bản chơi thử.</p>`;
}

export function revealGacha(dialog, receipt, onProfile, reducedMotion) {
  let shown = 0;
  let timer;
  const spotlight = receipt.items.find(item => SPIRITS[item.id].rarity === 'SSR');
  const star = spotlight && SPIRITS[spotlight.id];
  if (star && !reducedMotion) dialog.classList.add('meta-ssr-dialog');
  dialog.insertAdjacentHTML('beforeend', `${star && !reducedMotion ? `<figure class="meta-ssr-cut" data-rarity="SSR" hidden>
      ${spiritImage(star.id, true)}<figcaption><small>SSR · ${ELEMENTS[star.element]}</small><strong>${star.name}</strong></figcaption></figure>` : ''}
    <div class="meta-reveal-grid">${receipt.items.map(({ id, isNew, essence }) => {
    const spirit = SPIRITS[id];
    return `<div class="meta-reveal-card" data-rarity="${spirit.rarity}" data-revealed="false">
      <span class="meta-card-back" aria-hidden="true">✦</span>
      <button class="meta-card-front" data-result-profile="${id}" disabled>${spiritImage(id)}
      <small>${spirit.rarity}</small><b>${spirit.name}</b><span>${isNew ? 'Mới' : '+' + essence + ' Tinh Hoa'}</span></button></div>`;
  }).join('')}</div>
  <div class="action-row"><button class="button" data-reveal-all>Hiện tất cả</button></div>`);
  const cards = [...dialog.querySelectorAll('.meta-reveal-card')];
  const skip = dialog.querySelector('[data-reveal-all]');
  const cut = dialog.querySelector('.meta-ssr-cut');
  const closeCut = () => {
    if (cut) cut.hidden = true;
    dialog.classList.remove('meta-ssr-dialog');
  };
  function showNext() {
    const card = cards[shown++];
    card.dataset.revealed = 'true';
    card.querySelector('button').disabled = false;
    if (shown === cards.length) skip.hidden = true;
  }
  function showAll() {
    clearTimeout(timer);
    closeCut();
    while (shown < cards.length) showNext();
  }
  function animate() {
    showNext();
    if (cut && receipt.items[shown - 1] === spotlight) {
      cut.hidden = false;
      skip.hidden = false;
      timer = setTimeout(() => {
        closeCut();
        if (shown < cards.length) animate();
        else skip.hidden = true;
      }, 2400);
    } else if (shown < cards.length) timer = setTimeout(animate, 190);
  }
  skip.addEventListener('click', showAll);
  for (const button of dialog.querySelectorAll('[data-result-profile]')) {
    button.addEventListener('click', () => { dialog.close(); onProfile(button.dataset.resultProfile); });
  }
  dialog.addEventListener('close', () => clearTimeout(timer), { once: true });
  if (reducedMotion) showAll();
  else timer = setTimeout(animate, 380);
}

export function gachaHistory(save) {
  if (!save.meta.history.length) return '<p>Chưa có lượt triệu hồi.</p>';
  return `<ol class="meta-history">${save.meta.history.map((draw, index) => {
    const banner = Object.hasOwn(BANNERS, draw.bannerId) ? BANNERS[draw.bannerId] : null;
    if (!banner || !Array.isArray(draw.items)) return '';
    return `<li><div><strong>${banner.name}</strong><small>${draw.items.map(item => escapeHtml(SPIRITS[item.id]?.name ?? '')).join(' · ')}</small></div>
      <button class="button light" data-gacha-receipt="${index}">Xem lại</button></li>`;
  }).join('')}</ol>`;
}

export function storeDetail(offer, level = 1) {
  return offer.detail ?? `${GEAR_SLOTS[offer.slot]} · +${offer.stat === 'speed' ? Math.round(itemBonus(offer, level) * 30) : itemBonus(offer, level)} ${statNames[offer.stat]}`;
}

export function inventoryRows(save, member, options = {}) {
  const { stacks, gear } = save.adventure.inventory;
  const rows = options.equipmentOnly ? [] : Object.entries(stacks).filter(([, count]) => count > 0).map(([id, count]) => {
    const offer = ADVENTURE_OFFERS[id];
    return `<li><div><strong>${offer.name} ×${count}</strong><small>${storeDetail(offer)}</small></div>
      <div class="action-row">${offer.heal ? `<button class="button light" data-store-action="use" data-item="${id}" ${member.hp >= member.maxHp ? 'disabled' : ''}>Dùng</button>` : ''}
      <button class="button light" data-store-action="sell" data-item="${id}">Bán · ${Math.floor(offer.price / 2)} ◈</button></div></li>`;
  });
  for (const [id, entry] of Object.entries(gear)) {
    const offer = ADVENTURE_OFFERS[entry.item];
    const owner = SPIRITS[entry.owner]?.name;
    const belongs = entry.owner === member.id;
    rows.push(`<li><div><strong>${offer.name} · Cấp ${entry.level}</strong>
      <small>${storeDetail(offer, entry.level)}${owner ? ' · ' + escapeHtml(owner) : ''}</small></div><div class="action-row">
      ${belongs || !entry.owner ? `<button class="button light" data-store-action="${belongs ? 'unequip' : 'equip'}" data-item="${id}">${belongs ? 'Tháo' : 'Trang bị'}</button>` : ''}
      ${entry.level < GEAR_MAX_LEVEL ? `<button class="button light" data-store-action="upgrade" data-item="${id}" ${(stacks.upgrade_stone ?? 0) < STORE_UPGRADE_STONES || save.player.gold < STORE_UPGRADE_GOLD * entry.level ? 'disabled' : ''}>Tinh luyện · ${STORE_UPGRADE_GOLD * entry.level} ◈ + 1 đá</button>` : ''}
      <button class="button light" data-store-action="lock" data-item="${id}">${entry.locked ? 'Mở khóa' : 'Khóa'}</button>
      ${entry.owner || entry.locked ? '' : `<button class="button light" data-store-action="sell" data-item="${id}">Bán · ${Math.floor(offer.price / 2)} ◈</button>`}</div></li>`);
  }
  return rows.length ? `<ul class="meta-inventory">${rows.join('')}</ul>` : '<p>Túi đồ đang trống.</p>';
}
