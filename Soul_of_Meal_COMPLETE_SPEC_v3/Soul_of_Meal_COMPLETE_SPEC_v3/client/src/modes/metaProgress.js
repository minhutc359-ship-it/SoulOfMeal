import catalog from './metaCatalog.json' with { type: 'json' };

export const META = catalog;
export const SPIRITS = Object.fromEntries(catalog.characters.map(spirit => [spirit.id, spirit]));
export const BANNERS = Object.fromEntries(catalog.banners.map(banner => [banner.id, banner]));
export const STARTER_REWARDS = { quest: 'chr_som_003', boss: 'chr_som_007' };
export const MAX_PARTY = 5;

const integer = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;

export function newMeta() {
  return { profile: null, wallet: { ...META.welcomeWallet }, pity: {}, history: [] };
}

export function restoreMeta(value, legacy, legacyName) {
  const fresh = newMeta();
  const profile = value?.profile;
  return {
    profile: profile && validPlayerName(profile.name) && META.onboardingAvatars.includes(profile.avatar)
      ? { name: profile.name, avatar: profile.avatar, starter: META.starters.includes(profile.starter) ? profile.starter : null }
      : legacy ? { name: validPlayerName(legacyName) ? legacyName : 'Người Kết Vị', avatar: META.mascot, starter: null } : null,
    wallet: Object.fromEntries(Object.entries(fresh.wallet).map(([id, balance]) => [id, integer(value?.wallet?.[id], balance)])),
    pity: Object.fromEntries(META.banners.map(({ family }) => {
      const state = value?.pity?.[family];
      return [family, {
        sinceSsr: Math.min(META.ssrPity - 1, integer(state?.sinceSsr)),
        sinceSr: Math.min(META.srPity - 1, integer(state?.sinceSr)),
        featuredGuaranteed: state?.featuredGuaranteed === true,
        draws: integer(state?.draws),
      }];
    })),
    serverOwned: value?.serverOwned === true,
    appliedDuplicateEssence: integer(value?.appliedDuplicateEssence),
    history: Array.isArray(value?.history) ? value.history.filter(draw => draw && Object.hasOwn(BANNERS, draw.bannerId)
      && Array.isArray(draw.items) && draw.items.length && draw.items.every(item => item && Object.hasOwn(SPIRITS, item.id))).slice(0, 30) : [],
  };
}

export function validPlayerName(name) {
  return typeof name === 'string' && /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} _-]{1,17}[\p{L}\p{M}\p{N}]$/u.test(name);
}

const BASE_STATS = {
  guardian: [3450, 205, 146], fighter: [2940, 320, 98], support: [2600, 235, 83],
  healer: [2490, 226, 82], ranged: [2260, 375, 64], mage: [2210, 380, 63],
  controller: [2440, 295, 89], assassin: [2110, 415, 62],
};
const LEGACY_STATS = {
  chr_bunbo_holinh: [3000, 320, 100], chr_pho_lamvu: [2200, 390, 60],
  chr_goicuon_diepnhi: [2500, 250, 90], chr_banhbao_bachngoc: [3400, 210, 150],
  chr_caphe_davu: [2000, 430, 50],
};

export function spiritMember(id) {
  const { role, element } = SPIRITS[id];
  const [maxHp, atk, def] = LEGACY_STATS[id] ?? BASE_STATS[role];
  return { id, hp: maxHp, maxHp, atk, def, element, role, energy: 0 };
}

export function adventureParty(save) {
  const ids = save.adventure.party;
  return ids ? ids.map(id => save.roster.find(member => member.id === id)).filter(Boolean) : save.roster.slice(0, MAX_PARTY);
}

export function changeParty(save, id) {
  if (!save.roster.some(member => member.id === id)) throw new Error('Vị Linh chưa gia nhập.');
  const ids = adventureParty(save).map(member => member.id);
  if (ids.includes(id)) {
    if (ids.length === 1) throw new Error('Đội hình cần ít nhất một Vị Linh.');
    ids.splice(ids.indexOf(id), 1);
  } else {
    if (ids.length >= MAX_PARTY) throw new Error('Đội hình đã đủ 5 Vị Linh.');
    ids.push(id);
  }
  return { ...save, adventure: { ...save.adventure, party: ids } };
}

