import {
  createAdventureState,
  interactAdventure,
  nearestInteraction,
  setAdventureInput,
  stepAdventure,
  activateUltimate,
  beginBattle,
  claimBattleResult,
  WORLD,
  resolveCameraViewport,
  transitionMap,
  solveAdventurePuzzle,
  upgradeAdventureCharacter,
  refineAdventureMaterial,
} from "./modes/adventure.js";
import {
  createTcgMatch,
  playTcgCard,
  passTcgPriority,
  attackTcg,
  endTcgTurn,
  stepTcgBot,
  mulliganTcg,
  surrenderTcg,
  validateDeck,
  createPresetDeck,
} from "./modes/tcg.js";
import {
  advanceChessRound,
  buyChessOffer,
  createChessRun,
  moveChessUnit,
  placeChessUnit,
  refreshChessShop,
  sellChessUnit,
  startChessCombat,
  toggleChessLock,
  buyChessExperience,
  benchChessUnit,
  equipChessItem,
  surrenderChess,
} from "./modes/autoChess.js";
import { gameEvents } from "./core/events.js";
import { loadSave, migrateSave, persistSave, SAVE_KEY } from "./core/save.js";
import { AnimationAdapter } from "./render/animationAdapter.js";
import { findAdventurePath } from "./modes/adventureNavigation.js";
import {
  createAdventureMapRegistry,
  getAdventureMap,
} from "./modes/mapCatalog.js";
import { spriteRenderer } from "./render/spriteRenderer.js";
import { preloadGameAssets } from "./render/spriteAssets.js";
import { GameAudio, trackForContext } from "./core/audio.js";
import { PRESENTATION } from "./core/rules.js";
import { CHARACTERS, ELEMENTS, ROLES } from "./core/characters.js";
import { tcgTemplate, deckTemplate } from "./ui/tcgView.js";
import { chessTemplate } from "./ui/chessView.js";
import { BattleEffects } from "./render/battleEffects.js";

const app = document.querySelector("#app");
const runtime = {
  page:
    location.hash.slice(1) ||
    new URLSearchParams(location.search).get("mode") ||
    "home",
  save: loadSave(),
  adventure: null,
  cards: null,
  deck: null,
  units: null,
  maps: null,
  shopConfig: null,
  tcg: null,
  chess: null,
  selectedTarget: "commander",
  selectedBench: null,
  selectedBoard: null,
  selectedCard: null,
  selectedAttackers: [],
  chessPlayback: null,
  overlay: null,
  deckDraft: null,
  notice: "",
  events: [],
  lastSavedLocation: 0,
  heldKeys: new Set(),
};
runtime.adventure = createAdventureState(runtime.save);
runtime.tcg = runtime.save.modes.tcg;
runtime.chess = runtime.save.modes.chess;
runtime.animations = new AnimationAdapter({
  eventTarget: gameEvents,
  reducedMotion: runtime.save.settings.reducedMotion,
  onWarning: (message) => console.warn(message),
});
window.soulOfMealAnimation = runtime.animations;
runtime.audio = new GameAudio(runtime.save.settings);
runtime.effects = new BattleEffects();
runtime.positions = new Map();
runtime.lastBotAction = 0;
runtime.notice = runtime.save.migrationNotice ?? "";
delete runtime.save.migrationNotice;

gameEvents.addEventListener("game-event", ({ detail }) => {
  runtime.events.unshift(detail);
  runtime.events = runtime.events.slice(0, 40);
  runtime.effects.add(
    detail,
    runtime.positions,
    performance.now(),
    runtime.save.settings.reducedMotion,
  );
  if (detail.type === "hit_resolved" || detail.type === "heal_resolved")
    runtime.audio.effect(detail.type.includes("heal") ? "heal" : "hit");
  if (detail.type === "element_combo") {
    runtime.comboBannerUntil = performance.now() + 1800;
    runtime.audio.effect("spell");
  }
  if (detail.type === "actor_spawned" && detail.payload.boss)
    runtime.audio.setTrack("epic_boss_battle");
  if (detail.type === "battle_finished")
    runtime.audio.setTrack(trackForContext(runtime.page));
});

const iconMap = {
  home: "⌂",
  adventure: "⌖",
  tcg: "▤",
  chess: "▦",
  settings: "⚙",
};
const characterNames = {
  chr_bunbo_holinh: "Bún Bò Hỏa Linh",
  chr_pho_lamvu: "Phở Lam Vũ",
  chr_goicuon_diepnhi: "Gỏi Cuốn Diệp Nhi",
  chr_banhbao_bachngoc: "Bánh Bao Bạch Ngọc",
  chr_caphe_davu: "Cà Phê Dạ Vũ",
};
const elementColors = {
  fire: "#dd684a",
  water: "#428eac",
  wood: "#548d56",
  light: "#b8923c",
  shadow: "#75627e",
};

async function loadContent() {
  const names = ["village", "forest", "coast", "volcano", "mist", "ruins"];
  const read = (path) =>
    fetch(new URL(`../examples/${path}`, new URL("../", import.meta.url)))
      .then(checkResponse)
      .then((response) => response.json());
  const [cards, deck, unitsData, shopConfig, ...maps] = await Promise.all([
    read("cards/cards.catalog.json"),
    read("cards/starter_deck.json"),
    read("auto_chess/units.json"),
    read("auto_chess/shop_odds.json"),
    ...names.map((name) => read(`maps/${name}.json`)),
  ]);
  runtime.cards = cards;
  runtime.deck =
    runtime.save.decks[runtime.save.activeDeck] ??
    createPresetDeck(runtime.save.activeDeck);
  validateDeck(runtime.deck, cards);
  runtime.units = unitsData.units;
  runtime.shopConfig = shopConfig;
  runtime.maps = createAdventureMapRegistry(maps);
  await preloadGameAssets(spriteRenderer);
  for (const [id, entry] of spriteRenderer.sheets)
    if (entry.manifest) runtime.animations.manifests[id] = entry.manifest;
}

function checkResponse(response) {
  if (!response.ok)
    throw new Error(`Không tải được dữ liệu game (${response.status}).`);
  return response;
}

function saveNow() {
  runtime.save.adventure.map = runtime.adventure.map;
  runtime.save.adventure.x = runtime.adventure.x;
  runtime.save.adventure.y = runtime.adventure.y;
  runtime.save.adventure.battle = runtime.adventure.battle;
  runtime.save.adventure.safePosition = runtime.adventure.safePosition;
  runtime.save.modes.tcg = runtime.tcg;
  runtime.save.modes.chess = runtime.chess;
  if (!persistSave(runtime.save))
    runtime.notice =
      "Không thể lưu trên thiết bị. Hãy xuất bản sao tiến trình trong Cài đặt.";
}

function navigate(page) {
  runtime.page = page;
  runtime.notice = "";
  runtime.overlay = null;
  runtime.heldKeys.clear();
  runtime.audio.setTrack(
    trackForContext(
      page,
      page === "adventure" &&
        Boolean(
          runtime.adventure.battle?.actors.some(
            (actor) => actor.boss && actor.alive,
          ),
        ),
    ),
  );
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#${page}`,
  );
  render();
}

function navButton(page, label) {
  return `<button class="nav-button" aria-label="${escapeAttr(label)}" data-page="${page}" aria-current="${runtime.page === page ? "page" : "false"}"><span class="nav-icon" aria-hidden="true">${iconMap[page] ?? "•"}</span><span>${label}</span></button>`;
}

function shell(content) {
  const player = runtime.save.player;
  app.innerHTML = `
    <div class="shell ${["adventure", "tcg", "chess"].includes(runtime.page) ? "game-shell" : ""}" data-current-page="${runtime.page}">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">味</div><div class="brand-name">SOUL OF MEAL<small>HÀNH TRÌNH VỊ LINH</small></div></div>
        <nav class="nav-group" aria-label="Điều hướng chính"><div class="nav-label">Trạm hành trình</div>
          ${navButton("home", "Tổng quan")}${navButton("adventure", "Phiêu lưu")}${navButton("tcg", "Thẻ chiến thuật")}${navButton("chess", "Đấu trường Vị Linh")}
        </nav>
        <div class="sidebar-spacer"></div>
        <nav class="nav-group" aria-label="Tài khoản">${navButton("settings", "Cài đặt")}</nav>
        <div class="profile-chip"><div class="profile-avatar">味</div><div class="profile-copy">${escapeHtml(player.name)}<small>Cấp ${player.level} · Lữ khách</small></div></div>
      </aside>
      <main class="main">${content}</main>${runtime.notice ? `<div class="toast" role="status">${escapeHtml(runtime.notice)}</div>` : ""}${runtime.updateWaiting ? '<div class="update-banner">Có bản cập nhật mới. <button class="button compact" data-update>Áp dụng & tải lại</button></div>' : ""}
      <nav class="mobile-nav" aria-label="Điều hướng nhanh">${navButton("home", "Nhà")}${navButton("adventure", "Khám phá")}${navButton("tcg", "Thẻ")}${navButton("chess", "Đấu cờ")}</nav>
    </div>`;
  app
    .querySelectorAll("[data-page]")
    .forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.page)),
    );
  document.documentElement.dataset.reducedMotion = String(
    runtime.save.settings.reducedMotion,
  );
  app.querySelector("[data-update]")?.addEventListener("click", async () => {
    saveNow();
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      runtime.updateWaiting = registration.waiting;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      runtime.updateWaiting = null;
      location.reload();
    }
  });
}

