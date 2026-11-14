import { RULES_VERSION } from "./rules.js";

export const SAVE_KEY = "soul-of-meal.save.v3";
export const SAVE_VERSION = 3;

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    player: {
      name: "Người Kết Vị",
      level: 1,
      experience: 0,
      gold: 120,
      essence: 24,
    },
    adventure: {
      map: "village",
      x: 120,
      y: 310,
      quest: "not_started",
      chestOpened: false,
      forestCleared: false,
      rewardClaims: [],
      battle: null,
      unlockedMaps: ["village", "forest"],
      materials: { herbs: 0, pearl: 0, ember: 0, mist: 0 },
      harvests: {},
      puzzles: {},
      recipes: {},
      encountersWon: {},
      safePosition: null,
    },
    roster: [
      {
        id: "chr_bunbo_holinh",
        hp: 3000,
        maxHp: 3000,
        atk: 320,
        def: 100,
        element: "fire",
        role: "fighter",
        energy: 0,
      },
      {
        id: "chr_pho_lamvu",
        hp: 2200,
        maxHp: 2200,
        atk: 390,
        def: 60,
        element: "water",
        role: "mage",
        energy: 0,
      },
      {
        id: "chr_goicuon_diepnhi",
        hp: 2500,
        maxHp: 2500,
        atk: 250,
        def: 90,
        element: "wood",
        role: "support",
        energy: 0,
      },
      {
        id: "chr_banhbao_bachngoc",
        hp: 3400,
        maxHp: 3400,
        atk: 210,
        def: 150,
        element: "light",
        role: "guardian",
        energy: 0,
      },
      {
        id: "chr_caphe_davu",
        hp: 2000,
        maxHp: 2000,
        atk: 430,
        def: 50,
        element: "shadow",
        role: "assassin",
        energy: 0,
      },
    ],
    completedBattles: 0,
    party: [
      "chr_bunbo_holinh",
      "chr_pho_lamvu",
      "chr_goicuon_diepnhi",
      "chr_banhbao_bachngoc",
    ],
    decks: {},
    activeDeck: "balanced",
    modes: { tcg: null, chess: null },
    settings: {
      music: 70,
      sfx: 80,
      ambience: 65,
      reducedMotion: false,
      autoUltimate: false,
    },
  };
}

export function migrateSave(input) {
  const fresh = createDefaultSave();
  if (!input || typeof input !== "object") return fresh;
  if ([2, SAVE_VERSION].includes(input.version)) {
    const migrated = {
      ...fresh,
      ...input,
      player: { ...fresh.player, ...input.player },
      adventure: { ...fresh.adventure, ...input.adventure },
      settings: { ...fresh.settings, ...input.settings },
      modes: { ...fresh.modes, ...input.modes },
      roster:
        Array.isArray(input.roster) && input.roster.length
          ? input.roster
          : fresh.roster,
    };
    migrated.version = SAVE_VERSION;
    const numeric = (value, fallback, max = 1000000000) =>
      Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
    migrated.roster = fresh.roster.map((base) => {
      const saved = Array.isArray(input.roster)
        ? input.roster.find((actor) => actor?.id === base.id)
        : null;
      if (!saved) return base;
      const maxHp = Math.max(1, numeric(saved.maxHp, base.maxHp));
      return {
        ...base,
        maxHp,
        hp: Math.min(maxHp, numeric(saved.hp, maxHp)),
        atk: numeric(saved.atk, base.atk),
        def: numeric(saved.def, base.def),
        level: Math.max(1, numeric(saved.level, 1, 30)),
        energy: numeric(saved.energy, 0, 100),
      };
    });
    for (const key of ["music", "sfx", "ambience"])
      migrated.settings[key] = numeric(
        migrated.settings[key],
        fresh.settings[key],
        100,
      );
    const knownIds = new Set(fresh.roster.map((actor) => actor.id));
    migrated.party = Array.isArray(input.party)
      ? [...new Set(input.party.filter((id) => knownIds.has(id)))].slice(0, 4)
      : fresh.party;
    const mapIds = new Set([
      "village",
      "forest",
      "coast",
      "volcano",
      "mist",
      "ruins",
    ]);
    if (!mapIds.has(migrated.adventure.map))
      Object.assign(migrated.adventure, {
        map: "village",
        x: 120,
        y: 310,
        battle: null,
      });
    migrated.adventure.materials = {
      ...fresh.adventure.materials,
      ...input.adventure?.materials,
    };
    migrated.adventure.unlockedMaps = [
      ...new Set([
        ...fresh.adventure.unlockedMaps,
        ...(input.adventure?.unlockedMaps ?? []),
        ...(migrated.adventure.forestCleared ? ["coast"] : []),
      ]),
    ];
    delete migrated.settings.voice;
    if (
      migrated.modes.tcg &&
      (migrated.modes.tcg.rulesVersion !== RULES_VERSION ||
        !Array.isArray(migrated.modes.tcg.players) ||
        migrated.modes.tcg.players.length !== 2)
    )
      migrated.modes.tcg = null;
    if (
      migrated.modes.chess &&
      (migrated.modes.chess.rulesVersion !== RULES_VERSION ||
        !Array.isArray(migrated.modes.chess.board) ||
        !Array.isArray(migrated.modes.chess.catalog))
    )
      migrated.modes.chess = null;
    if (input.version === 2) {
      migrated.modes = { tcg: null, chess: null };
      migrated.adventure.battle = null;
      migrated.migrationNotice =
        "Tiến trình, đội hình và tài nguyên đã được giữ lại. Các ván thử nghiệm cũ đã đóng để dùng luật ba chế độ mới.";
    }
    return migrated;
  }
  if (input.version === 1) {
    const migrated = {
      ...fresh,
      player: { ...fresh.player, ...input.player },
      adventure: { ...fresh.adventure, ...input.adventure },
      roster: fresh.roster,
      completedBattles: input.completedBattles ?? 0,
    };
    migrated.adventure.x = (input.adventure?.x ?? 0.5) * 960;
    migrated.adventure.y = (input.adventure?.y ?? 0.55) * 540;
    return migrated;
  }
  return fresh;
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw =
      storage?.getItem(SAVE_KEY) ??
      storage?.getItem("soul-of-meal.save.v2") ??
      storage?.getItem("soul-of-meal.save.v1");
    return migrateSave(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("Unable to read local save; using a fresh profile.", error);
    return createDefaultSave();
  }
}

export function persistSave(save, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    const chess = save.modes.chess;
    const snapshot = {
      ...save,
      version: SAVE_VERSION,
      modes: {
        ...save.modes,
        chess: chess?.combat
          ? {
              ...chess,
              // Render samples are transient. Keep the authoritative final actors/results on reload.
              combat: {
                ...chess.combat,
                frames: chess.combat.frames.slice(-1),
                events: [],
              },
            }
          : chess,
      },
    };
    storage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