export function recruitSpirit(save, id, joinParty = false) {
  if (save.roster.some(member => member.id === id)) return false;
  const party = adventureParty(save).map(member => member.id);
  save.adventure.party ??= party;
  save.roster.push(spiritMember(id));
  if (joinParty && party.length < MAX_PARTY) save.adventure.party = [...party, id];
  return true;
}

export function finishOnboarding(save, { name, avatar, starter }) {
  if (save.meta.profile) throw new Error('Hồ sơ đã được tạo.');
  name = name.trim().normalize('NFC');
  if (!validPlayerName(name)) throw new Error('Tên cần 3–19 ký tự, gồm chữ, số, dấu cách, gạch nối hoặc gạch dưới.');
  if (!META.onboardingAvatars.includes(avatar) || !META.starters.includes(starter)) throw new Error('Chọn ảnh đại diện và một Vị Linh SR.');
  const next = structuredClone(save);
  next.meta.profile = { name, avatar, starter };
  next.player.name = name;
  next.roster = [];
  next.adventure.party = [];
  recruitSpirit(next, META.mascot, true);
  recruitSpirit(next, starter, true);
  return next;
}

export function bannerOdds(meta, banner) {
  const state = meta.pity[banner.family] ?? { sinceSsr: 0, sinceSr: 0, featuredGuaranteed: false, draws: 0 };
  const rates = state.sinceSsr >= META.ssrPity - 1 ? { N: 0, R: 0, SR: 0, SSR: 100 }
    : state.sinceSr >= META.srPity - 1 ? META.guaranteeRates : META.rates;
  return { state, rates, remaining: banner.limit ? Math.max(0, banner.limit - state.draws) : Infinity };
}

function randomPercent() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * 100;
}

export function drawSpirits(save, { bannerId, count, payment, key }, random = randomPercent) {
  const banner = Object.hasOwn(BANNERS, bannerId) ? BANNERS[bannerId] : null;
  if (!banner || ![1, 10].includes(count) || !['gem', 'ticket'].includes(payment) || !key)
    throw new Error('Lượt triệu hồi không hợp lệ.');
  const previous = save.meta.history.find(draw => draw.key === key);
  if (previous) {
    if (previous.bannerId !== bannerId || previous.count !== count || previous.payment !== payment)
      throw new Error('Mã giao dịch đã được sử dụng.');
    return { save, receipt: previous };
  }
  const next = structuredClone(save);
  const { remaining } = bannerOdds(next.meta, banner);
  if (remaining < count) throw new Error('Đã hết lượt của giao ước này.');
  const price = count * (payment === 'gem' ? META.gemCost : 1);
  if (next.meta.wallet[payment] < price) throw new Error('Không đủ vé hoặc Tinh Thạch.');
  next.meta.wallet[payment] -= price;
  const items = [];
  for (let index = 0; index < count; index++) {
    const { state, rates } = bannerOdds(next.meta, banner);
    const roll = random();
    let cumulative = 0;
    const rarity = Object.keys(rates).find(tier => roll < (cumulative += rates[tier]));
    const featured = rarity === 'SSR' && banner.featured;
    const isFeatured = featured && (state.featuredGuaranteed || random() < META.featuredChance);
    const pool = META.characters.filter(spirit => spirit.rarity === rarity && (!featured || (spirit.id === featured) === Boolean(isFeatured)));
    const { id } = pool[Math.floor(random() / 100 * pool.length)];
    const isNew = recruitSpirit(next, id);
    const essence = isNew ? 0 : META.duplicateEssence[rarity];
    next.player.essence += essence;
    items.push({ id, isNew, essence });
    next.meta.pity[banner.family] = {
      sinceSsr: rarity === 'SSR' ? 0 : state.sinceSsr + 1,
      sinceSr: ['SR', 'SSR'].includes(rarity) ? 0 : state.sinceSr + 1,
      featuredGuaranteed: featured ? !isFeatured : state.featuredGuaranteed,
      draws: state.draws + 1,
    };
  }
  const receipt = { key, bannerId, count, payment, items };
  next.meta.history = [receipt, ...next.meta.history].slice(0, 30);
  return { save: next, receipt };
}
