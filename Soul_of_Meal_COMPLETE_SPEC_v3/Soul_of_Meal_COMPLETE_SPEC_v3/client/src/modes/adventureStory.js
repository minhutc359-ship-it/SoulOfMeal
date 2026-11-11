export const FIRST_CHAPTER = 'Hương Vị Đầu Tiên';
export const SECOND_CHAPTER = 'Bí Mật Rừng Nguyên Liệu';
export const THIRD_CHAPTER = 'Hải Vực Hương Biển';
export const FOREST_LANTERNS = ['forest_lantern_wood', 'forest_lantern_light'];

export function restoreChapterTwo(adventure) {
  const progress = adventure.chapterTwo;
  if (adventure.quest === 'completed' && ['accepted', 'ready_to_claim', 'completed'].includes(progress?.stage)) {
    const lanterns = [0, 1, 2].includes(progress.lanterns) ? progress.lanterns : 0;
    return {
      stage: progress.stage,
      lanterns: progress.stage === 'accepted' ? lanterns : FOREST_LANTERNS.length,
    };
  }
  return { stage: 'not_started', lanterns: 0 };
}

export const FOREST_CLUES = Object.freeze({
  forest_clue_salt: {
    title: 'Muối đã mất vị',
    note: 'Muối còn nguyên hạt, nhưng đầu lưỡi chẳng thấy mặn. Thất Vị lấy đi hương vị ngay cả khi nguyên liệu vẫn còn.',
  },
  forest_clue_ladle: {
    title: 'Chiếc vá ám khói',
    note: 'Tay cầm khắc tên Bếp Trưởng Hỏa Diệm. Vết tro hãy còn ấm và kéo về phía sân bếp trong rừng.',
  },
});

export const FOREST_CLUE_IDS = Object.keys(FOREST_CLUES);

export const HARBOR_CLUES = Object.freeze({
  harbor_net: {
    title: 'Lưới mắc vỏ ốc',
    note: 'Lưới kéo từ cửa biển dính những mảnh vỏ ốc rung cùng một nhịp. Mùi cá khô trên dây đã biến mất.',
  },
  harbor_tide: {
    title: 'Vệt triều trên cọc',
    note: 'Nước rút rồi dâng đúng lúc chiếc tù và cất tiếng. Hai bậc đá phía tây vẫn khô, đủ chỗ cho cả đội lùi lên.',
  },
});
export const HARBOR_CLUE_IDS = Object.keys(HARBOR_CLUES);

export function restoreChapterThree(adventure) {
  const progress = adventure.chapterThree;
  if (adventure.chapterTwo.stage !== 'completed' || !['accepted', 'ready_to_claim', 'completed'].includes(progress?.stage)) {
    return { stage: 'not_started', clues: [] };
  }
  const clues = Array.isArray(progress.clues) ? progress.clues : [];
  return {
    stage: progress.stage,
    clues: progress.stage === 'accepted' ? HARBOR_CLUE_IDS.filter(id => clues.includes(id)) : [...HARBOR_CLUE_IDS],
  };
}

export function restoreForestClues(adventure) {
  if (adventure.forestCleared || ['ready_to_claim', 'completed'].includes(adventure.quest)) return [...FOREST_CLUE_IDS];
  const clues = Array.isArray(adventure.forestClues) ? adventure.forestClues : [];
  return FOREST_CLUE_IDS.filter(id => clues.includes(id));
}