function pageHeader(kicker, title, description, back = "home") {
  return `<div class="topline"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${description}</p></div><div class="resource-row"><div class="resource">◈ ${runtime.save.player.gold}</div><div class="resource">✦ ${runtime.save.player.essence}</div><button class="button light compact" data-page="${back}" aria-label="Về tổng quan">←</button><button class="button light compact" data-page="settings" aria-label="Cài đặt">⚙</button></div></div>`;
}

function renderHome() {
  const quest = runtime.save.adventure.quest;
  const headline =
    quest === "not_started"
      ? "Lilia cần bạn ở quảng trường"
      : quest === "completed"
        ? "Hương vị đã trở về"
        : "Dấu vết dẫn vào rừng";
  shell(`
    ${pageHeader("Hành trình Vị Linh · 0.4", "Chào mừng trở lại", "Làng Ẩm Thực đang chờ Người Kết Vị. Tiến trình lưu tự động trên thiết bị này.")}
    <section class="home-hero"><div class="hero-copy"><div class="eyebrow">${quest === "completed" ? "Khu rừng đã yên bình" : "Một hương vị đang thất lạc"}</div><h2>${headline}</h2><p>Khám phá làng, nhận lời nhắn của Lilia và tìm lại hương vị bị đánh cắp. Mỗi món ăn mang một linh hồn. Mỗi hương vị kể một câu chuyện.</p><div class="button-row"><button class="button" data-page="adventure">Tiếp tục hành trình →</button><button class="button secondary" data-page="roster">Đội hình · ${runtime.save.roster.length}</button></div></div><div class="hero-figure" role="img" aria-label="Bún Bò Hỏa Linh"><img src="./assets/portraits/chr_bunbo_holinh.png" alt="Bún Bò Hỏa Linh" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,0.45));" onerror="this.style.display='none'"><div class="hero-orbit"></div><div class="hero-shadow"></div><div class="hero-mascot"><div class="mascot-scarf"></div></div><div class="mascot-flame"></div></div></section>
    <div class="section-head"><div><div class="eyebrow">Ba lối chơi · chung thế giới</div><h2>Chọn hành trình</h2></div><p>Thành tích và tiến trình lưu trên thiết bị.</p></div>
    <section class="mode-grid">
      <button class="mode-card" data-page="adventure"><div class="mode-mark adventure">⌖</div><h3>Phiêu lưu</h3><p>Khám phá làng và rừng, hoàn thành nhiệm vụ, thu thập nguyên liệu và đối mặt Bếp Trưởng Hỏa Diệm.</p><div class="mode-meta"><span>${quest === "completed" ? "Nhiệm vụ hoàn thành" : "Chương 1 · Thất Vị"}</span><span>Vào khu vực →</span></div></button>
      <button class="mode-card" data-page="tcg"><div class="mode-mark tcg">▤</div><h3>Thẻ chiến thuật</h3><p>Xây dựng bộ bài, triệu hồi Vị Linh, quản lý ưu tiên, phản ứng và bẫy úp.</p><div class="mode-meta"><span>Đấu bot · PVE</span><span>Vào trận →</span></div></button>
      <button class="mode-card" data-page="chess"><div class="mode-mark chess">▦</div><h3>Đấu trường Vị Linh</h3><p>Mua quân, xếp đội hình, hợp thể ba bản sao và mô phỏng giao tranh tự động.</p><div class="mode-meta"><span>Chuẩn bị & chiến đấu</span><span>Vào trận →</span></div></button>
    </section><p class="status-line">Một thế giới · Ba lối chơi · Tiến trình tự động lưu trên thiết bị</p>
  `);
}

