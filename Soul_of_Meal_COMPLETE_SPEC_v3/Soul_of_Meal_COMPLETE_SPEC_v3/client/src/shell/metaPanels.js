import { ADVENTURE_OFFERS, GEAR_MAX_LEVEL, GEAR_SLOTS, STORE_UPGRADE_GOLD, STORE_UPGRADE_STONES, itemBonus } from '../modes/adventureStore.js';
import { BANNERS, META, SPIRITS, bannerOdds, starterSpirits } from '../modes/metaProgress.js';
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
  app.innerHTML = `<main class="entry entry-onboarding"><form class="meta-onboarding panel" aria-labelledby="onboarding-title">
    <h1 id="onboarding-title" tabindex="-1">Gặp gỡ Vị Linh</h1><p>Nhập tên để triệu hồi miễn phí hai Vị Linh đồng hành.</p>
    <label>Tên Người Kết Vị<input name="name" minlength="3" maxlength="19" required autocomplete="nickname"></label>
    <button type="submit" class="button">Triệu hồi Vị Linh</button><p class="notice" role="status"></p>
  </form></main>`;
  const form = app.querySelector('form');
  const submit = form.querySelector('[type=submit]');
  const status = form.querySelector('[role=status]');
  form.elements.name.value = name ?? '';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = 'Đang chuẩn bị giao ước…';
    try {
      await create(form.elements.name.value);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}

export function renderStarterReveal(app, profile, continueTo, reducedMotion) {
  app.innerHTML = `<main class="entry entry-onboarding starter-summon"><section class="meta-onboarding panel" aria-labelledby="starter-title">
    <h1 id="starter-title" tabindex="-1">Giao Ước Khởi Đầu</h1><p>Hai Vị Linh sẽ cùng bạn khám phá Làng Ẩm Thực.</p>
    <div data-starter-reveal></div>
    <div class="action-row starter-actions">
      <button class="button" type="button" data-starter-next="adventure" disabled>Vào Làng Ẩm Thực</button>
      <button class="button light" type="button" data-starter-next="gacha" disabled>Đến Gacha</button>
    </div>
    <p class="notice" role="status"></p>
  </section></main>`;
  const items = starterSpirits(profile).map(id => ({ id, isNew: true, essence: 0 }));
  const buttons = app.querySelectorAll('[data-starter-next]');
  revealGacha(app.querySelector('[data-starter-reveal]'), { items }, {
    reducedMotion,
    onComplete: () => {
      for (const button of buttons) button.disabled = false;
      if (app.ownerDocument.activeElement === app.querySelector('[data-reveal-all]')) buttons[0].focus();
    },
  });
  for (const button of buttons) {
    button.addEventListener('click', () => {
      try {
        continueTo(button.dataset.starterNext);
      } catch (error) {
        app.querySelector('.starter-summon [role=status]').textContent = error.message;
      }
    });
  }
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

export function revealGacha(host, receipt, { onProfile, onComplete, reducedMotion }) {
  let shown = 0;
  let timer;
  const spotlight = receipt.items.find(item => SPIRITS[item.id].rarity === 'SSR');
  const star = spotlight && SPIRITS[spotlight.id];
  if (star && !reducedMotion) host.classList.add('meta-ssr-dialog');
  host.insertAdjacentHTML('beforeend', `${star && !reducedMotion ? `<figure class="meta-ssr-cut" data-rarity="SSR" hidden>
      ${spiritImage(star.id, true)}<figcaption><small>SSR · ${ELEMENTS[star.element]}</small><strong>${star.name}</strong></figcaption></figure>` : ''}
    <div class="meta-reveal-grid">${receipt.items.map(({ id, isNew, essence }) => {
    const spirit = SPIRITS[id];
    const front = onProfile ? `<button class="meta-card-front" data-result-profile="${id}" disabled>` : '<div class="meta-card-front">';
    return `<div class="meta-reveal-card" data-rarity="${spirit.rarity}" data-revealed="false">
      <span class="meta-card-back" aria-hidden="true">✦</span>
      ${front}${spiritImage(id)}<small>${spirit.rarity} · ${ELEMENTS[spirit.element]}</small>
      <b>${spirit.name}</b><span>${isNew ? 'Mới' : '+' + essence + ' Tinh Hoa'}</span>
      ${onProfile ? '</button>' : '</div>'}</div>`;
  }).join('')}</div>
  <div class="action-row"><button class="button" type="button" data-reveal-all>Hiện tất cả</button></div>`);
  const cards = [...host.querySelectorAll('.meta-reveal-card')];
  const skip = host.querySelector('[data-reveal-all]');
  const cut = host.querySelector('.meta-ssr-cut');
  function finish() {
    onComplete?.();
    skip.hidden = true;
  }
  function closeCut() {
    if (cut) cut.hidden = true;
    host.classList.remove('meta-ssr-dialog');
  }
  function showNext() {
    const card = cards[shown++];
    card.dataset.revealed = 'true';
    const button = card.querySelector('button');
    if (button) button.disabled = false;
  }
  function showAll() {
    clearTimeout(timer);
    closeCut();
    while (shown < cards.length) showNext();
    finish();
  }
  function animate() {
    if (!host.isConnected) return;
    showNext();
    if (cut && receipt.items[shown - 1] === spotlight) {
      cut.hidden = false;
      timer = setTimeout(() => {
        closeCut();
        if (shown < cards.length) animate();
        else finish();
      }, 2400);
    } else if (shown < cards.length) timer = setTimeout(animate, onProfile ? 190 : 460);
    else finish();
  }
  skip.addEventListener('click', showAll);
  for (const button of host.querySelectorAll('[data-result-profile]')) {
    button.addEventListener('click', () => { host.close(); onProfile(button.dataset.resultProfile); });
  }
  host.addEventListener('close', () => clearTimeout(timer), { once: true });
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