export const CHAPTER_DIALOGUES = Object.freeze({
  opening: {
    title: 'Nồi nước dùng lặng hương',
    lines: [
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Sáng nay tôi nếm nồi nước dùng ba lần. Nước vẫn sôi, nhưng tôi chẳng còn nhớ nó từng thơm ra sao.' },
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Tôi nhớ mùi sả mỗi lần đi ngang bếp của chị. Nếu cả làng cũng quên, rồi chúng ta còn nhớ được gì?' },
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Người xưa gọi đó là Thất Vị. Bếp Trưởng Hỏa Diệm vào rừng từ sáng mà chưa về. Hãy mở rương tiếp tế rồi lần theo dấu ông ấy.' },
    ],
  },
  ending: {
    title: 'Hương sả trở về',
    lines: [
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Chúng tôi tìm thấy chiếc vá của Bếp Trưởng. Ông ấy đã dùng hai bếp để giữ chút hương cuối cùng, nhưng ngọn lửa cứ lớn dần và không còn nghe lời.' },
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Đưa tôi chiếc vá nào. À… mùi sả! Tôi nhớ rồi. Mỗi lần nêm nước dùng, ông ấy đều bảo tôi chờ thêm một nhịp trước khi nếm.' },
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Dưới đáy vá có một dấu hình chiếc bát rỗng. Khi lửa tắt, dấu ấy vẫn sáng. Tôi sẽ ghi lại để lần sau đi sâu hơn vào rừng.' },
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Việc đó để mai. Hôm nay, ở lại ăn với làng một bữa. Tôi muốn mọi người nhớ lại vị của nồi nước dùng này.' },
    ],
  },
  forestOpening: {
    chapter: SECOND_CHAPTER,
    title: 'Vết khắc dưới đáy vá',
    lines: [
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Dấu bát rỗng trên chiếc vá giống dấu khắc trên một đàn đá trong rừng. Đêm qua, từ đó lại có sương tràn ra.' },
      { speaker: 'Gỏi Cuốn Diệp Nhi', art: 'chr_goicuon_diepnhi', text: 'Mẹ tôi từng dạy cách mở đàn đá: thắp đèn Mộc trước để gọi hương về, rồi thắp đèn Quang để giữ hương lại.' },
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Hai ngọn đèn sẽ cho các bạn một lần che chở cả đội. Hãy giữ ánh đèn đến lúc lớp sương dày nhất.' },
    ],
  },
  forestEnding: {
    chapter: SECOND_CHAPTER,
    title: 'Bản đồ dưới lớp men',
    lines: [
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Khi sương tan, chúng tôi thấy dưới lớp men có hình các dòng suối. Chúng đều chảy ra một cửa biển.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Tôi nhận ra nơi ấy. Hải Vực Hương Biển. Nếu sương đã theo dòng nước tới đó, cảng sẽ là nơi đầu tiên mất vị.' },
      { speaker: 'Lilia', art: 'npc_lilia', text: 'Ta đã tìm được đường đi của Thất Vị. Tôi sẽ giữ đèn làng sáng. Khi các bạn trở về, nồi nước dùng vẫn sẽ đợi.' },
    ],
  },
  harborOpening: {
    chapter: THIRD_CHAPTER,
    title: 'Bến cá im mùi biển',
    lines: [
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Cảng vẫn đông, nhưng tôi không còn ngửi thấy mùi cá nướng. Vết Thất Vị trên mảnh men dẫn đúng đến bến này.' },
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Có tiếng tù và ở cuối cầu tàu. Mỗi lần nó ngân, nước lại dâng thêm một bậc.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Hãy xem tấm lưới và vạch triều. Nếu sóng tràn lên, ta sẽ lùi về bậc đá khô phía tây.' },
    ],
  },
  harborEnding: {
    chapter: THIRD_CHAPTER,
    title: 'Mùi cá nướng trên bến',
    lines: [
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Nước đã rút. Ngửi xem, bếp cá nướng sau chợ lại thơm rồi.' },
      { speaker: 'Bún Bò Hỏa Linh', art: 'chr_bunbo_holinh', text: 'Trong tù và có tro khô, giống thứ bám trên chiếc vá của Bếp Trưởng. Ai đó đã mang Thất Vị theo con đường chở than.' },
      { speaker: 'Phở Lam Vũ', art: 'chr_pho_lamvu', text: 'Tôi sẽ ghi dấu ấy vào bản đồ. Đêm nay, giúp tôi chia mẻ cá đầu tiên cho những người vừa trở về bến nhé.' },
    ],
  },
});