function renderAdventure() {
  const state = runtime.adventure;
  const battle = state.battle;
  const map = getAdventureMap(runtime.maps, state.map);
  const target = nearestInteraction(state, runtime.save, runtime.maps);
  const quest = {
    not_started: "Gặp Lilia tại quảng trường",
    accepted: "Mở rương, vào rừng và tìm hương vị",
    ready_to_claim: "Trở về báo tin cho Lilia",
    completed: "Khám phá các vùng đất mới",
  }[runtime.save.adventure.quest];
  let overlay = "";
  if (runtime.overlay === "map")
    overlay = `<h2>Thế giới Hương Vị</h2><div class="map-travel">${[...runtime.maps.entries()].map(([id, item]) => `<button class="button light" data-travel="${id}" ${!runtime.save.adventure.unlockedMaps.includes(id) || Boolean(battle) || (id === "forest" && !runtime.save.adventure.chestOpened) ? "disabled" : ""}>${runtime.save.adventure.unlockedMaps.includes(id) ? "⌖" : "🔒"} ${escapeHtml(item.display_name)}</button>`).join("")}</div><p>Thắng thử thách ở vùng hiện tại để mở vùng kế tiếp. Dịch chuyển chỉ dùng ngoài trận.</p>`;
  if (runtime.overlay === "quest")
    overlay = `<h2>Nhật ký hành trình</h2><p>${quest}</p><p>Rương tiếp tế: ${runtime.save.adventure.chestOpened ? "đã mở" : "chưa mở"} · Rừng: ${runtime.save.adventure.forestCleared ? "đã khai thông" : "chưa khai thông"}</p><p>Bia đá công thức cho phần thưởng một lần. Bãi farm và nguyên liệu có thể quay lại.</p>`;
  if (runtime.overlay === "inventory")
    overlay = `<h2>Túi nguyên liệu</h2>${Object.entries(
      runtime.save.adventure.materials,
    )
      .map(
        ([key, value]) =>
          `<div class="data-row"><span>${{ herbs: "Rau thơm", pearl: "Ngọc Hải Vị", ember: "Hỏa Tinh", mist: "Sương Ngưng" }[key]}</span><b>${value}</b></div>`,
      )
      .join(
        "",
      )}<p>Thu thập trong rừng và các vùng đất mới. Nâng cấp tại hồ sơ Vị Linh hoặc chế biến ở làng.</p><div class="map-travel">${[
      ["herbs", "3 Rau thơm → 5 tinh hoa"],
      ["pearl", "2 Ngọc Hải Vị → 8 tinh hoa"],
      ["ember", "2 Hỏa Tinh → 10 tinh hoa"],
      ["mist", "2 Sương Ngưng → 12 tinh hoa"],
    ]
      .map(
        ([key, label]) =>
          `<button class="button light" data-refine="${key}" ${state.map !== "village" || battle ? "disabled" : ""}>${label}</button>`,
      )
      .join(
        "",
      )}</div><button class="button" data-page="roster">Phát triển đội hình</button>`;
  if (runtime.overlay === "party")
    overlay = `<h2>Người Kết Vị + 4 đồng hành</h2>${runtime.save.roster.map((actor) => `<label class="party-option"><img src="./assets/avatars/avatar_${actor.id.replace("chr_", "")}.png" alt=""><span>${escapeHtml(characterNames[actor.id])}<small>${actor.hp}/${actor.maxHp} HP</small></span><input type="checkbox" data-party="${actor.id}" ${runtime.save.party.includes(actor.id) ? "checked" : ""} ${battle ? "disabled" : ""}></label>`).join("")}<p>Chọn tối đa 4 Vị Linh. Đội hình được khóa khi giao chiến.</p>`;
  if (state.puzzle)
    overlay = `<h2>Bia đá công thức</h2><p>Nước dùng trước, Rau thơm tiếp, Hỏa vị cuối.</p><p>Đã chọn: ${state.puzzle.selected.map((element) => ELEMENTS[element]).join(" → ") || "Chưa có"}</p><div class="button-row">${["fire", "water", "wood"].map((element) => `<button class="button light" data-puzzle-choice="${element}">${ELEMENTS[element]}</button>`).join("")}</div><button class="button" data-puzzle-submit>Hoàn thành công thức</button><button class="button light" data-puzzle-reset>Chọn lại</button>`;
  shell(`${pageHeader("Thế giới Hương Vị", escapeHtml(map.display_name), battle ? `Đợt ${battle.wave + 1}/${battle.waveCount} · tự động đánh thường, chủ động dùng tuyệt kỹ.` : "WASD / phím mũi tên, cần điều khiển hoặc chạm điểm đến. E để tương tác.")}
  <section class="adventure-client"><div class="adventure-toolbar"><span class="phase-pill">${battle ? "⚔ Giao chiến" : "⌖ Khám phá"}</span>${[
    ["quest", "Nhiệm vụ"],
    ["map", "Bản đồ"],
    ["inventory", "Túi đồ"],
    ["party", "Đội hình"],
  ]
    .map(
      ([key, label]) =>
        `<button class="button light compact" data-overlay="${key}">${label}</button>`,
    )
    .join("")}</div>
  <div class="world-viewport"><canvas id="adventure-canvas" width="960" height="540" aria-label="${escapeAttr(map.display_name)}"></canvas><div class="quest-chip">✧ ${escapeHtml(quest)}</div><div class="joystick" data-joystick role="group" aria-label="Cần điều khiển cảm ứng"><span>✥</span><i></i></div><button class="button interact-floating" data-interact ${battle || !target ? "disabled" : ""}>${target ? escapeHtml(target.label) : "Tương tác"} <small>E</small></button><div class="battle-hud" data-combat-hud></div></div>
  <p class="controls-hint" data-world-message>${escapeHtml(state.lastMessage)}</p></section>
  ${overlay ? `<div class="modal-backdrop" data-adventure-close><section class="panel adventure-dialog" role="dialog" aria-modal="true" aria-label="Hành trình"><button class="modal-close" data-adventure-close aria-label="Đóng">×</button>${overlay}</section></div>` : ""}`);
  app
    .querySelector("[data-interact]")
    ?.addEventListener("click", doAdventureInteract);
  app
    .querySelector("#adventure-canvas")
    ?.addEventListener("pointerdown", onWorldPointer);
  app.querySelectorAll("[data-overlay]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.overlay = button.dataset.overlay;
      renderAdventure();
    }),
  );
  app.querySelectorAll("[data-adventure-close]").forEach((button) =>
    button.addEventListener("click", (event) => {
      if (event.target !== button) return;
      runtime.overlay = null;
      state.puzzle = null;
      renderAdventure();
    }),
  );
  app.querySelectorAll("[data-travel]").forEach((button) =>
    button.addEventListener("click", () => {
      try {
        const routed = transitionMap(
          state,
          runtime.save,
          button.dataset.travel,
          runtime.maps,
        );
        runtime.save = routed.save;
        runtime.overlay = null;
        state.input = { x: 0, y: 0 };
        saveNow();
        runtime.effects.clear();
        renderAdventure();
      } catch (error) {
        runtime.notice = error.message;
        renderAdventure();
      }
    }),
  );
  app.querySelectorAll("[data-party]").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked && runtime.save.party.length >= 4) {
        input.checked = false;
        runtime.notice = "Chọn tối đa 4 Vị Linh.";
        renderAdventure();
        return;
      }
      runtime.save.party = input.checked
        ? [...runtime.save.party, input.dataset.party]
        : runtime.save.party.filter((id) => id !== input.dataset.party);
      saveNow();
    }),
  );
  app.querySelectorAll("[data-puzzle-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      if (state.puzzle.selected.length < 3)
        state.puzzle.selected.push(button.dataset.puzzleChoice);
      renderAdventure();
    }),
  );
  app.querySelector("[data-puzzle-submit]")?.addEventListener("click", () => {
    runtime.save = solveAdventurePuzzle(
      state,
      runtime.save,
      state.puzzle.selected,
    );
    saveNow();
    renderAdventure();
  });
  app.querySelector("[data-puzzle-reset]")?.addEventListener("click", () => {
    state.puzzle.selected = [];
    renderAdventure();
  });
  app.querySelectorAll("[data-refine]").forEach((button) =>
    button.addEventListener("click", () => {
      try {
        saveNow();
        runtime.save = refineAdventureMaterial(
          runtime.save,
          button.dataset.refine,
        );
        runtime.notice = "Đã chế biến nguyên liệu thành tinh hoa.";
        saveNow();
      } catch (error) {
        runtime.notice = error.message;
      }
      renderAdventure();
    }),
  );
  bindJoystick();
  updateAdventureHud();
}
function updateAdventureHud() {
  const hud = app.querySelector("[data-combat-hud]");
  if (!hud) return;
  const battle = runtime.adventure.battle;
  if (!battle) {
    hud.innerHTML = "";
    return;
  }
  const signature = JSON.stringify([
    battle.phase,
    battle.result,
    ...battle.actors
      .filter((actor) => actor.team === "player")
      .map((actor) => [actor.actor_id, actor.hp, actor.energy, actor.alive]),
  ]);
  if (hud.dataset.signature === signature) return;
  hud.dataset.signature = signature;
  hud.innerHTML =
    battle.phase === "battle_end"
      ? `<div class="result-box ${battle.result}"><strong>${battle.result === "victory" ? "Chiến thắng" : "Đội hình đã gục"}</strong><p>${battle.result === "victory" ? "60 vàng · 10 tinh hoa · 40 kinh nghiệm" : "Nghỉ ngơi tại làng để hồi phục."}</p><button class="button" data-battle-result>${battle.result === "victory" ? "Nhận thưởng & tiếp tục" : "Trở lại khám phá"}</button></div>`
      : battle.actors
          .filter((actor) => actor.team === "player")
          .map(
            (actor) =>
              `<button class="ultimate-button" data-ultimate="${actor.actor_id}" ${actor.energy < 100 || !actor.alive ? "disabled" : ""}><strong>${escapeHtml(characterNames[actor.id] ?? "Người Kết Vị")}</strong><span>${actor.hp}/${actor.maxHp} ♥</span><i style="--energy:${actor.energy}%"></i><small>${actor.energy}% · Tuyệt kỹ</small></button>`,
          )
          .join("");
  hud
    .querySelectorAll("[data-ultimate]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        useUltimate(button.dataset.ultimate),
      ),
    );
  hud.querySelector("[data-battle-result]")?.addEventListener("click", () => {
    runtime.save = claimBattleResult(runtime.adventure, runtime.save);
    saveNow();
    runtime.effects.clear();
    renderAdventure();
  });
}
function bindJoystick() {
  const stick = app.querySelector("[data-joystick]");
  if (!stick) return;
  const stop = () => {
    runtime.adventure.joystickActive = false;
    runtime.adventure.manualInput = false;
    setAdventureInput(runtime.adventure, 0, 0);
    stick.style.setProperty("--jx", "0px");
    stick.style.setProperty("--jy", "0px");
  };
  const move = (event) => {
    if (!runtime.adventure.joystickActive) return;
    const rect = stick.getBoundingClientRect();
    let x = event.clientX - rect.left - rect.width / 2,
      y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    const factor = Math.min(1, 30 / Math.max(1, length));
    x *= factor;
    y *= factor;
    stick.style.setProperty("--jx", `${x}px`);
    stick.style.setProperty("--jy", `${y}px`);
    setAdventureInput(runtime.adventure, x, y);
  };
  stick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stick.setPointerCapture(event.pointerId);
    runtime.adventure.joystickActive = true;
    runtime.adventure.manualInput = true;
    runtime.adventure.walkPath = [];
    move(event);
  });
  stick.addEventListener("pointermove", move);
  stick.addEventListener("pointerup", stop);
  stick.addEventListener("pointercancel", stop);
  stick.addEventListener("lostpointercapture", stop);
}

function renderEventLog() {
  const events = runtime.events.slice(0, 7);
  return `<div class="log">${events.length ? events.map((event) => `<p><b>${escapeHtml(event.type)}</b> · tick ${event.tick}</p>`).join("") : "<p>Chưa có sự kiện trong phiên này.</p>"}</div>`;
}

function doAdventureInteract() {
  const result = interactAdventure(
    runtime.adventure,
    runtime.save,
    runtime.maps,
  );
  runtime.adventure = result.state;
  runtime.save = result.save;
  if (result.changed) saveNow();
  render();
}

function useUltimate(actorId) {
  const result = activateUltimate(runtime.adventure, runtime.save, actorId);
  runtime.adventure.lastMessage = result.ok
    ? runtime.adventure.lastMessage
    : result.reason;
  render();
}

function claimAdventureBattle() {
  if (runtime.adventure.battle?.result === "defeat") {
    runtime.adventure.battle = null;
    beginBattle(runtime.adventure, runtime.save);
    render();
    return;
  }
  runtime.save = claimBattleResult(runtime.adventure, runtime.save);
  saveNow();
  render();
}

function onWorldPointer(event) {
  if (runtime.adventure.battle) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const viewport = runtime.viewport ?? WORLD;
  const scale = Math.min(
    rect.width / viewport.width,
    rect.height / viewport.height,
  );
  const offsetX = (rect.width - viewport.width * scale) / 2;
  const offsetY = (rect.height - viewport.height * scale) / 2;
  const x =
    (event.clientX - rect.left - offsetX) / scale + (runtime.camera?.x ?? 0);
  const y =
    (event.clientY - rect.top - offsetY) / scale + (runtime.camera?.y ?? 0);
  const path = findAdventurePath(
    runtime.adventure.map,
    { x: runtime.adventure.x, y: runtime.adventure.y },
    { x, y },
    undefined,
    runtime.maps,
  );
  if (!path.length) {
    runtime.adventure.lastMessage = "Không tìm được đường đi tới điểm đó.";
    canvas.dataset.pathLength = "0";
    return;
  }
  runtime.adventure.walkPath = path;
  runtime.adventure.walkTarget = { x, y };
  canvas.dataset.pathLength = String(path.length);
}

