// Browser playtest values. Combat advances at 30 ticks/s.
export const adventureBalance = {
  openingEnergy: 72,
  basicEnergy: 12,
  hurtEnergy: 4,
  approachSpeed: 4.8,
  ultimateCooldown: 90,
  bossPhases: {
    2: { threshold: .7, attack: 'Bếp Bùng Cháy', windup: 180, coefficient: 18000, targets: 2 },
    3: { threshold: .3, attack: 'Vòng Lửa', windup: 36, coefficient: 25000, targets: 3 },
  },
  bossStoves: {
    hp: 680,
    def: 25,
    positions: [[660, 242], [785, 392]],
  },
  formations: {
    player: [[280, 338], [170, 280], [162, 385], [326, 295], [244, 396]],
    enemy: [[690, 320], [780, 398]],
    boss: [742, 346],
  },
  roles: {
    fighter:  { range: 72,  interval: 43, windup: 10, coefficient: 10000 },
    mage:     { range: 275, interval: 48, windup: 7,  travel: 12, coefficient: 10500 },
    support:  { range: 235, interval: 53, windup: 7,  travel: 10, coefficient: 10000 },
    guardian: { range: 76,  interval: 48, windup: 9,  coefficient: 10000 },
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
    boss_bep_truong: { range: 120, windup: 13 },
  },
};
