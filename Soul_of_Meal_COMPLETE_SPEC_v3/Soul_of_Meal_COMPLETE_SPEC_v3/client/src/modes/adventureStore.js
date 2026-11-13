// PROPOSED practice prices use the existing Adventure gold scale.
export const ADVENTURE_OFFERS = {
  potion_small: { name: 'Canh Bổ Dưỡng Nhỏ', category: 'consumable', price: 24, heal: .25, detail: 'Hồi 25% HP ngoài trận.' },
  potion_medium: { name: 'Canh Bổ Dưỡng Lớn', category: 'consumable', price: 55, heal: .5, detail: 'Hồi 50% HP ngoài trận.' },
  basic_sword: { name: 'Kiếm Gỗ Gia Vị', category: 'gear', price: 85, slot: 'weapon', stat: 'atk', bonus: 24 },
  basic_robe: { name: 'Áo Choàng Rừng Non', category: 'gear', price: 75, slot: 'armor', stat: 'def', bonus: 18 },
  lantern_ring: { name: 'Nhẫn Đèn Lồng', category: 'gear', price: 70, slot: 'accessory', stat: 'speed', bonus: .48 },
  flavor_seal: { name: 'Pháp Ấn Vị Nguyên', category: 'gear', price: 85, slot: 'relic', stat: 'maxHp', bonus: 210 },
  upgrade_stone: { name: 'Đá Hương Tinh', category: 'material', price: 30, detail: 'Tinh luyện trang bị tại Lò Rèn.' },
};
export const GEAR_SLOTS = { weapon: 'Vũ khí', armor: 'Áo giáp', accessory: 'Phụ kiện', relic: 'Pháp ấn' };
export const CRAFTED_GEAR_SLOTS = { spice_blade: 'weapon', jade_apron: 'armor', lantern_charm: 'accessory', village_recipe: 'relic' };
export const GEAR_MAX_LEVEL = 5;
export const STORE_UPGRADE_GOLD = 20;
export const STORE_UPGRADE_STONES = 1;
export const itemBonus = (offer, level) => Number((offer.bonus * (1 + (level - 1) * .25)).toFixed(2));

export function restoreInventory(value) {
  const stacks = Object.fromEntries(Object.entries(ADVENTURE_OFFERS).filter(([id, item]) =>
    item.category !== 'gear' && Number.isSafeInteger(value?.stacks?.[id]) && value.stacks[id] > 0)
    .map(([id]) => [id, value.stacks[id]]));
  const gear = Object.fromEntries(Object.entries(value?.gear ?? {}).filter(([id, entry]) =>
    /^[a-zA-Z0-9-]{1,64}$/.test(id) && Object.hasOwn(ADVENTURE_OFFERS, entry?.item)
    && ADVENTURE_OFFERS[entry.item].category === 'gear').map(([id, entry]) => [id, {
      item: entry.item, level: Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= GEAR_MAX_LEVEL ? entry.level : 1,
      owner: typeof entry.owner === 'string' ? entry.owner : null, locked: entry.locked === true,
    }]));
  const assigned = new Set();
  for (const entry of Object.values(gear)) {
    if (!entry.owner) continue;
    const slot = entry.owner + ':' + ADVENTURE_OFFERS[entry.item].slot;
    if (assigned.has(slot)) entry.owner = null;
    else assigned.add(slot);
  }
  return { stacks, gear, revision: Number.isSafeInteger(value?.revision) && value.revision >= 0 ? value.revision : 0 };
}

export function adventureGearFor(save, id) {
  return Object.entries(save.adventure.inventory?.gear ?? {}).filter(([, entry]) => entry.owner === id);
}

export function changeAdventureInventory(save, { type, id, quantity = 1, characterId, expectedRevision }, battleActive = false) {
  if (battleActive) throw new Error('Hãy kết thúc trận Adventure trước khi dùng cửa hàng hoặc đổi trang bị.');
  const next = structuredClone(save);
  const inventory = next.adventure.inventory;
  if (expectedRevision !== inventory.revision) throw new Error('Túi đồ vừa thay đổi. Hãy thử lại.');
  const entry = Object.hasOwn(inventory.gear, id) ? inventory.gear[id] : null;
  const offer = Object.hasOwn(ADVENTURE_OFFERS, entry?.item ?? id) ? ADVENTURE_OFFERS[entry?.item ?? id] : null;
  const member = next.roster.find(spirit => spirit.id === characterId);
  const stack = inventory.stacks[id] ?? 0;
  function spend(gold) {
    if (next.player.gold < gold) throw new Error('Không đủ vàng.');
    next.player.gold -= gold;
  }
  if (!offer || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Vật phẩm hoặc số lượng không hợp lệ.');
  switch (type) {
    case 'buy':
      if (entry) throw new Error('Mặt hàng không còn bán.');
      spend(offer.price * quantity);
      if (offer.category === 'gear') {
        for (let i = 0; i < quantity; i++) inventory.gear[globalThis.crypto.randomUUID()] = { item: id, level: 1, owner: null, locked: false };
      } else inventory.stacks[id] = stack + quantity;
      break;
    case 'sell':
      if (entry) {
        if (quantity !== 1 || entry.owner || entry.locked) throw new Error('Tháo trang bị và mở khóa trước khi bán.');
        delete inventory.gear[id];
      } else {
        if (stack < quantity) throw new Error('Túi không đủ vật phẩm.');
        inventory.stacks[id] -= quantity;
      }
      next.player.gold += Math.floor(offer.price / 2) * quantity;
      break;
    case 'use':
      if (!member || !offer.heal || stack < 1 || member.hp >= member.maxHp) throw new Error('Cần một Vị Linh chưa đầy HP và có canh trong túi.');
      member.hp = Math.min(member.maxHp, member.hp + Math.ceil(member.maxHp * offer.heal));
      inventory.stacks[id]--;
      break;
    case 'equip':
      if (!entry || !member || (entry.owner && entry.owner !== member.id)) throw new Error('Món này chưa sẵn sàng để trang bị.');
      for (const [, other] of adventureGearFor(next, member.id)) {
        if (ADVENTURE_OFFERS[other.item].slot === offer.slot) other.owner = null;
      }
      const profile = next.adventure.spirits?.profiles[member.id];
      if (profile) profile.equipped = profile.equipped.filter(gearId => CRAFTED_GEAR_SLOTS[gearId] !== offer.slot);
      entry.owner = member.id;
      break;
    case 'unequip':
      if (!entry?.owner || entry.owner !== characterId) throw new Error('Vị Linh chưa dùng món này.');
      entry.owner = null;
      break;
    case 'lock':
      if (!entry) throw new Error('Trang bị không tồn tại.');
      entry.locked = !entry.locked;
      break;
    case 'upgrade':
      if (!entry || entry.level >= GEAR_MAX_LEVEL) throw new Error('Trang bị đã đạt cấp tối đa.');
      if ((inventory.stacks.upgrade_stone ?? 0) < STORE_UPGRADE_STONES) throw new Error('Cần Đá Hương Tinh.');
      spend(STORE_UPGRADE_GOLD * entry.level);
      inventory.stacks.upgrade_stone -= STORE_UPGRADE_STONES;
      entry.level++;
      break;
    default: throw new Error('Thao tác cửa hàng không hợp lệ.');
  }
  inventory.revision++;
  return next;
}
