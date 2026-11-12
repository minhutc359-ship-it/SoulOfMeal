import { adventureEncounters } from './adventureBalance.js';

export const ADVENTURE_CHALLENGE_TIERS = {
  normal: { name: 'Thường', hp: 1, atk: 1, gold: 35, essence: 5 },
  hard: { name: 'Khó', hp: 1.28, atk: 1.22, gold: 60, essence: 8 },
  extreme: { name: 'Cực khó', hp: 1.56, atk: 1.42, gold: 95, essence: 12 },
};

const CHAPTERS = { forest: 1, seal: 2, tide: 3, forge: 4, feast: 5 };
const TACTICS = {
  forest: 'Phá hai bếp để ngắt Bếp Bùng Cháy. Dùng hộ thuẫn khi boss báo Vòng Lửa.',
  seal: 'Chọn đúng đợt sương để dùng Đèn Giữ Vị.',
  tide: 'Ra lệnh lùi về vùng khô trước khi sóng ập tới.',
  forge: 'Gạt hai van đúng thứ tự để ngắt áp hơi.',
  feast: 'Kích hoạt đúng chuỗi ấn để hạ hộ thuẫn.',
};

export function adventureChallenges(save) {
  const progress = save.adventure;
  const cleared = stage => ['ready_to_claim', 'completed'].includes(stage);
  const open = {
    forest: progress.forestCleared || cleared(progress.quest),
    seal: cleared(progress.chapterTwo?.stage),
    tide: cleared(progress.chapterThree?.stage),
    forge: cleared(progress.finale?.[4]?.stage),
    feast: cleared(progress.finale?.[5]?.stage),
  };
  return Object.entries(CHAPTERS).map(([id, chapter]) => ({
    id, chapter, unlocked: open[id], boss: adventureEncounters[id].waves.at(-1).find(actor => actor.boss), tactic: TACTICS[id],
  }));
}

export function adventureChallenge(save, encounter, tier) {
  if (!Object.hasOwn(ADVENTURE_CHALLENGE_TIERS, tier)) return null;
  const challenge = adventureChallenges(save).find(entry => entry.id === encounter && entry.unlocked);
  return challenge ? { ...challenge, ...ADVENTURE_CHALLENGE_TIERS[tier], tier, key: encounter + ':' + tier } : null;
}

export function restoreChallengeRecords(records) {
  const normalized = {};
  for (const encounter of Object.keys(CHAPTERS)) {
    for (const tier of Object.keys(ADVENTURE_CHALLENGE_TIERS)) {
      const key = encounter + ':' + tier;
      const record = records?.[key];
      if (!Number.isSafeInteger(record?.bestTicks) || record.bestTicks < 1
          || !Number.isSafeInteger(record.clears) || record.clears < 1
          || !Number.isInteger(record.mostSurvivors) || record.mostSurvivors < 1 || record.mostSurvivors > 5) continue;
      normalized[key] = { bestTicks: record.bestTicks, clears: record.clears, mostSurvivors: record.mostSurvivors };
    }
  }
  return normalized;
}
