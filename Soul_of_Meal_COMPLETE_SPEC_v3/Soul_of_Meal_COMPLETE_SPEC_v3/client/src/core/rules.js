// PROPOSED playable balance. Identity is shared; each mode owns its numbers.
export const RULES_VERSION = "three-modes-v4-proposed";
export const PRESENTATION = Object.freeze({
  combatSpeed: 0.7,
  botActionMs: 750,
  impactMs: 620,
});
export const CHESS_RULES = Object.freeze({
  columns: 7,
  rows: 8,
  bench: 9,
  shop: 5,
  maxStar: 3,
  tickRate: 30,
  startGold: 10,
  startLevel: 2,
  startHp: 100,
  refreshCost: 2,
  xpCost: 4,
  xpPerPurchase: 4,
  xpPerRound: 2,
  xpToNext: { 2: 2, 3: 4, 4: 8, 5: 12, 6: 20, 7: 28, 8: 36 },
  baseIncome: 5,
  interestCap: 5,
  maxDamage: 25,
  timeoutTicks: 1350,
  starMultipliers: [0, 1, 1.8, 3.2],
  sellMultipliers: [0, 1, 3, 9],
  // A late-match sudden-death ramp guarantees one survivor, not an arbitrary round score.
  suddenDeathRound: 30,
});
export const CHESS_TRAITS = Object.freeze([
  {
    id: "cuisine",
    label: "Ẩm thực",
    thresholds: [3, 6],
    description: "+20/40% ATK toàn đội",
  },
  {
    id: "elements",
    label: "Nguyên tố",
    thresholds: [3, 5],
    description: "Sóng nguyên tố đầu trận: 90/180 sát thương",
  },
  {
    id: "guardian",
    label: "Hộ Vệ",
    thresholds: [2, 4],
    description: "+30/60% HP Hộ Vệ",
  },
  ...["fire", "water", "wood", "light", "shadow"].map((id) => ({
    id,
    label: {
      fire: "Hỏa",
      water: "Thủy",
      wood: "Mộc",
      light: "Quang",
      shadow: "Âm",
    }[id],
    thresholds: [2, 4, 6],
    description: "+10/20/30% sức mạnh hệ",
  })),
]);
export const CHESS_ITEMS = Object.freeze({
  spice_blade: {
    id: "spice_blade",
    name: "Hỏa Đao Gia Vị",
    atk: 24,
    hp: 0,
    def: 0,
  },
  jade_spoon: {
    id: "jade_spoon",
    name: "Thìa Ngọc Hộ Vệ",
    atk: 0,
    hp: 220,
    def: 12,
  },
  herb_charm: {
    id: "herb_charm",
    name: "Bùa Lá Hồi Phục",
    atk: 8,
    hp: 140,
    def: 6,
  },
});
export const TCG_RULES = Object.freeze({
  deckSize: 36,
  copies: 2,
  handCap: 9,
  unitSlots: 5,
  trapSlots: 2,
  commanderHp: 8000,
  maxMana: 10,
  maxRounds: 40,
  comboDamage: 900,
});
export const ADVENTURE_RULES = Object.freeze({
  tickRate: 30,
  speed: 190,
  levelGold: 45,
  levelEssence: 8,
  levelHerbs: 3,
  harvestCooldown: 300,
  maxLevel: 30,
});