function drawAdventureFrame(deltaSeconds) {
  const canvas = app.querySelector("#adventure-canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const adventure = runtime.adventure;
  const rect = canvas.getBoundingClientRect();
  const viewport = adventure.battle
    ? WORLD
    : {
        width: Math.max(
          320,
          Math.min(960, (rect.width / Math.max(1, rect.height)) * 540),
        ),
        height: 540,
      };
  runtime.viewport = viewport;
  if (
    canvas.width !== Math.round(viewport.width * ratio) ||
    canvas.height !== Math.round(viewport.height * ratio)
  ) {
    canvas.width = Math.round(viewport.width * ratio);
    canvas.height = Math.round(viewport.height * ratio);
  }
  context.setTransform(
    canvas.width / viewport.width,
    0,
    0,
    canvas.height / viewport.height,
    0,
    0,
  );
  const camera = resolveCameraViewport(
    adventure.x,
    adventure.y,
    viewport,
    WORLD.width,
    WORLD.height,
  );
  runtime.camera = camera;
  const cameraContext = { ...camera };
  if (adventure.battle) setAdventureInput(adventure, 0, 0);
  else if (runtime.heldKeys.size) {
    adventure.manualInput = true;
    const x =
      Number(runtime.heldKeys.has("ArrowRight") || runtime.heldKeys.has("d")) -
      Number(runtime.heldKeys.has("ArrowLeft") || runtime.heldKeys.has("a"));
    const y =
      Number(runtime.heldKeys.has("ArrowDown") || runtime.heldKeys.has("s")) -
      Number(runtime.heldKeys.has("ArrowUp") || runtime.heldKeys.has("w"));
    setAdventureInput(adventure, x, y);
    adventure.walkTarget = null;
    adventure.walkPath = [];
  }
  if (!runtime.heldKeys.size && !adventure.joystickActive) {
    adventure.manualInput = false;
    if (!adventure.walkPath?.length) setAdventureInput(adventure, 0, 0);
  }
  stepAdventure(adventure, runtime.save, deltaSeconds, runtime.maps);
  if (adventure._pendingSave) {
    runtime.save = adventure._pendingSave;
    adventure._pendingSave = null;
    saveNow();
  }
  if (adventure.battle && !runtime.hudPointerDown) updateAdventureHud();
  const message = app.querySelector("[data-world-message]");
  if (message) message.textContent = adventure.lastMessage;
  syncAdventureAnimations(adventure);
  runtime.animations.advance(deltaSeconds * 1000);
  const target = nearestInteraction(adventure, runtime.save, runtime.maps);
  const interactButton = app.querySelector("[data-interact]");
  if (interactButton && !adventure.battle) {
    interactButton.disabled = !target;
    interactButton.textContent = target
      ? `Tương tác · ${target.label}`
      : "Tiến gần một điểm tương tác";
  }
  const now = Date.now();
  if (now - runtime.lastSavedLocation > 900) {
    runtime.lastSavedLocation = now;
    runtime.save.adventure.map = adventure.map;
    runtime.save.adventure.x = adventure.x;
    runtime.save.adventure.y = adventure.y;
    saveNow();
  }
  canvas.dataset.worldX = String(Math.round(adventure.x));
  canvas.dataset.worldY = String(Math.round(adventure.y));
  canvas.dataset.simTick = String(adventure.tick);
  canvas.dataset.pathRemaining = String(adventure.walkPath?.length ?? 0);
  const heroAnimation =
    runtime.animations.getActorState("chr_bunbo_holinh")?.animation;
  canvas.dataset.animationClip = heroAnimation?.requestedClipId ?? "idle";
  canvas.dataset.animationFallback = String(heroAnimation?.missingClip ?? true);
  if (adventure.battle) drawBattleScene(context, adventure);
  else {
    context.save();
    context.translate(-cameraContext.x, -cameraContext.y);
    drawWorldScene(context, adventure, runtime.save);
    context.restore();
  }
}

function syncAdventureAnimations(adventure) {
  const views = [];
  if (adventure.battle) {
    const playerActors = adventure.battle.actors.filter(
      (actor) => actor.team === "player",
    );
    playerActors.forEach((actor, index) => {
      views.push({
        actorId: actor.actor_id,
        characterId: actor.id,
        team: actor.team,
        x: actor.combatX ?? 140 + index * 75,
        y: actor.combatY ?? 300 + Math.sin(index * 2) * 20,
        direction: "E",
        alive: actor.alive,
      });
    });
    adventure.battle.actors
      .filter((actor) => actor.team === "enemy")
      .forEach((actor, index) => {
        views.push({
          actorId: actor.actor_id,
          characterId: actor.id,
          team: actor.team,
          x: actor.combatX ?? (actor.boss ? 690 : 670 + index * 75),
          y:
            actor.combatY ??
            (actor.boss ? 280 : 298 + Math.sin(index * 3) * 15),
          direction: "W",
          alive: actor.alive,
        });
      });
  } else {
    const direction =
      { up: "N", right: "E", down: "S", left: "W" }[adventure.facing] ?? "S";
    views.push({
      actorId: "chr_bunbo_holinh",
      characterId: "chr_bunbo_holinh",
      team: "player",
      x: adventure.x,
      y: adventure.y,
      direction,
      alive: true,
    });
  }

  for (const view of views) {
    runtime.animations.registerActor(view);
    runtime.animations.syncMotion(view.actorId, {
      x: view.x,
      y: view.y,
      direction: view.direction,
      speed:
        !adventure.battle &&
        Math.hypot(adventure.input.x, adventure.input.y) > 0
          ? 1.5
          : 0,
      alive: view.alive,
    });
  }
  runtime.animations.retainActors(views.map((view) => view.actorId));
}

function drawWorldScene(context, adventure, save) {
  const forest = adventure.map !== "village";
  const map = getAdventureMap(runtime.maps, adventure.map);
  context.fillStyle =
    { coast: "#6bafbd", volcano: "#916953", mist: "#82999b", ruins: "#807791" }[
      adventure.map
    ] ?? (forest ? "#6d9870" : "#9cc88e");
  context.fillRect(0, 0, 960, 540);
  context.fillStyle = forest ? "#8bb080" : "#b5d29b";
  for (let row = 0; row < 12; row += 1)
    for (let column = 0; column < 20; column += 1) {
      if ((row + column) % 3 === 0) {
        context.globalAlpha = 0.22;
        context.beginPath();
        context.ellipse(
          column * 52 + 20,
          row * 50 + 15,
          13,
          4,
          -0.4,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  context.globalAlpha = 1;
  context.fillStyle = forest ? "#d7c792" : "#d8c99e";
  context.beginPath();
  context.moveTo(-20, 350);
  context.bezierCurveTo(170, 260, 260, 500, 450, 390);
  context.bezierCurveTo(640, 280, 720, 340, 990, 225);
  context.lineTo(990, 308);
  context.bezierCurveTo(720, 420, 640, 360, 470, 455);
  context.bezierCurveTo(240, 570, 160, 340, -20, 430);
  context.fill();
  drawMapVisuals(context, map, save, adventure.y);
  drawPlayer(
    context,
    adventure.x,
    adventure.y,
    runtime.animations.getActorState("chr_bunbo_holinh")?.animation,
  );
  drawMapVisuals(context, map, save, adventure.y, true);
  context.fillStyle = "#173c35";
  context.font = "700 14px DM Sans, sans-serif";
  context.fillText(map.display_name.toLocaleUpperCase("vi"), 22, 30);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawMapVisuals(
  context,
  map,
  save,
  playerY = Infinity,
  foreground = false,
) {
  if (!map) return;
  for (const visual of [...map.visuals].sort(
    (a, b) => a.y + (a.height ?? 48) - (b.y + (b.height ?? 48)),
  )) {
    const inFront =
      ["tree", "house"].includes(visual.kind) &&
      visual.y + (visual.height ?? 48) > playerY;
    if (foreground !== inFront) continue;
    if (visual.kind === "house") {
      const palette = { coral: "#c96b50", sage: "#7b8d72", gold: "#d4a84e" };
      const labels = {
        building_kitchen: "NHÀ BẾP",
        building_guild: "HỘI QUÁN",
        building_merchant: "TIỆM",
      };
      drawHouse(
        context,
        visual.x,
        visual.y,
        palette[visual.palette] ?? "#b87855",
        labels[visual.id] ?? "NHÀ",
        visual.width,
        visual.height,
        visual.id,
      );
    } else if (visual.kind === "table") {
      drawTable(context, visual.x, visual.y, visual.width, visual.height);
    } else if (visual.kind === "tree") {
      drawTree(
        context,
        visual.x,
        visual.y,
        visual.palette === "forest_dark" ? "#356c50" : "#437a51",
        visual.palette,
      );
    } else if (visual.kind === "marker") {
      const color =
        visual.palette === "wood"
          ? "#4b7f62"
          : visual.palette === "coral"
            ? "#e87552"
            : "#efbd54";
      drawMarker(context, visual.x, visual.y, visual.label, color);
    } else if (visual.kind === "chest" && !save.adventure.chestOpened) {
      drawChest(context, visual.x, visual.y, false);
    } else if (visual.kind === "portal") {
      const open = save.adventure.chestOpened;
      drawMarker(
        context,
        visual.x,
        visual.y,
        open ? visual.label : "KHÓA",
        open ? "#e87552" : "#68786e",
      );
    }
  }
}

function drawBattleScene(context, adventure) {
  const battle = adventure.battle;
  const gradient = context.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, "#314e43");
  gradient.addColorStop(1, "#a48258");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 960, 540);
  context.fillStyle = "#6f7753";
  context.beginPath();
  context.ellipse(485, 342, 440, 130, 0, 0, Math.PI * 2);
  context.fill();
  for (let index = 0; index < 5; index += 1) {
    const actor = battle.actors.filter((item) => item.team === "player")[index];
    drawActor(
      context,
      actor,
      actor?.combatX ?? 140 + index * 75,
      actor?.combatY ?? 300 + Math.sin(index * 2) * 20,
      index === 0 ? "#de704f" : (elementColors[actor?.element] ?? "#86ac72"),
      runtime.animations.getActorState(actor?.actor_id)?.animation,
    );
  }
  const enemies = battle.actors.filter((item) => item.team === "enemy");
  enemies.forEach((enemy, index) =>
    drawActor(
      context,
      enemy,
      enemy.combatX ?? (enemy.boss ? 690 : 670 + index * 75),
      enemy.combatY ?? (enemy.boss ? 280 : 298 + Math.sin(index * 3) * 15),
      enemy.boss ? "#b54e3e" : "#648c4e",
      runtime.animations.getActorState(enemy.actor_id)?.animation,
    ),
  );
  runtime.effects.draw(context);
  context.fillStyle = "#fff8e6";
  context.font = "700 16px system-ui";
  context.fillText(`DỢT ${battle.wave + 1}/${battle.waveCount}`, 24, 32);
  if (battle.bossTelegraph) {
    context.fillStyle = "#ef6d4280";
    context.beginPath();
    context.ellipse(300, 310, 250, 65, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffe8b3";
    context.font = "700 18px system-ui";
    context.fillText("⚠ BOSS CHUẨN BỊ TẤN CÔNG", 450, 50);
  }
}

function drawActor(context, actor, x, y, color, animation) {
  if (!actor) return;
  const size = actor.boss ? 55 : 31;
  runtime.positions.set(actor.actor_id, { x, y });
  const charId = actor.boss ? "boss_thief" : (actor.id ?? "chr_bunbo_holinh");

  // Thử vẽ Sprite đồ họa
  const spriteDrawn = spriteRenderer.drawSprite(
    context,
    charId,
    animation,
    x,
    y,
    {
      scale: actor.boss ? 1.3 : 1.0,
      flipX: actor.team === "enemy",
      opacity: actor.alive ? 1.0 : 0.28,
    },
  );

  if (!spriteDrawn) {
    const pose = placeholderPose(animation);
    context.save();
    context.translate(x, y + pose.offsetY);
    context.scale(pose.scaleX, pose.scaleY);
    context.translate(-x, -y);
    context.globalAlpha = actor.alive ? 1 : 0.28;
    context.fillStyle = "#1f3027a0";
    context.beginPath();
    context.ellipse(x, y + size, size * 0.85, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, size * 0.65, size, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff5db";
    context.beginPath();
    context.arc(x, y - size * 0.62, size * 0.4, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.restore();
  }

  // Tên & Thanh máu
  context.save();
  context.globalAlpha = actor.alive ? 1 : 0.28;
  context.fillStyle = "#283831";
  context.font = "700 12px DM Sans, sans-serif";
  context.textAlign = "center";
  context.fillText(
    (actor.name ?? characterNames[actor.id] ?? "V").slice(0, 12),
    x,
    y + size + 22,
  );
  context.textAlign = "left";
  context.fillStyle = "#24443a";
  context.fillRect(x - size, y - size - 13, size * 2, 5);
  context.fillStyle = "#e98157";
  context.fillRect(
    x - size,
    y - size - 13,
    size * 2 * Math.max(0, actor.hp / actor.maxHp),
    5,
  );
  context.restore();
}

function drawHouse(
  context,
  x,
  y,
  color,
  label,
  width = 176,
  height = 118,
  houseId = "",
) {
  const houseKey = `./assets/sprites/maps/${houseId.replace("building_", "house_")}.png`;
  const drawn = spriteRenderer.drawImage(
    context,
    houseKey,
    x,
    y,
    width,
    height,
  );
  if (!drawn) {
    context.fillStyle = "#425b45";
    context.fillRect(x + 10, y + 38, width - 20, height - 38);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y + 47);
    context.lineTo(x + width / 2, y);
    context.lineTo(x + width, y + 47);
    context.fill();
    context.fillStyle = "#ead9ad";
    context.fillRect(x + 27, y + 48, width - 34, height - 48);
    context.fillStyle = "#745840";
    context.fillRect(x + width / 2 - 14, y + height - 40, 28, 40);
  }
  context.fillStyle = "#304e40";
  context.font = "700 11px DM Sans, sans-serif";
  context.fillText(label, x + 47, y + height + 18);
}

function drawTree(context, x, y, color, palette = "forest_light") {
  const treeKey =
    palette === "forest_dark"
      ? "./assets/sprites/maps/tree_02.png"
      : "./assets/sprites/maps/tree_01.png";
  const drawn = spriteRenderer.drawImage(
    context,
    treeKey,
    x - 24,
    y - 48,
    48,
    96,
  );
  if (!drawn) {
    context.fillStyle = "#664c38";
    context.fillRect(x - 7, y + 7, 14, 43);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y - 45);
    context.lineTo(x - 36, y + 20);
    context.lineTo(x + 36, y + 20);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x, y - 21);
    context.lineTo(x - 31, y + 40);
    context.lineTo(x + 31, y + 40);
    context.closePath();
    context.fill();
  }
}

function drawMarker(context, x, y, label, color) {
  context.fillStyle = "#213d33";
  context.beginPath();
  context.ellipse(x, y + 34, 30, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 23, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff6e3";
  context.font = "700 10px DM Sans, sans-serif";
  context.textAlign = "center";
  context.fillText(label, x, y + 4);
  context.textAlign = "left";
}

function drawChest(context, x, y, opened = false) {
  const chestKey = opened
    ? "./assets/sprites/maps/chest_open.png"
    : "./assets/sprites/maps/chest_closed.png";
  const drawn = spriteRenderer.drawImage(
    context,
    chestKey,
    x - 20,
    y - 20,
    40,
    40,
  );
  if (!drawn) {
    context.fillStyle = "#563f29";
    context.fillRect(x - 25, y - 17, 50, 36);
    context.fillStyle = "#dba94f";
    context.fillRect(x - 25, y - 19, 50, 12);
    context.fillStyle = "#f1d77d";
    context.fillRect(x - 4, y - 11, 8, 25);
  }
  context.fillStyle = "#fff4cf";
  context.font = "700 11px DM Sans, sans-serif";
  context.textAlign = "center";
  context.fillText("RƯƠNG", x, y + 37);
  context.textAlign = "left";
}

function drawTable(context, x, y, width = 85, height = 52) {
  const legHeight = height - 20;
  context.fillStyle = "#80523c";
  context.fillRect(x, y, width, 22);
  context.fillRect(x + 9, y + 20, 8, legHeight);
  context.fillRect(x + width - 18, y + 20, 8, legHeight);
  context.fillStyle = "#f0d7a5";
  context.fillRect(x + 11, y + 4, 16, 8);
  context.fillRect(x + 39, y + 4, 16, 8);
}

function drawPlayer(context, x, y, animation) {
  const facingLeft = runtime.adventure?.facing === "left";
  const drawn = spriteRenderer.drawSprite(
    context,
    "chr_bunbo_holinh",
    animation,
    x,
    y,
    {
      scale: 1.0,
      flipX: facingLeft,
    },
  );
  if (!drawn) {
    const pose = placeholderPose(animation);
    context.save();
    context.translate(x, y + pose.offsetY);
    context.scale(pose.scaleX, pose.scaleY);
    context.translate(-x, -y);
    context.fillStyle = "#193b32";
    context.beginPath();
    context.ellipse(x, y + 22, 19, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#df7051";
    context.beginPath();
    context.ellipse(x, y, 14, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f2d5a5";
    context.beginPath();
    context.arc(x, y - 16, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#39433a";
    context.fillRect(x - 12, y - 26, 24, 6);
    context.restore();
  }
}

function placeholderPose(animation) {
  const clip = animation?.requestedClipId ?? animation?.clipId ?? "idle";
  const phase = animation?.frameIndex ?? 0;
  if (clip === "hit") return { scaleX: 1.13, scaleY: 0.82, offsetY: 4 };
  if (clip === "attack_a" || clip === "attack_b")
    return { scaleX: 1.12, scaleY: 1.02, offsetY: 0 };
  if (clip === "skill_01" || clip === "ultimate_01")
    return { scaleX: 1.18, scaleY: 1.12, offsetY: -3 };
  if (clip === "defeat") return { scaleX: 0.94, scaleY: 0.7, offsetY: 8 };
  if (clip === "walk" || clip === "run")
    return {
      scaleX: 1,
      scaleY: phase % 2 === 0 ? 0.96 : 1.04,
      offsetY: phase % 2 === 0 ? 2 : -2,
    };
  return {
    scaleX: 1,
    scaleY: phase % 2 === 0 ? 1 : 1.02,
    offsetY: phase % 2 === 0 ? 0 : -1,
  };
}

function renderTcg() {
  if (!runtime.tcg)
    runtime.tcg = createTcgMatch(
      runtime.cards,
      runtime.deck,
      Date.now() % 999983,
    );
  shell(tcgTemplate(runtime, pageHeader));
  app.querySelectorAll("[data-card]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.selectedCard = button.dataset.card;
      renderTcg();
    }),
  );
  app.querySelectorAll("[data-close-modal]").forEach((button) =>
    button.addEventListener("click", (event) => {
      if (event.target !== button) return;
      runtime.selectedCard = null;
      renderTcg();
    }),
  );
  app.querySelector("[data-card-confirm]")?.addEventListener("click", () => {
    const target = app.querySelector("#tcg-target").value;
    const card = runtime.selectedCard;
    runtime.selectedCard = null;
    actTcg(() => playTcgCard(runtime.tcg, 0, card, target));
  });
  app
    .querySelector("[data-tcg-pass]")
    ?.addEventListener("click", () =>
      actTcg(() => passTcgPriority(runtime.tcg, 0)),
    );
  app.querySelector("[data-tcg-attack]")?.addEventListener("click", () => {
    const target = app.querySelector("#attack-target").value;
    const units = runtime.selectedAttackers.length
      ? runtime.selectedAttackers
      : runtime.tcg.players[0].units
          .filter((unit) => unit.ready)
          .map((unit) => unit.instance_id);
    actTcg(() =>
      attackTcg(
        runtime.tcg,
        0,
        units,
        target === "auto"
          ? {}
          : Object.fromEntries(units.map((id) => [id, target])),
      ),
    );
    runtime.selectedAttackers = [];
  });
  app
    .querySelector("[data-tcg-skip]")
    ?.addEventListener("click", () =>
      actTcg(() => attackTcg(runtime.tcg, 0, [])),
    );
  app
    .querySelector("[data-tcg-end]")
    ?.addEventListener("click", () => actTcg(() => endTcgTurn(runtime.tcg, 0)));
  app
    .querySelector("[data-tcg-surrender]")
    ?.addEventListener("click", () => actTcg(() => surrenderTcg(runtime.tcg)));
  app.querySelector("[data-mulligan]")?.addEventListener("click", () =>
    actTcg(() =>
      mulliganTcg(
        runtime.tcg,
        0,
        runtime.tcg.players[0].hand.map((card) => card.instance_id),
      ),
    ),
  );
  app.querySelectorAll("[data-attacker]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.attacker;
      runtime.selectedAttackers = runtime.selectedAttackers.includes(id)
        ? runtime.selectedAttackers.filter((item) => item !== id)
        : [...runtime.selectedAttackers, id];
      renderTcg();
    }),
  );
  app.querySelector("[data-tcg-new]")?.addEventListener("click", () => {
    runtime.tcg = createTcgMatch(
      runtime.cards,
      runtime.deck,
      Date.now() % 999983,
    );
    runtime.selectedCard = null;
    runtime.selectedAttackers = [];
    saveNow();
    renderTcg();
  });
  saveNow();
}
function actTcg(action) {
  try {
    runtime.tcg = action();
    runtime.notice = "";
    saveNow();
  } catch (error) {
    runtime.notice = error.message;
  }
  renderTcg();
}
function renderDeck() {
  runtime.deckDraft ??= structuredClone(runtime.deck);
  shell(deckTemplate(runtime, pageHeader));
  app.querySelectorAll("[data-deck-preset]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.deckDraft = createPresetDeck(button.dataset.deckPreset);
      renderDeck();
    }),
  );
  for (const [attribute, delta] of [
    ["deckAdd", 1],
    ["deckRemove", -1],
  ])
    app
      .querySelectorAll(
        `[data-${attribute === "deckAdd" ? "deck-add" : "deck-remove"}]`,
      )
      .forEach((button) =>
        button.addEventListener("click", () => {
          const id = button.dataset[attribute];
          const entry = runtime.deckDraft.cards.find(
            (item) => item.card_id === id,
          );
          if (entry) entry.count += delta;
          else runtime.deckDraft.cards.push({ card_id: id, count: 1 });
          runtime.deckDraft.cards = runtime.deckDraft.cards.filter(
            (item) => item.count > 0,
          );
          renderDeck();
        }),
      );
  app.querySelector("[data-deck-save]")?.addEventListener("click", () => {
    try {
      validateDeck(runtime.deckDraft, runtime.cards);
      runtime.deck = structuredClone(runtime.deckDraft);
      runtime.save.activeDeck = "custom";
      runtime.save.decks.custom = runtime.deck;
      runtime.notice = "Đã lưu. Bộ bài mới dùng từ trận tiếp theo.";
      saveNow();
      renderDeck();
    } catch (error) {
      runtime.notice = error.message;
      renderDeck();
    }
  });
}
function renderChess() {
  if (!runtime.chess)
    runtime.chess = createChessRun(
      runtime.units,
      runtime.shopConfig,
      Date.now() % 999983,
    );
  shell(chessTemplate(runtime, pageHeader));
  if (runtime.chessPanel) {
    const index = { standings: 0, synergy: 1, items: 2, log: 3 }[
      runtime.chessPanel
    ];
    const source = app.querySelectorAll(".side-stack > .panel")[index];
    if (source) {
      const modal = document.createElement("div");
      modal.className = "modal-backdrop";
      modal.innerHTML = `<section class="panel adventure-dialog" role="dialog" aria-modal="true" aria-label="Đấu trường"><button class="modal-close" data-chess-close aria-label="Đóng">×</button>${source.innerHTML}</section>`;
      app.append(modal);
      modal.addEventListener("click", (event) => {
        if (
          event.target === modal ||
          event.target.closest("[data-chess-close]")
        ) {
          runtime.chessPanel = null;
          renderChess();
        }
      });
    }
  }
  app.querySelectorAll("[data-chess-panel]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.chessPanel = button.dataset.chessPanel;
      renderChess();
    }),
  );
  app
    .querySelectorAll("[data-buy]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        updateChess(() =>
          buyChessOffer(runtime.chess, Number(button.dataset.buy)),
        ),
      ),
    );
  app.querySelectorAll("[data-bench]").forEach((button) =>
    button.addEventListener("click", () => {
      if (runtime.suppressClick) return;
      runtime.selectedBench = Number(button.dataset.bench);
      runtime.selectedBoard = null;
      renderChess();
    }),
  );
  app.querySelectorAll("[data-cell]").forEach((button) =>
    button.addEventListener("click", () => {
      if (!runtime.suppressClick) onChessCell(button.dataset.cell);
    }),
  );
  app
    .querySelector("[data-chess-refresh]")
    ?.addEventListener("click", () =>
      updateChess(() => refreshChessShop(runtime.chess)),
    );
  app
    .querySelector("[data-chess-lock]")
    ?.addEventListener("click", () =>
      updateChess(() => toggleChessLock(runtime.chess)),
    );
  app
    .querySelector("[data-chess-xp]")
    ?.addEventListener("click", () =>
      updateChess(() => buyChessExperience(runtime.chess)),
    );
  app
    .querySelector("[data-chess-bench]")
    ?.addEventListener("click", () =>
      updateChess(() => benchChessUnit(runtime.chess, runtime.selectedBoard)),
    );
  app
    .querySelector("[data-chess-sell]")
    ?.addEventListener("click", () =>
      updateChess(() =>
        sellChessUnit(
          runtime.chess,
          runtime.selectedBench !== null ? "bench" : "board",
          runtime.selectedBench ?? runtime.selectedBoard,
        ),
      ),
    );
  app
    .querySelectorAll("[data-equip]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        updateChess(() =>
          equipChessItem(
            runtime.chess,
            runtime.selectedBench !== null ? "bench" : "board",
            runtime.selectedBench ?? runtime.selectedBoard,
            Number(button.dataset.equip),
          ),
        ),
      ),
    );
  app.querySelector("[data-chess-fight]")?.addEventListener("click", () => {
    try {
      runtime.chess = startChessCombat(runtime.chess);
      runtime.chessPlayback = {
        playing: !runtime.save.settings.reducedMotion,
        tick: 0,
        eventIndex: 0,
      };
      runtime.notice = "";
      runtime.effects.clear();
      runtime.audio.setTrack(
        trackForContext("chess", runtime.chess.combat.roundType === "elite"),
      );
      saveNow();
      renderChess();
    } catch (error) {
      runtime.notice = error.message;
      renderChess();
    }
  });
  app.querySelector("[data-chess-next]")?.addEventListener("click", () => {
    runtime.chessPlayback = null;
    updateChess(() => advanceChessRound(runtime.chess));
  });
  app.querySelector("[data-chess-skip]")?.addEventListener("click", () => {
    runtime.chessPlayback.playing = false;
    runtime.audio.setTrack("chess");
    renderChess();
  });
  app.querySelector("[data-chess-surrender]")?.addEventListener("click", () => {
    runtime.chessPlayback = null;
    updateChess(() => surrenderChess(runtime.chess));
  });
  app.querySelector("[data-chess-new]")?.addEventListener("click", () => {
    runtime.chessPlayback = null;
    runtime.selectedBench = null;
    runtime.selectedBoard = null;
    updateChess(() =>
      createChessRun(runtime.units, runtime.shopConfig, Date.now() % 999983),
    );
  });
  app.querySelector("[data-arena]")?.addEventListener("change", (event) => {
    runtime.chess.arena = event.target.value;
    saveNow();
    renderChess();
  });
  app.querySelectorAll("[data-scout]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.scoutId = Number(button.dataset.scout);
      renderChess();
    }),
  );
  saveNow();
}
function onChessCell(coordinates) {
  const [x, y] = coordinates.split(",").map(Number);
  if (runtime.selectedBench !== null)
    return updateChess(() =>
      placeChessUnit(runtime.chess, runtime.selectedBench, x, y),
    );
  if (runtime.selectedBoard !== null)
    return updateChess(() =>
      moveChessUnit(runtime.chess, runtime.selectedBoard, x, y),
    );
  const index = runtime.chess.board.findIndex(
    (unit) => unit.x === x && unit.y === y,
  );
  if (index >= 0) {
    runtime.selectedBoard = index;
    renderChess();
  }
}
function updateChess(action) {
  try {
    runtime.chess = action();
    runtime.notice = "";
    runtime.selectedBench = null;
    runtime.selectedBoard = null;
    saveNow();
  } catch (error) {
    runtime.notice = error.message;
  }
  renderChess();
}
function drawChessFrame(delta) {
  const canvas = app.querySelector("#chess-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const combat = runtime.chess.combat;
  if (!combat) return;
  const playback = runtime.chessPlayback;
  if (playback?.playing) {
    playback.tick += delta * 30 * PRESENTATION.combatSpeed;
    if (playback.tick >= combat.tick) {
      playback.playing = false;
      runtime.audio.setTrack("chess");
      renderChess();
      return;
    }
  }
  const tick = playback?.playing ? playback.tick : combat.tick;
  const frames = combat.frames;
  let next = frames.findIndex((frame) => frame.tick >= tick);
  if (next < 0) next = frames.length - 1;
  const first = frames[Math.max(0, next - 1)],
    second = frames[next];
  const t =
    second.tick === first.tick
      ? 1
      : (tick - first.tick) / (second.tick - first.tick);
  const gradient = ctx.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, "#203e43");
  gradient.addColorStop(1, "#8d7650");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = "#c6aa6b33";
  ctx.beginPath();
  ctx.ellipse(480, 290, 420, 210, 0, 0, Math.PI * 2);
  ctx.fill();
  runtime.positions.clear();
  for (const actor of second.actors) {
    const before =
      first.actors.find((unit) => unit.actorId === actor.actorId) ?? actor;
    const x =
      160 + (before.x + (actor.x - before.x) * t) * 88 + (actor.y % 2) * 36;
    const y = 475 - (before.y + (actor.y - before.y) * t) * 50;
    runtime.positions.set(actor.actorId, { x, y });
    const moving = before.x !== actor.x || before.y !== actor.y;
    const recent = combat.events.findLast(
      (event) =>
        event.source_id === actor.actorId &&
        event.tick <= tick &&
        ["attack_started", "hit_resolved", "heal_resolved"].includes(
          event.type,
        ),
    );
    const acting = recent && tick - recent.tick < 20;
    const clip =
      actor.hp <= 0
        ? "defeat"
        : moving
          ? "walk"
          : acting
            ? recent.type === "heal_resolved" ||
              recent.payload.source_kind === "skill"
              ? "skill_01"
              : "attack_a"
            : "idle";
    const manifest = spriteRenderer.sheets.get(actor.id)?.manifest;
    const fps = manifest?.clips?.[clip]?.fps ?? 4;
    const frameIndex =
      Math.floor(
        ((acting ? tick - recent.tick : tick) / 30) *
          fps *
          (acting ? PRESENTATION.combatSpeed : 1),
      ) % (manifest?.clips?.[clip]?.directions?.S?.frames.length ?? 4);
    const snapshot = { requestedClipId: clip, frameIndex, anchor: [0.5, 0.9] };
    drawActor(
      ctx,
      { ...actor, actor_id: actor.actorId, alive: actor.hp > 0 },
      x,
      y,
      elementColors[actor.element] ?? "#c99b6b",
      snapshot,
    );
  }
  if (playback?.playing)
    while (
      playback.eventIndex < combat.events.length &&
      combat.events[playback.eventIndex].tick <= tick
    ) {
      const event = combat.events[playback.eventIndex++];
      runtime.effects.add(
        event,
        runtime.positions,
        performance.now(),
        runtime.save.settings.reducedMotion,
      );
      if (event.type === "hit_resolved") runtime.audio.effect("hit");
    }
  runtime.effects.draw(ctx);
  ctx.fillStyle = "#fff3d5";
  ctx.font = "bold 18px system-ui";
  ctx.fillText(`VÒNG ${runtime.chess.round} · ${combat.opponentName}`, 22, 30);
}

