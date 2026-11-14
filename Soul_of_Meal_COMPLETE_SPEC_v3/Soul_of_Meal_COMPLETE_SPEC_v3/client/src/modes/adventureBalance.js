import { SPIRITS } from './metaProgress.js';

// Browser playtest values. Combat advances at 30 ticks/s.
export const ADVENTURE_TICK_RATE = 30;
export const COMBAT_PLAYBACK_RATE = .7;
export const adventureBalance = {
  openingEnergy: 72,
  basicEnergy: 12,
  hurtEnergy: 4,
  approachSpeed: 4.8,
  ultimateCooldown: 90,
  bossStoves: {
    hp: 680,
    def: 25,
    positions: [[660, 242], [785, 392]],
  },
  formations: {
    player: [[280, 338], [170, 280], [162, 385], [326, 295], [244, 396]],
    enemy: [[690, 320], [780, 398], [795, 267]],
    boss: [742, 346],
  },
  roles: {
    fighter:  { range: 72,  interval: 43, windup: 10, coefficient: 10000 },
    mage:     { range: 275, interval: 48, windup: 7,  travel: 12, coefficient: 10500 },
    support:  { range: 235, interval: 53, windup: 7,  travel: 10, coefficient: 10000 },
    guardian: { range: 76,  interval: 48, windup: 9,  coefficient: 10000 },
    healer:   { range: 240, interval: 53, windup: 7, travel: 10, coefficient: 10000 },
    controller: { range: 255, interval: 48, windup: 8, travel: 10, coefficient: 10000 },
    ranged:   { range: 270, interval: 41, windup: 7, travel: 10, coefficient: 10300 },
    assassin: { range: 65,  interval: 35, windup: 7,  coefficient: 11000 },
  },
  ultimates: {
    chr_bunbo_holinh:     { name: 'Hỏa Đao Liên Vũ', description: 'Chém tất cả kẻ địch và bếp lửa còn trên sân.', kind: 'area', windup: 24, coefficient: 19500 },
    chr_pho_lamvu:        { name: 'Lam Vũ Triều Dâng', description: 'Bắn thủy đạn, làm chậm mục tiêu.', kind: 'slow', windup: 14, travel: 10, coefficient: 21000, duration: 90 },
    chr_goicuon_diepnhi:  { name: 'Diệp Vũ Hồi Sinh', description: 'Hồi 24% máu tối đa cho đồng đội còn sống.', kind: 'heal', windup: 19, ratio: .24 },
    chr_banhbao_bachngoc: { name: 'Bạch Ngọc Hộ Trận', description: 'Tạo lá chắn cho cả đội trong 5 giây.', kind: 'shield', windup: 17, ratio: .24, duration: 150 },
    chr_caphe_davu:       { name: 'Dạ Vũ Đoạn Ảnh', description: 'Kết liễu kẻ địch yếu máu nhất.', kind: 'execute', windup: 19, coefficient: 26000, executeCoefficient: 35000 },
  },
  enemyRoles: {
    mob_mushroom_01: { range: 72, windup: 11 },
    mob_pepper_01: { range: 205, windup: 8, travel: 10 },
    mob_honeybee: { range: 150, windup: 8, travel: 8 },
    mob_lotus_crab: { range: 75, windup: 10 },
    mob_sesame_boar: { range: 91, windup: 14 },
    mob_smoke_wisp: { range: 213, windup: 11, travel: 12 },
    boss_bep_truong: { range: 120, windup: 13 },
    empty_bowl_seal: { range: 335, windup: 13, travel: 14 },
    tidal_conch: { range: 340, windup: 13, travel: 12 },
    spice_forge: { range: 275, windup: 15, travel: 13 },
    hollow_cauldron: { range: 345, windup: 14, travel: 13 },
  },
};

