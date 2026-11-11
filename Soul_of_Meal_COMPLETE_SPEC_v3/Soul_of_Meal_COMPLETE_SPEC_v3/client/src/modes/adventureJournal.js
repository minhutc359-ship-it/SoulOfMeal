import { FIRST_CHAPTER, SECOND_CHAPTER, FOREST_CLUES, FOREST_CLUE_IDS, FOREST_LANTERNS } from './adventureStory.js';

const STEPS = Object.freeze([
  'Gặp Lilia ở quảng trường',
  'Mở rương tiếp tế',
  'Lần theo manh mối trong rừng',
  'Đối mặt Bếp Trưởng Hỏa Diệm',
  'Trở về báo tin cho Lilia',
]);

export function adventureJournal(save) {
  const { quest, chestOpened, forestCleared, forestClues, map, chapterTwo } = save.adventure;
  const inForest = map === 'forest';
  const clues = FOREST_CLUE_IDS.filter(id => forestClues.includes(id)).map(id => FOREST_CLUES[id]);
  if (quest === 'completed' && chapterTwo.stage !== 'not_started') {
    const titles = ['Thắp đèn Mộc', 'Thắp đèn Quang', 'Phá Ấn Bát Rỗng', 'Về làng báo tin cho Lilia'];
    const step = chapterTwo.stage === 'completed' ? titles.length : chapterTwo.stage === 'ready_to_claim' ? 3 : chapterTwo.lanterns;
    const actions = inForest ? [...FOREST_LANTERNS, 'seal_encounter', 'village_return'] : ['portal', 'portal', 'portal', 'lilia'];
    return { title: SECOND_CHAPTER, labels: markSteps(titles, step), step, action: actions[step] ?? null, clues };
  }
  const nextClue = FOREST_CLUE_IDS.find(id => !forestClues.includes(id));
  let step = 0;
  if (quest === 'completed') step = STEPS.length;
  else if (forestCleared || quest === 'ready_to_claim') step = 4;
  else if (chestOpened) step = nextClue ? 2 : 3;
  else if (quest === 'accepted') step = 1;
  const actions = ['lilia', 'chest', inForest ? nextClue : 'portal', inForest ? 'encounter' : 'portal', inForest ? 'village_return' : 'lilia'];
  const nextChapterAction = quest === 'completed' ? inForest ? 'village_return' : 'lilia' : null;
  return { title: FIRST_CHAPTER, labels: markSteps(STEPS, step), step, action: actions[step] ?? null, nextChapterAction, clues };
}

function markSteps(titles, step) {
  return titles.map((title, index) => ({
    title, status: index < step ? 'done' : index === step ? 'current' : 'upcoming',
  }));
}
