import { FOREST_CLUES, FOREST_CLUE_IDS } from './adventureStory.js';

const STEPS = Object.freeze([
  'Gặp Lilia ở quảng trường',
  'Mở rương tiếp tế',
  'Lần theo manh mối trong rừng',
  'Đối mặt Bếp Trưởng Hỏa Diệm',
  'Trở về báo tin cho Lilia',
]);

export function adventureJournal(save) {
  const { quest, chestOpened, forestCleared, forestClues, map } = save.adventure;
  const inForest = map === 'forest';
  const nextClue = FOREST_CLUE_IDS.find(id => !forestClues.includes(id));
  let step = 0;
  if (quest === 'completed') step = STEPS.length;
  else if (forestCleared || quest === 'ready_to_claim') step = 4;
  else if (chestOpened) step = nextClue ? 2 : 3;
  else if (quest === 'accepted') step = 1;
  const labels = STEPS.map((title, index) => ({
    title, status: index < step ? 'done' : index === step ? 'current' : 'upcoming',
  }));
  const actions = ['lilia', 'chest', inForest ? nextClue : 'portal', inForest ? 'encounter' : 'portal', inForest ? 'village_return' : 'lilia'];
  return { labels, step, action: actions[step] ?? null, clues: FOREST_CLUE_IDS.filter(id => forestClues.includes(id)).map(id => FOREST_CLUES[id]) };
}
