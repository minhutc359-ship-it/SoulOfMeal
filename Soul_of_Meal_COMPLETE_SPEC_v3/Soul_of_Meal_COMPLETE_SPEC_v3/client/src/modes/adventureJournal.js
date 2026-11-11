const STEPS = Object.freeze([
  'Gặp Lilia ở quảng trường',
  'Mở rương tiếp tế',
  'Điều tra Rừng Nguyên Liệu',
  'Trở về báo tin cho Lilia',
]);

export function adventureJournal(save) {
  const { quest, chestOpened, forestCleared, map } = save.adventure;
  const inForest = map === 'forest';
  let step = 0;
  if (quest === 'completed') step = STEPS.length;
  else if (forestCleared || quest === 'ready_to_claim') step = 3;
  else if (chestOpened) step = 2;
  else if (quest === 'accepted') step = 1;
  const labels = STEPS.map((title, index) => ({
    title, status: index < step ? 'done' : index === step ? 'current' : 'upcoming',
  }));
  const actions = ['lilia', 'chest', inForest ? 'encounter' : 'portal', inForest ? 'village_return' : 'lilia'];
  return { labels, step, action: actions[step] ?? null };
}
