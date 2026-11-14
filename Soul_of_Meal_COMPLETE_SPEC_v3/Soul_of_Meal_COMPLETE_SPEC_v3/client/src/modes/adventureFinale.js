export const FINALE_CHAPTERS = [
  {
    number: 4, title: 'Lò Lửa Của Bếp Trưởng', map: 'caldera', quest: 'quest_spice_forge',
    guide: 'forge_guide', encounter: 'forge_encounter', boss: 'forge', reward: { gold: 170, experience: 100 },
    opening: 'forgeOpening', ending: 'forgeEnding',
    objectives: {
      forge_ledger: { title: 'Sổ chuyến than', note: 'Chuyến than cuối không giao cho làng. Hội Vô Vị dùng tro núi lửa để niêm phong những hũ ký ức.' },
      forge_valve: { title: 'Bảng dẫn hơi', note: 'Van Hơi xả áp, Van Than khóa nhiên liệu. Mỗi lần lò đổi nhịp, thứ tự cần gạt cũng đổi.' },
    },
    steps: ['Gặp Bún Bò Hỏa Linh ở núi lửa', 'Đọc sổ chuyến than và cân bằng lò hơi', 'Dập Lò Than Mất Vị', 'Báo tin cho Bún Bò Hỏa Linh'],
  },
  {
    number: 5, title: 'Đại Tiệc Không Hương Vị', map: 'sanctum', quest: 'quest_hollow_feast',
    guide: 'sanctum_guide', encounter: 'feast_encounter', boss: 'feast', reward: { gold: 220, experience: 100 },
    opening: 'feastOpening', ending: 'feastEnding',
    objectives: {
      sanctum_urn: { title: 'Hũ giữ ký ức', note: 'Những người mất vị vẫn còn ở trong ký ức của nhau. Ba ấn đầu mở hũ. Hai ấn cuối đưa hương vị trở về.' },
      sanctum_seal: { title: 'Bản khắc ngũ vị', note: 'Ấn đầu theo thứ tự Hỏa, Thủy, Mộc. Đợt cuối khép mạch bằng Quang, rồi Âm.' },
    },
    steps: ['Gặp Cà Phê Dạ Vũ trong điện', 'Điều tra hũ và ghép lại bản khắc', 'Phá Vạc Vô Vị', 'Giải phong ấn cùng Cà Phê Dạ Vũ'],
  },
  {
    number: 6, title: 'Bữa Tiệc Tái Sinh', map: 'village', quest: 'quest_shared_feast',
    guide: 'feast_lilia', reward: { gold: 250, experience: 100 },
    opening: 'finaleOpening', ending: 'finaleEnding',
    objectives: {
      feast_broth: { title: 'Nêm nồi nước dùng', note: 'Bún Bò Hỏa Linh hạ lửa và đợi đúng một nhịp như lời Bếp Trưởng. Mùi sả lan đến tận đầu ngõ.' },
      feast_table: { title: 'Dọn bàn tiệc', note: 'Diệp Nhi trải lá thơm, Bánh Bao đặt thêm một chiếc bát cho bất kỳ ai đến muộn.' },
    },
    steps: ['Gặp Lilia ở quảng trường', 'Nêm nước dùng và dọn bàn', 'Mời cả làng vào tiệc'],
  },
];

export const FINALE_ROUTES = {
  caldera_route: { map: 'caldera', after: 3 },
  caldera_return: { map: 'harbor' },
  sanctum_route: { map: 'sanctum', after: 4 },
  sanctum_return: { map: 'caldera' },
  feast_return: { map: 'village', after: 5 },
};

const navigation = {
  forest: { caldera: 'village_return', sanctum: 'village_return', village: 'village_return' },
  village: { caldera: 'harbor_route', sanctum: 'harbor_route' },
  harbor: { caldera: 'caldera_route', sanctum: 'caldera_route', village: 'harbor_return' },
  caldera: { sanctum: 'sanctum_route', village: 'caldera_return' },
  sanctum: { caldera: 'sanctum_return', village: 'feast_return' },
};

export function finaleRoute(from, to) {
  return navigation[from]?.[to] ?? null;
}

export function finaleChapterComplete(adventure, number) {
  return (number === 3 ? adventure.chapterThree : adventure.finale[number])?.stage === 'completed';
}

