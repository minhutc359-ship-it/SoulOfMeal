import { adventureBalance, ADVENTURE_TICK_RATE } from './adventureBalance.js';

// Proposed practice economy. These upgrades apply only to Adventure.
export const SPIRIT_RANKS = [
  { gold: 60, essence: 3 },
  { gold: 95, essence: 5 },
  { gold: 140, essence: 8 },
  { gold: 200, essence: 12 },
];
export const MAX_SPIRIT_RANK = SPIRIT_RANKS.length + 1;
export const SPIRIT_GIFTS = [3, 5, 8];
export const SPIRIT_BONDS = ['Mới gặp', 'Quen biết', 'Tin cậy', 'Thân thiết'];

export const SPIRIT_GEAR = {
  spice_blade: { name: 'Hỏa Đao Gia Vị', slot: 'Vũ khí', symbol: '⚔', detail: '+28 ATK', atk: 28, cost: { gold: 85, essence: 4 } },
  jade_apron: { name: 'Tạp Dề Ngọc', slot: 'Áo', symbol: '◆', detail: '+22 DEF', def: 22, cost: { gold: 80, essence: 4 } },
  lantern_charm: { name: 'Ngọc Đèn Làng', slot: 'Phụ kiện', symbol: '✦', detail: `+${ADVENTURE_TICK_RATE * .6} tốc độ/giây`, speed: .6, cost: { gold: 70, essence: 5 } },
  village_recipe: { name: 'Sổ Công Thức Làng', slot: 'Bí kíp', symbol: '▤', detail: '+240 HP tối đa', maxHp: 240, cost: { gold: 75, essence: 5 } },
};

export const SPIRIT_MEMORIES = {
  chr_bunbo_holinh: 'Một bát nước dùng ngon cần có người ngồi đối diện. Lần sau tôi sẽ để dành cho bạn phần thịt ngon nhất.',
  chr_pho_lamvu: 'Khi nước bắt đầu sôi, tôi đếm từng tiếng lách tách. Âm thanh ấy giống như mưa rơi trên mái nhà cũ.',
  chr_goicuon_diepnhi: 'Mẹ từng dạy tôi nhận ra rau thơm chỉ bằng mùi. Giờ tôi muốn dạy lại cho những đứa trẻ trong làng.',
  chr_banhbao_bachngoc: 'Tôi thích đứng canh bên xửng bánh. Hễ có ai buồn, tôi để thêm một chiếc bánh vào phần của họ.',
  chr_caphe_davu: 'Tôi từng chỉ pha cà phê cho một mình. Từ ngày đi cùng mọi người, tôi luôn mang theo thêm một chiếc cốc.',
};

export function restoreSpiritProgress(input, roster) {
  const ownedGear = Object.keys(SPIRIT_GEAR).filter(id => Array.isArray(input?.ownedGear) && input.ownedGear.includes(id));
  const used = new Set();
  const profiles = {};
  for (const { id } of roster) {
    const entry = input?.profiles?.[id];
    if (!entry || typeof entry !== 'object') continue;
    const equipped = ownedGear.filter(gearId => Array.isArray(entry.equipped) && entry.equipped.includes(gearId) && !used.has(gearId));
    equipped.forEach(gearId => used.add(gearId));
    const rank = Number.isInteger(entry.rank) && entry.rank >= 1 && entry.rank <= MAX_SPIRIT_RANK ? entry.rank : 1;
    const bond = Number.isInteger(entry.bond) && entry.bond >= 0 && entry.bond <= SPIRIT_GIFTS.length ? entry.bond : 0;
    profiles[id] = { rank, bond, equipped };
  }
  return { ownedGear, profiles };
}

export function spiritProfile(save, id) {
  return save.adventure.spirits?.profiles[id] ?? { rank: 1, bond: 0, equipped: [] };
}

export function adventureSpiritStats(member, profile, rank = profile.rank) {
  const steps = rank - 1;
  const stats = {
    maxHp: Math.floor(member.maxHp * (100 + steps * 8) / 100),
    atk: Math.floor(member.atk * (100 + steps * 7) / 100),
    def: Math.floor(member.def * (100 + steps * 5) / 100),
    speed: adventureBalance.approachSpeed,
  };
  for (const gearId of profile.equipped) {
    const gear = SPIRIT_GEAR[gearId];
    for (const stat of Object.keys(stats)) stats[stat] += gear[stat] ?? 0;
  }
  const hp = member.hp > 0 ? Math.max(1, Math.round(member.hp * stats.maxHp / member.maxHp)) : 0;
  return { ...member, ...stats, hp };
}

export function canAffordSpiritCost(player, cost) {
  return player.gold >= cost.gold && player.essence >= cost.essence;
}

export function changeSpiritProgress(save, { type, id, gearId }, battleActive = false) {
  if (battleActive) throw new Error('Hãy kết thúc trận Adventure trước khi phát triển Vị Linh.');
  if (!save.roster.some(member => member.id === id)) throw new Error('Vị Linh này chưa thuộc đội hình.');
  const updated = structuredClone(save);
  const spirits = updated.adventure.spirits ??= { ownedGear: [], profiles: {} };
  const profile = spirits.profiles[id] ??= spiritProfile(updated, id);
  const gear = Object.hasOwn(SPIRIT_GEAR, gearId) ? SPIRIT_GEAR[gearId] : null;
  function spend(cost) {
    if (!canAffordSpiritCost(updated.player, cost)) throw new Error('Không đủ vàng hoặc tinh hoa.');
    updated.player.gold -= cost.gold;
    updated.player.essence -= cost.essence;
  }
  switch (type) {
    case 'rank': {
      const cost = SPIRIT_RANKS[profile.rank - 1];
      if (!cost) throw new Error('Vị Linh đã đạt cấp tối đa.');
      spend(cost);
      profile.rank += 1;
      break;
    }
    case 'craft':
      if (!gear || spirits.ownedGear.includes(gearId)) throw new Error('Trang bị không thể chế tác thêm.');
      spend(gear.cost);
      spirits.ownedGear.push(gearId);
      break;
    case 'equip':
      if (!gear || !spirits.ownedGear.includes(gearId)) throw new Error('Trang bị chưa có trong kho.');
      if (Object.values(spirits.profiles).some(item => item.equipped.includes(gearId))) throw new Error('Hãy tháo trang bị khỏi Vị Linh đang dùng.');
      profile.equipped = profile.equipped.filter(item => SPIRIT_GEAR[item].slot !== gear.slot);
      profile.equipped.push(gearId);
      break;
    case 'unequip':
      if (!profile.equipped.includes(gearId)) throw new Error('Vị Linh chưa đeo trang bị này.');
      profile.equipped = profile.equipped.filter(item => item !== gearId);
      break;
    case 'gift': {
      const essence = SPIRIT_GIFTS[profile.bond];
      if (!essence) throw new Error('Quan hệ đã đạt mức cao nhất.');
      spend({ gold: 0, essence });
      profile.bond += 1;
      break;
    }
    default: throw new Error('Thao tác không hợp lệ.');
  }
  return updated;
}