// Encounter skill windups and damage coefficients are proposed playtest tuning.
export const enemySkills = {
  mob_mushroom_01: { name: 'Bào Tử Lan', kind: 'area', radius: 75, windup: 23, coefficient: 12700 },
  mob_pepper_01: { name: 'Hạt Tiêu Bùng Cháy', kind: 'direct', windup: 16, travel: 12, coefficient: 14600 },
  mob_honeybee: { name: 'Kim Mật', kind: 'slow', windup: 12, travel: 9, coefficient: 12400, duration: 35 },
  mob_lotus_crab: { name: 'Càng Sen Quét Nước', kind: 'area', radius: 82, windup: 22, coefficient: 14300 },
  mob_sesame_boar: { name: 'Húc Xoáy', kind: 'area', radius: 90, windup: 25, coefficient: 15100 },
  mob_smoke_wisp: { name: 'Khói Ẩm Bám Rễ', kind: 'slow', windup: 17, travel: 12, coefficient: 13700, duration: 50 },
  boss_bep_truong: { name: 'Hỏa Đao Chấn Địa', kind: 'area', radius: 105, windup: 26, coefficient: 15200 },
  empty_bowl_seal: { name: 'Mực Ấn Tỏa Sương', kind: 'area', radius: 88, windup: 27, coefficient: 15100 },
  tidal_conch: { name: 'Xoáy Ốc', kind: 'slow', windup: 20, travel: 15, coefficient: 16900, duration: 55 },
  spice_forge: { name: 'Tro Nóng Tràn Sân', kind: 'area', radius: 104, windup: 30, coefficient: 16300 },
  hollow_cauldron: { name: 'Mạch Âm Đứt Gãy', kind: 'area', radius: 105, windup: 30, coefficient: 17000 },
};

const roleUltimates = {
  guardian: { description: 'Tạo lá chắn cho cả đội trong 5 giây.', kind: 'shield', windup: 17, ratio: .24, duration: 150 },
  healer: { description: 'Hồi 25% HP tối đa cho đồng đội còn sống.', kind: 'heal', windup: 19, ratio: .25 },
  support: { description: 'Hồi 18% HP tối đa cho đồng đội còn sống.', kind: 'heal', windup: 15, ratio: .18 },
  fighter: { description: 'Đánh tất cả kẻ địch trên sân.', kind: 'area', windup: 19, coefficient: 15500 },
  mage: { description: 'Đánh tất cả kẻ địch bằng phép nguyên tố.', kind: 'area', windup: 23, coefficient: 16500 },
  controller: { description: 'Tấn công và làm chậm mục tiêu trong 4 giây.', kind: 'slow', windup: 15, travel: 10, coefficient: 17000, duration: 120 },
  ranged: { description: 'Bắn tên nguyên tố gây sát thương mạnh lên một mục tiêu.', kind: 'direct', windup: 12, travel: 10, coefficient: 21000 },
  assassin: { description: 'Đánh kẻ địch yếu máu nhất, tăng sát thương khi mục tiêu còn dưới 35% HP.', kind: 'execute', windup: 13, coefficient: 23000, executeCoefficient: 31500 },
};

for (const spirit of Object.values(SPIRITS)) {
  adventureBalance.ultimates[spirit.id] ??= { name: spirit.ultimate, ...roleUltimates[spirit.role] };
}

const mushroom = { id: 'mob_mushroom_01', name: 'Nấm Lạc Vị', hp: 980, maxHp: 980, atk: 90, def: 20, interval: 54, element: 'wood' };
const pepper = { id: 'mob_pepper_01', name: 'Tiêu Tinh', hp: 1250, maxHp: 1250, atk: 110, def: 25, interval: 48, element: 'fire' };
const bee = { id: 'mob_honeybee', name: 'Ong Mật Lạc Vị', hp: 820, maxHp: 820, atk: 81, def: 14, interval: 39, element: 'light' };
const crab = { id: 'mob_lotus_crab', name: 'Cua Sen', hp: 1550, maxHp: 1550, atk: 120, def: 44, interval: 56, element: 'water' };
const boar = { id: 'mob_sesame_boar', name: 'Thú Mè', hp: 1480, maxHp: 1480, atk: 137, def: 33, interval: 49, element: 'wood' };
const wisp = { id: 'mob_smoke_wisp', name: 'Linh Khói', hp: 980, maxHp: 980, atk: 116, def: 20, interval: 46, element: 'shadow' };

const valves = { steam: 'Van Hơi', coal: 'Van Than' };
const seals = { fire: 'Hỏa', water: 'Thủy', wood: 'Mộc', light: 'Quang', shadow: 'Âm' };

