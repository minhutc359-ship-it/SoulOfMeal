export const CHESS_ITEMS = {
  ember: { name: 'Mảnh Lửa', icon: '✦', stats: { atk: 12 } },
  weave: { name: 'Vải Ngọc', icon: '✿', stats: { maxHp: 140 } },
  bronze: { name: 'Giáp Đồng', icon: '⬡', stats: { def: 12 } },
  ember_blade: { name: 'Đao Than Hồng', icon: '✦', stats: { atk: 31 } },
  banquet_sash: { name: 'Dải Lụa Yến Tiệc', icon: '✿', stats: { maxHp: 330 } },
  iron_lid: { name: 'Nắp Nồi Thép', icon: '⬡', stats: { def: 29 } },
  spice_pouch: { name: 'Túi Gia Vị', icon: '✦', stats: { atk: 16, maxHp: 195 } },
  wok_guard: { name: 'Chảo Lửa Hộ Thân', icon: '⬡', stats: { atk: 18, def: 17 } },
  jade_shell: { name: 'Vỏ Bếp Bọc Ngọc', icon: '✿', stats: { maxHp: 220, def: 17 } },
};

export const CHESS_COMPONENTS = ['ember', 'weave', 'bronze'];
const RECIPES = {
  'ember:ember': 'ember_blade', 'weave:weave': 'banquet_sash', 'bronze:bronze': 'iron_lid',
  'ember:weave': 'spice_pouch', 'bronze:ember': 'wok_guard', 'bronze:weave': 'jade_shell',
};

export function chessItemRecipe(first, second) {
  return RECIPES[[first, second].sort().join(':')] ?? null;
}

export function chessItemPlacement(unit, item) {
  const items = unit.items ?? [];
  const slot = items.findIndex(held => chessItemRecipe(held, item));
  if (slot >= 0) return { slot, id: chessItemRecipe(items[slot], item) };
  return items.length < 3 ? { slot: items.length, id: item } : null;
}

export function applyChessItems(actor) {
  for (const id of actor.items ?? []) {
    for (const [stat, bonus] of Object.entries(CHESS_ITEMS[id]?.stats ?? {})) actor[stat] += bonus;
  }
  actor.hp = actor.maxHp;
}
