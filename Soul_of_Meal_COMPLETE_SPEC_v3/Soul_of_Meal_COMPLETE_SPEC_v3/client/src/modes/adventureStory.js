export const FIRST_CHAPTER = 'Hương Vị Đầu Tiên';

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
});