function renderRoster() {
  shell(
    `${pageHeader("Bộ sưu tập Vị Linh", "Đồng hành cùng bạn", "Nguyên liệu Adventure dùng nâng cấp tại đây. TCG và Auto Chess có chỉ số riêng.")}<section class="roster-grid">${runtime.save.roster.map((actor) => `<article class="roster-card"><img class="roster-portrait" src="./assets/portraits/${actor.id}.png" alt="${escapeAttr(characterNames[actor.id])}"><div><div class="eyebrow">${ELEMENTS[actor.element]} · ${ROLES[actor.role]} · Cấp ${actor.level ?? 1}</div><h2>${escapeHtml(characterNames[actor.id])}</h2><p>${escapeHtml(CHARACTERS[actor.id]?.story)}</p><div class="data-list"><div class="data-row"><span>HP</span><b>${actor.hp}/${actor.maxHp}</b></div><div class="data-row"><span>ATK / DEF</span><b>${actor.atk} / ${actor.def}</b></div></div><button class="button light full" data-upgrade="${actor.id}" ${runtime.adventure.battle ? "disabled" : ""}>Nâng cấp · 45 ◈ + 8 ✦ + 3 rau thơm</button></div></article>`).join("")}</section>`,
  );
  app.querySelectorAll("[data-upgrade]").forEach((button) =>
    button.addEventListener("click", () => {
      try {
        runtime.save = upgradeAdventureCharacter(
          runtime.save,
          button.dataset.upgrade,
        );
        runtime.notice = "Vị Linh đã mạnh hơn và hồi đầy HP.";
        saveNow();
      } catch (error) {
        runtime.notice = error.message;
      }
      renderRoster();
    }),
  );
}