export function restoreFinale(adventure) {
  const restored = {};
  let unlocked = adventure.chapterThree.stage === 'completed';
  for (const chapter of FINALE_CHAPTERS) {
    const previous = adventure.finale?.[chapter.number];
    const stages = chapter.encounter ? ['accepted', 'ready_to_claim', 'completed'] : ['accepted', 'completed'];
    const stage = unlocked && stages.includes(previous?.stage) ? previous.stage : 'not_started';
    const allowed = Object.keys(chapter.objectives);
    const objectives = stage === 'accepted'
      ? allowed.filter(id => Array.isArray(previous.objectives) && previous.objectives.includes(id))
      : stage === 'not_started' ? [] : allowed;
    restored[chapter.number] = { stage, objectives };
    unlocked = stage === 'completed';
  }
  return restored;
}

const [forge, feast, finale] = FINALE_CHAPTERS;
export const FINALE_DIALOGUES = {
  forgeOpening: {
    chapter: forge.title, title: 'Dấu than qua núi',
    lines: [
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Tro trong tù và đến từ lò này. Bếp Trưởng từng giữ ngọn lửa ở đây để sưởi nhà trong mùa lạnh.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Ai đó đã đổi hướng đường hơi. Đọc sổ chuyến than và cân bằng lò hơi, rồi ta sẽ biết cách hạ áp cho lò.' },
    ],
  },
  forgeEnding: {
    chapter: forge.title, title: 'Lửa trở về tay người nấu',
    lines: [
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Ngọn lửa đã dịu. Trong sổ có tên những gia đình từng mất người qua mùa đói. Họ là những người đầu tiên lập Hội Vô Vị.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Họ nghĩ cất đi mùi vị sẽ làm ký ức bớt đau. Rồi chiếc vạc bắt đầu nuốt cả những điều vui. Lối sau lò dẫn tới nơi họ cất hũ.' },
    ],
  },
  feastOpening: {
    chapter: feast.title, title: 'Những hũ chưa mở',
    lines: [
      { speaker: 'Cà Phê Dạ Vũ', art: 'chr_caphe_davu', text: 'Tôi từng gửi vào đây mùi cà phê của cha. Tôi nghĩ sẽ dễ sống hơn nếu quên. Đến lúc muốn lấy lại, chiếc vạc đã khóa cửa.' },
      { speaker: 'Bánh Bao Bạch Ngọc', art: 'chr_banhbao_bachngoc', text: 'Vậy lần này ta mở cùng nhau. Xem hũ và bản khắc trước nhé. Tôi sẽ giữ nhịp cho cả đội.' },
    ],
  },
  feastEnding: {
    chapter: feast.title, title: 'Mở nắp hũ cuối cùng',
    lines: [
      { speaker: 'Cà Phê Dạ Vũ', art: 'chr_caphe_davu', text: 'Tôi nhớ rồi. Cha luôn rang hơi cháy mẻ đầu tiên. Hồi ấy hai cha con phải mở toang cửa sổ, cười đến chảy nước mắt.' },
      { speaker: 'Gỏi Cuốn Diệp Nhi', art: 'chr_goicuon_diepnhi', text: 'Mang những hũ còn lại về làng đi. Lilia đã để sẵn chỗ cho mọi người ở quảng trường.' },
    ],
  },
  finaleOpening: {
    chapter: finale.title, title: 'Bắc lại nồi nước dùng',
    lines: [
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Ta sẽ mở từng hũ bên bàn ăn. Ai muốn kể chuyện thì kể. Ai chỉ muốn ngồi ăn cũng có phần.' },
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Tôi phụ chị nêm nước dùng. Diệp Nhi và Bánh Bao đã mang đồ ra bàn rồi.' },
    ],
  },
  finaleEnding: {
    chapter: finale.title, title: 'Mỗi hương vị kể một câu chuyện',
    lines: [
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Chị nhớ mùi sả rồi. Nhưng tối nay chắc chị sẽ nhớ nhất lúc cả làng cùng kéo ghế lại gần.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Ở bến, người ta đã nhóm bếp. Trong rừng, hai ngọn đèn vẫn sáng. Từ mai, ta có thể ghé thăm họ bất cứ lúc nào.' },
      { speaker: 'Cà Phê Dạ Vũ', art: 'chr_caphe_davu', text: 'Lần sau để tôi pha cà phê. Có lẽ mẻ đầu vẫn hơi cháy. Tôi sẽ để mọi người nếm thử.' },
      { speaker: 'Bánh Bao Bạch Ngọc', art: 'chr_banhbao_bachngoc', text: 'Tôi để thêm một cái bát ở đây nhé. Bữa tiệc vẫn còn chỗ.' },
    ],
  },
};
