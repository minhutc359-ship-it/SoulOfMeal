import { FIRST_CHAPTER, SECOND_CHAPTER, THIRD_CHAPTER, FOREST_CLUES, FOREST_CLUE_IDS, FOREST_LANTERNS, HARBOR_CLUES, HARBOR_CLUE_IDS } from './adventureStory.js';

import { FINALE_CHAPTERS, finaleRoute } from './adventureFinale.js';
import { ROOM_EXIT, VILLAGE_ROOMS } from './villageRooms.js';

const STEPS = Object.freeze([
  'Gặp Lilia ở quảng trường',
  'Mở rương tiếp tế',
  'Lần theo manh mối trong rừng',
  'Đối mặt Bếp Trưởng Hỏa Diệm',
  'Trở về báo tin cho Lilia',
]);

export function adventureJournal(save) {
  if (VILLAGE_ROOMS.includes(save.adventure.map)) {
    const journal = outdoorJournal({ ...save.adventure, map: 'village' });
    return journal.action || journal.nextChapterAction
      ? { ...journal, action: ROOM_EXIT } : journal;
  }
  return outdoorJournal(save.adventure);
}

function outdoorJournal(adventure) {
  const { quest, chestOpened, forestCleared, forestClues, map, chapterTwo, chapterThree } = adventure;
  const inForest = map === 'forest';
  const clues = FOREST_CLUE_IDS.filter(id => forestClues.includes(id)).map(id => FOREST_CLUES[id]);
  if (chapterThree.stage === 'completed') return finaleJournal(adventure, clues);
  if (chapterTwo.stage === 'completed' && (chapterThree.stage !== 'not_started' || map === 'harbor')) {
    const titles = ['Gặp Phở Lam Vũ ở bến', 'Kiểm tra lưới và vệt triều', 'Dập tiếng Tù Và Hải Triều', 'Báo tin cho Phở Lam Vũ'];
    const nextClue = HARBOR_CLUE_IDS.find(id => !chapterThree.clues.includes(id));
    let step = 0;
    if (chapterThree.stage === 'completed') step = titles.length;
    else if (chapterThree.stage === 'ready_to_claim') step = 3;
    else if (chapterThree.stage === 'accepted') step = nextClue ? 1 : 2;
    const actions = ['harbor_guide', nextClue, 'tide_encounter', 'harbor_guide'];
    const action = step === titles.length ? null : map === 'harbor' ? actions[step] : inForest ? 'village_return' : 'harbor_route';
    return {
      title: THIRD_CHAPTER, labels: markSteps(titles, step), step, action,
      clues: [...clues, ...HARBOR_CLUE_IDS.filter(id => chapterThree.clues.includes(id)).map(id => HARBOR_CLUES[id])],
    };
  }
  if (quest === 'completed' && chapterTwo.stage !== 'not_started') {
    const titles = ['Thắp đèn Mộc', 'Thắp đèn Quang', 'Phá Ấn Bát Rỗng', 'Về làng báo tin cho Lilia'];
    const step = chapterTwo.stage === 'completed' ? titles.length : chapterTwo.stage === 'ready_to_claim' ? 3 : chapterTwo.lanterns;
    const actions = inForest ? [...FOREST_LANTERNS, 'seal_encounter', 'village_return'] : ['portal', 'portal', 'portal', 'lilia'];
    const nextChapterAction = chapterTwo.stage === 'completed' ? inForest ? 'village_return' : 'harbor_route' : null;
    return { title: SECOND_CHAPTER, labels: markSteps(titles, step), step, action: actions[step] ?? null, clues,
      nextChapterAction, nextChapterLabel: nextChapterAction && 'Đến bến thuyền để mở Chương 3' };
  }
  const nextClue = FOREST_CLUE_IDS.find(id => !forestClues.includes(id));
  let step = 0;
  if (quest === 'completed') step = STEPS.length;
  else if (forestCleared || quest === 'ready_to_claim') step = 4;
  else if (chestOpened) step = nextClue ? 2 : 3;
  else if (quest === 'accepted') step = 1;
  const actions = ['lilia', 'chest', inForest ? nextClue : 'portal', inForest ? 'encounter' : 'portal', inForest ? 'village_return' : 'lilia'];
  const nextChapterAction = quest === 'completed' ? inForest ? 'village_return' : 'lilia' : null;
  return { title: FIRST_CHAPTER, labels: markSteps(STEPS, step), step, action: actions[step] ?? null, nextChapterAction, clues,
    nextChapterLabel: nextChapterAction && 'Gặp Lilia để mở Chương 2' };
}

function finaleJournal(adventure, earlierClues) {
  const { map, finale } = adventure;
  const chapter = FINALE_CHAPTERS.find(item => finale[item.number].stage !== 'completed') ?? FINALE_CHAPTERS.at(-1);
  const progress = finale[chapter.number];
  const nextObjective = Object.keys(chapter.objectives).find(id => !progress.objectives.includes(id));
  const step = progress.stage === 'completed' ? chapter.steps.length
    : progress.stage === 'not_started' ? 0 : progress.stage === 'ready_to_claim' ? 3 : nextObjective ? 1 : 2;
  const actions = [chapter.guide, nextObjective, chapter.encounter ?? chapter.guide, chapter.guide];
  const action = step >= chapter.steps.length ? null : map === chapter.map ? actions[step] : finaleRoute(map, chapter.map);
  const clues = [
    ...earlierClues,
    ...HARBOR_CLUE_IDS.filter(id => adventure.chapterThree.clues.includes(id)).map(id => HARBOR_CLUES[id]),
    ...FINALE_CHAPTERS.flatMap(item => finale[item.number].objectives.map(id => item.objectives[id])),
  ];
  return { title: chapter.title, labels: markSteps(chapter.steps, step), step, action, clues,
    completedCampaign: finale[6].stage === 'completed' };
}

function markSteps(titles, step) {
  return titles.map((title, index) => ({
    title, status: index < step ? 'done' : index === step ? 'current' : 'upcoming',
  }));
}