function renderSettings() {
  const settings = runtime.save.settings;
  shell(
    `${pageHeader("Thiết bị này · save local", "Cài đặt", "Nhạc riêng từng chế độ, nhạc boss dùng chung và lưu tiến trình trên thiết bị.", "home")}<section class="settings-list panel">${[
      ["music", "Nhạc"],
      ["sfx", "Hiệu ứng"],
    ]
      .map(
        ([key, label]) =>
          `<label class="setting-row"><span>${label}</span><input type="range" min="0" max="100" value="${settings[key]}" data-setting="${key}"><b>${settings[key]}%</b></label>`,
      )
      .join(
        "",
      )}<label class="setting-row"><span>Giảm chuyển động</span><input type="checkbox" data-setting-motion ${settings.reducedMotion ? "checked" : ""}><b>${settings.reducedMotion ? "Bật" : "Tắt"}</b></label><label class="setting-row"><span>Tự dùng tuyệt kỹ</span><input type="checkbox" data-auto-ultimate ${settings.autoUltimate ? "checked" : ""}><b>Adventure</b></label><div class="action-row"><button class="button light" data-install>Cài ứng dụng</button><button class="button light" data-export-save>Xuất tiến trình</button><label class="button light">Nhập tiến trình<input type="file" data-import-save accept="application/json" hidden></label><button class="button danger" data-reset-save>Khởi tạo lại tiến trình</button></div></section>`,
  );
  app.querySelectorAll("[data-setting]").forEach((input) =>
    input.addEventListener("input", () => {
      runtime.save.settings[input.dataset.setting] = Number(input.value);
      input.nextElementSibling.textContent = `${input.value}%`;
      runtime.audio.applySettings(runtime.save.settings);
      saveNow();
    }),
  );
  app
    .querySelector("[data-setting-motion]")
    ?.addEventListener("change", (event) => {
      runtime.save.settings.reducedMotion = event.target.checked;
      runtime.animations.setReducedMotion(event.target.checked);
      saveNow();
      renderSettings();
    });
  app
    .querySelector("[data-auto-ultimate]")
    ?.addEventListener("change", (event) => {
      runtime.save.settings.autoUltimate = event.target.checked;
      saveNow();
    });
  app.querySelector("[data-install]")?.addEventListener("click", async () => {
    if (runtime.installPrompt) {
      await runtime.installPrompt.prompt();
      runtime.installPrompt = null;
    } else {
      runtime.notice =
        "Trên iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính. Trên Android/desktop: chọn Cài ứng dụng trong menu trình duyệt.";
      renderSettings();
    }
  });
  app.querySelector("[data-export-save]")?.addEventListener("click", () => {
    saveNow();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(runtime.save, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "soul-of-meal-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  app
    .querySelector("[data-import-save]")
    ?.addEventListener("change", async (event) => {
      try {
        const data = JSON.parse(await event.target.files[0].text());
        if (
          data.version !== 3 ||
          !Array.isArray(data.roster) ||
          !Array.isArray(data.adventure?.rewardClaims)
        )
          throw new Error("Bản sao tiến trình không hợp lệ.");
        const restored = migrateSave(data);
        if (!persistSave(restored))
          throw new Error("Không thể lưu bản nhập trên thiết bị này.");
        location.reload();
      } catch (error) {
        runtime.notice = error.message;
        renderSettings();
      }
    });
  app.querySelector("[data-reset-save]")?.addEventListener("click", () => {
    if (!confirm("Xóa tiến trình đã lưu trên thiết bị này?")) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem("soul-of-meal.save.v2");
    localStorage.removeItem("soul-of-meal.save.v1");
    window.location.reload();
  });
}

function render() {
  if (runtime.page === "home") return renderHome();
  if (runtime.page === "adventure") return renderAdventure();
  if (runtime.page === "tcg") return renderTcg();
  if (runtime.page === "chess") return renderChess();
  if (runtime.page === "roster") return renderRoster();
  if (runtime.page === "deck") return renderDeck();
  if (runtime.page === "settings") return renderSettings();
  runtime.page = "home";
  renderHome();
}

function cardName(card) {
  return (
    card.display_name?.replace("Soul of Meal Sample", "Lá chiến thuật") ??
    card.card_id
  );
}
function shortName(name = "") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}
function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
function escapeAttr(value = "") {
  return escapeHtml(value);
}

window.addEventListener("keydown", (event) => {
  if (event.target.closest?.("input,textarea,select,[contenteditable]")) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "w",
      "a",
      "s",
      "d",
    ].includes(key) &&
    runtime.page === "adventure"
  ) {
    runtime.heldKeys.add(key);
    event.preventDefault();
  }
  if (
    (key === "e" || key === "Enter") &&
    runtime.page === "adventure" &&
    !runtime.adventure.battle
  )
    doAdventureInteract();
});
window.addEventListener("keyup", (event) =>
  runtime.heldKeys.delete(
    event.key.length === 1 ? event.key.toLowerCase() : event.key,
  ),
);
window.addEventListener("blur", () => {
  runtime.heldKeys.clear();
  runtime.adventure.joystickActive = false;
  runtime.adventure.manualInput = false;
  setAdventureInput(runtime.adventure, 0, 0);
});
window.addEventListener("beforeunload", saveNow);
app.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-combat-hud]")) runtime.hudPointerDown = true;
});
window.addEventListener("pointerup", () => {
  runtime.hudPointerDown = false;
});
window.addEventListener("pointercancel", () => {
  runtime.hudPointerDown = false;
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  runtime.installPrompt = event;
});
window.addEventListener("pointerdown", () => runtime.audio.unlock(), {
  once: true,
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveNow();
    runtime.audio.context?.suspend();
  } else if (runtime.audio.context) runtime.audio.unlock();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    runtime.overlay = null;
    runtime.selectedCard = null;
    runtime.adventure.puzzle = null;
    render();
  }
});

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (runtime.cards && !document.hidden) {
    if (runtime.page === "adventure") drawAdventureFrame(delta);
    if (runtime.page === "chess") drawChessFrame(delta);
    if (
      runtime.page === "tcg" &&
      runtime.tcg &&
      !runtime.selectedCard &&
      now - runtime.lastBotAction >
        PRESENTATION.botActionMs / PRESENTATION.combatSpeed
    ) {
      runtime.lastBotAction = now;
      try {
        const next = stepTcgBot(runtime.tcg);
        if (next !== runtime.tcg) {
          runtime.tcg = next;
          saveNow();
          renderTcg();
        }
      } catch (error) {
        runtime.notice = error.message;
        renderTcg();
      }
    }
    const combo = document.querySelector(".combo-banner");
    if (combo && now > runtime.comboBannerUntil) combo.remove();
    if (runtime.comboBannerUntil > now && !combo) {
      const banner = document.createElement("div");
      banner.className = "combo-banner";
      banner.textContent = "HỎA + THỦY + MỘC · HƯƠNG VỊ BÙNG NỔ";
      app.append(banner);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

try {
  await loadContent();
  render();
  saveNow();
  initPwa();
} catch (error) {
  app.innerHTML = `<main class="error-screen"><div class="eyebrow">Không thể khởi tạo game</div><h1>Dữ liệu chưa tải được</h1><p>${escapeHtml(error.message)}</p><p>Hãy chạy client từ server ở package root để các catalog trong <code>examples/</code> khả dụng.</p><button class="button" onclick="location.reload()">Thử lại</button></main>`;
}
async function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    const wait = (worker) => {
      runtime.updateWaiting = worker;
      render();
    };
    if (registration.waiting) wait(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          wait(worker);
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (runtime.updateWaiting) location.reload();
    });
  } catch (error) {
    console.warn("Offline cache unavailable", error);
  }
}