export const adventureEncounters = {
  orchard_patrol: { scene: 'orchard', battleScene: 'arena', waves: [[bee, mushroom], [crab, bee]], phases: {},
    claimId: 'orchard_patrol_reward', field: true, reward: { gold: 35, essence: 5 }, repeatReward: { gold: 12, essence: 2 }, material: 'potion_small' },
  garden_patrol: { scene: 'spice_garden', battleScene: 'arena', waves: [[boar, bee], [wisp, pepper]], phases: {},
    claimId: 'garden_patrol_reward', field: true, reward: { gold: 45, essence: 6 }, repeatReward: { gold: 16, essence: 3 }, material: 'upgrade_stone' },
  forest: {
    waves: [[mushroom, pepper], [bee, crab], [
      { id: 'boss_bep_truong', name: 'Bếp Trưởng Hỏa Diệm', hp: 5200, maxHp: 5200, atk: 190, def: 85, interval: 75, element: 'fire', boss: true },
    ]],
    phases: {
      2: { threshold: .7, attack: 'Bếp Bùng Cháy', windup: 180, coefficient: 18000, targets: 2, counter: 'stoves' },
      3: { threshold: .3, attack: 'Vòng Lửa', windup: 36, coefficient: 25000, targets: 3 },
    },
    reward: { gold: 60, essence: 10 },
  },
  seal: {
    waves: [[{ ...mushroom, hp: 1660, maxHp: 1660 }, { ...pepper, hp: 1850, maxHp: 1850 }], [wisp, boar], [
      { id: 'empty_bowl_seal', name: 'Ấn Bát Rỗng', hp: 8700, maxHp: 8700, atk: 275, def: 90, interval: 61, element: 'shadow', boss: true, stationary: true },
    ]],
    phases: {
      2: { threshold: .65, attack: 'Sương Rút Vị', windup: 90, coefficient: 32000, targets: 2, counter: 'lantern' },
      3: { threshold: .42, attack: 'Triều Sương', windup: 120, coefficient: 52000, targets: 5, counter: 'lantern' },
    },
    reward: { gold: 90, essence: 15 },
    wardReductionBp: 6000,
  },
  tide: {
    waves: [[crab, bee], [crab, wisp, boar], [
      { id: 'tidal_conch', name: 'Tù Và Hải Triều', hp: 9900, maxHp: 9900, atk: 290, def: 98, interval: 67, element: 'water', boss: true, stationary: true },
    ]],
    phases: {
      2: { threshold: .72, attack: 'Sóng Tràn Bến', windup: 105, coefficient: 34000, counter: 'retreat', safeX: 410 },
      3: { threshold: .45, attack: 'Đại Triều Vọng', windup: 81, coefficient: 51000, counter: 'retreat', safeX: 345 },
    },
    retreatSpeed: 7.2,
    scene: 'harbor',
    reward: { gold: 125, essence: 20 },
  },
  forge: {
    waves: [[{ ...pepper, hp: 2350, maxHp: 2350 }, boar], [wisp, crab, boar], [
      { id: 'spice_forge', artId: 'boss_stove', name: 'Lò Than Mất Vị', hp: 12300, maxHp: 12300, atk: 310, def: 102, interval: 68, element: 'fire', boss: true, stationary: true },
    ]],
    phases: {
      2: { threshold: .73, attack: 'Áp Hơi Bùng Nổ', windup: 210, coefficient: 45000, targets: 3, counter: 'sequence',
        sequence: { options: valves, order: ['steam', 'coal'] } },
      3: { threshold: .38, attack: 'Tro Lửa Tràn Lò', windup: 195, coefficient: 57000, targets: 5, counter: 'sequence',
        sequence: { options: valves, order: ['coal', 'steam'] } },
    },
    scene: 'caldera',
    claimId: 'caldera_spice_forge_reward',
    reward: { gold: 160, essence: 25 },
  },
  feast: {
    waves: [[{ ...mushroom, hp: 2600, maxHp: 2600 }, { ...pepper, hp: 2880, maxHp: 2880 }], [wisp, boar, crab], [
      { id: 'hollow_cauldron', name: 'Vạc Vô Vị', hp: 14800, maxHp: 14800, atk: 365, def: 112, interval: 59, element: 'shadow', boss: true, stationary: true },
    ]],
    phases: {
      2: { threshold: .76, attack: 'Niêm Ký Ức', windup: 240, coefficient: 49000, targets: 3, counter: 'sequence',
        sequence: { options: seals, order: ['fire', 'water', 'wood'] } },
      3: { threshold: .38, attack: 'Đại Tiệc Vô Vị', windup: 215, coefficient: 64000, targets: 5, counter: 'sequence',
        sequence: { options: seals, order: ['light', 'shadow'] } },
    },
    scene: 'sanctum',
    claimId: 'sanctum_hollow_feast_reward',
    reward: { gold: 225, essence: 35 },
  },
};