let drag = null;
app.addEventListener("pointerdown", (event) => {
  if (runtime.page !== "chess" || runtime.chess?.phase !== "prepare") return;
  const tile = event.target.closest("[data-bench],[data-cell]");
  if (!tile) return;
  const zone = tile.dataset.bench !== undefined ? "bench" : "board";
  const index =
    zone === "bench"
      ? Number(tile.dataset.bench)
      : runtime.chess.board.findIndex(
          (unit) => `${unit.x},${unit.y}` === tile.dataset.cell,
        );
  if (index < 0) return;
  drag = {
    zone,
    index,
    startX: event.clientX,
    startY: event.clientY,
    tile,
    active: false,
    pointerId: event.pointerId,
  };
});
window.addEventListener(
  "pointermove",
  (event) => {
    if (!drag) return;
    if (
      !drag.active &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8
    ) {
      drag.active = true;
      drag.ghost = drag.tile.cloneNode(true);
      drag.ghost.className = "drag-ghost";
      document.body.append(drag.ghost);
    }
    if (drag.active) {
      event.preventDefault();
      drag.ghost.style.left = `${event.clientX - 28}px`;
      drag.ghost.style.top = `${event.clientY - 28}px`;
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-cell],[data-bench-drop]");
      drag.ghost.classList.toggle("invalid-drop", !hit);
    }
  },
  { passive: false },
);
window.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const ended = drag;
  drag = null;
  if (!ended.active) return;
  ended.ghost.remove();
  runtime.suppressClick = true;
  setTimeout(() => {
    runtime.suppressClick = false;
  }, 100);
  const hit = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-cell],[data-bench-drop]");
  if (hit?.dataset.cell) {
    const [x, y] = hit.dataset.cell.split(",").map(Number);
    updateChess(() =>
      ended.zone === "bench"
        ? placeChessUnit(runtime.chess, ended.index, x, y)
        : moveChessUnit(runtime.chess, ended.index, x, y),
    );
  } else if (hit && ended.zone === "board")
    updateChess(() => benchChessUnit(runtime.chess, ended.index));
  else {
    runtime.notice = "Vị trí không hợp lệ. Quân được giữ ở chỗ cũ.";
    renderChess();
  }
});
window.addEventListener("pointercancel", () => {
  drag?.ghost?.remove();
  drag = null;
});
