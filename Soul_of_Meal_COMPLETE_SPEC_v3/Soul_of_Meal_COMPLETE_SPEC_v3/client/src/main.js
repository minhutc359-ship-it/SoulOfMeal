import { createAdventureState, interactAdventure, nearestInteraction, setAdventureInput, stepAdventure, activateUltimate, beginBattle, bossTelegraphTargets, focusBossStove, claimBattleResult, WORLD, resolveCameraViewport } from './modes/adventure.js';
import { createTcgMatch, playTcgCard, passTcgPriority, runBotPriority, runTcgBot, attackTcg, assignTcgBlockers, declaredTcgAttackers, endTcgTurn, mulliganTcg, validateDeck } from './modes/tcg.js';
import { advanceChessRound, buyChessOffer, createChessRun, moveChessUnit, placeChessUnit, refreshChessShop, sellChessUnit, startChessCombat, toggleChessLock, buyChessExperience, chessTraits, CHESS_TRAITS } from './modes/autoChess.js';
import { gameEvents } from './core/events.js';
import { loadSave, migrateSave, persistSave, SAVE_KEY } from './core/save.js';
import { AnimationAdapter } from './render/animationAdapter.js';
import { findAdventurePath } from './modes/adventureNavigation.js';
import { createAdventureMapRegistry, getAdventureMap } from './modes/mapCatalog.js';
import { spriteRenderer } from './render/spriteRenderer.js';
import { actorArt, combatArt, effectArt, HERO_ID, HERO_NAMES as characterNames, originalCardArt, preloadGameAssets, propArt, sceneArt, TRAVEL_HERO } from './render/spriteAssets.js';
import { drawEffectTexture, drawElementEffect } from './render/elementEffects.js';
import { adventureBalance } from './modes/adventureBalance.js';
import { BattleEffects } from './render/battleEffects.js';
import { GameAudio } from './core/audio.js';
import { resolveSoundScene } from './core/soundScenes.js';
import { adventureJournal } from './modes/adventureJournal.js';
import { ChessReplay } from './render/chessReplay.js';
import { renderEntry } from './shell/entry.js';
import { createAccountApi, accountErrorMessage } from './core/accountApi.js';
import { createCloudSave } from './core/cloudSave.js';
import { openAccountDialog } from './shell/accountDialog.js';

const app = document.querySelector('#app');
const stageHost = document.querySelector('#web-stage');
const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let webStage;
const accountApi = import.meta.env?.SOM_ACCOUNTS ? createAccountApi() : null;
const runtime = {
  page: 'title', save: loadSave(), adventure: null, cards: null, deck: null, units: null, maps: null,
  shopConfig: null, tcg: null, chess: null, selectedTarget: 'commander', tcgAttackers: null, selectedBench: null, mulligan: new Set(), deckDraft: null,
  account: null, cloud: null, cloudStatus: 'saved', cloudError: null,
  selectedBoard: null, notice: '', lastSavedLocation: 0, heldKeys: new Set(), tcgImpacts: new Map(),
};
runtime.adventure = createAdventureState(runtime.save);
runtime.tcg = runtime.save.modes.tcg;
runtime.chess = runtime.save.modes.chess;
runtime.effects = new BattleEffects(spriteRenderer);
runtime.audio = new GameAudio(runtime.save.settings);
void runtime.audio.loadSoundtracks();
window.addEventListener('click', () => runtime.audio.unlock(), { capture: true });
window.addEventListener('keydown', () => runtime.audio.unlock(), { once: true, capture: true });
gameEvents.addEventListener('game-event', ({ detail }) => {
  runtime.effects.handle(detail, runtime.adventure.battle);
  if (detail.payload.source_kind !== 'auto_chess_attack') runtime.audio.handle(detail);
  if (detail.type === 'hit_resolved' && detail.rules_version === 'client-tcg-v1') {
    const { element, target_player, target_lane, damage } = detail.payload;
    const prior = runtime.tcgImpacts.get(detail.target_id);
    const sameAction = prior?.matchId === detail.battle_id && prior?.actionSeq === detail.action_seq;
    const impact = {
      element, matchId: detail.battle_id, actionSeq: detail.action_seq,
      damage: (sameAction ? prior.damage : 0) + damage,
      expires: performance.now() + 680,
    };
    runtime.tcgImpacts.set(detail.target_id, impact);
    if (Number.isInteger(target_lane)) runtime.tcgImpacts.set(tcgLaneId(target_player, target_lane), impact);
  }
});

const iconMap = { home: '⌂', adventure: '⌖', tcg: '▤', chess: '▦', roster: '✿', settings: '⚙' };
const elementColors = { fire: '#dd684a', water: '#428eac', wood: '#548d56', light: '#b8923c', shadow: '#75627e' };

const contentFiles = [
  'cards/cards.catalog.json', 'cards/starter_deck.json',
  'auto_chess/units.json', 'auto_chess/shop_odds.json',
  'maps/village.json', 'maps/forest.json',
];

async function loadContent(report) {
  let loaded = 0;
  const signal = AbortSignal.timeout(15000);
  const message = 'Đang tải dữ liệu hành trình…';
  report(0, message);
  const [cards, deck, unitsData, shopConfig, villageMap, forestMap] = await Promise.all(
    contentFiles.map(async (file) => {
      const response = await fetch('../examples/' + file, { signal });
      const data = await checkResponse(response).json();
      loaded += 1;
      report(Math.round(loaded / contentFiles.length * 70), message);
      return data;
    })
  );
  report(75, 'Đang chuẩn bị Vị Linh và bản đồ…');
  runtime.cards = cards;
  runtime.deck = deck;
  runtime.units = unitsData.units;
  runtime.shopConfig = shopConfig;
  runtime.maps = createAdventureMapRegistry([villageMap, forestMap]);
  const manifests = await preloadGameAssets(spriteRenderer);
  runtime.animations = new AnimationAdapter({
    eventTarget: gameEvents, manifests, reducedMotion: runtime.save.settings.reducedMotion,
  });
  window.soulOfMealAnimation = runtime.animations;
  report(100, 'Sẵn sàng');
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Không tải được dữ liệu game (${response.status}).`);
  return response;
}

function saveNow() {
  runtime.save.adventure.map = runtime.adventure.map;
  runtime.save.adventure.x = runtime.adventure.x;
  runtime.save.adventure.y = runtime.adventure.y;
  runtime.save.modes.tcg = runtime.tcg;
  runtime.save.modes.chess = runtime.chess;
  if (runtime.cloud) runtime.cloud.stage(runtime.save);
  else persistSave(runtime.save);
}

function syncStage() {
  stageHost.dataset.scene = runtime.page;
  webStage?.show(runtime.page);
}

function syncMotion() {
  webStage?.setReducedMotion(runtime.save.settings.reducedMotion || systemMotion.matches);
}

async function enterGame(report) {
  runtime.audio.unlock();
  if (!runtime.animations) await loadContent(report);
  saveNow();
  navigate('home');
}

function replaceProfile(save) {
  runtime.save = save;
  runtime.adventure = createAdventureState(save);
  runtime.tcg = save.modes.tcg;
  runtime.chess = save.modes.chess;
  runtime.chessReplay = null;
  runtime.selectedTarget = 'commander';
  runtime.tcgAttackers = null;
  runtime.selectedBoard = null;
  runtime.selectedBench = null;
  runtime.mulligan.clear();
  runtime.deckDraft = null;
  runtime.tcgImpacts.clear();
  runtime.effects = new BattleEffects(spriteRenderer);
  runtime.animations?.retainActors([]);
  runtime.animations?.setReducedMotion(save.settings.reducedMotion);
  runtime.audio.setSettings(save.settings);
  syncMotion();
}

function applyCloudProfile({ account, practiceSave }) {
  runtime.account = account;
  runtime.cloud = createCloudSave(accountApi, account.id, practiceSave, updateCloudStatus);
  const save = migrateSave(practiceSave.snapshot);
  save.player.name = account.username;
  replaceProfile(save);
  updateCloudStatus('saved');
  if (practiceSave.snapshot === null) saveNow();
}

async function enterAccount(bootstrap, report) {
  runtime.audio.unlock();
  if (!runtime.animations) await loadContent(report);
  applyCloudProfile(bootstrap);
  navigate('home');
}

function updateCloudStatus(state, error) {
  runtime.cloudStatus = state;
  runtime.cloudError = error;
  const status = ({
    pending: 'Chờ lưu', saving: 'Đang lưu', saved: 'Đã lưu',
    error: error?.status === 401 ? 'Hết phiên' : error?.code === 'save_conflict' ? 'Bản lưu mới hơn' : 'Chưa lưu',
  })[state];
  const badge = app.querySelector('.cloud-badge');
  if (badge) {
    badge.textContent = status;
    badge.dataset.state = state;
  }
  const details = app.querySelector('[data-cloud-status]');
  if (details) details.textContent = error ? accountErrorMessage(error) : status;
  const actions = app.querySelectorAll('[data-cloud-action]');
  for (const button of actions) {
    const action = button.dataset.cloudAction;
    if (action === 'logout') continue;
    button.hidden = action !== (error?.code === 'save_conflict' ? 'reload'
      : error?.status === 401 ? 'reauth' : error ? 'retry' : null);
  }
}

async function runCloudAction(action) {
  const cloud = runtime.cloud;
  const account = runtime.account;
  if (action === 'reauth') {
    openAccountDialog(app, accountApi, async () => { await cloud.retry({ reauthenticated: true }); }, account);
    return;
  }
  if (action === 'reload' && !confirm('Tải bản lưu từ máy chủ và bỏ các thay đổi đang chờ trên thiết bị này?')) return;

  const shellElement = app.querySelector('.shell');
  shellElement.inert = true;
  try {
    if (action === 'retry') {
      await cloud.retry();
    } else if (action === 'reload') {
      let bootstrap;
      try {
        bootstrap = await accountApi.bootstrap();
      } catch (error) {
        if (error.status !== 401) throw error;
      }
      if (bootstrap?.account.id === account.id) {
        applyCloudProfile(bootstrap);
        navigate('home');
      } else {
        openAccountDialog(app, accountApi, async (confirmed) => {
          applyCloudProfile(confirmed);
          navigate('home');
        }, account);
      }
    } else if (action === 'logout') {
      if (cloud.dirty() && !await cloud.flush()) return;
      try {
        await accountApi.logout(account.id);
      } catch (error) {
        if (error.status !== 401) throw error;
      }
      runtime.cloud = null;
      runtime.account = null;
      replaceProfile(loadSave());
      navigate('title');
    }
  } catch (error) {
    app.querySelector('[data-cloud-status]')?.replaceChildren(accountErrorMessage(error));
  } finally {
    shellElement.inert = false;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void runtime.cloud?.flush({ keepalive: true });
});
window.addEventListener('beforeunload', event => {
  if (!runtime.cloud?.dirty()) return;
  event.preventDefault();
  event.returnValue = true;
});

function navigate(page) {
  if (runtime.page === 'adventure' && page !== 'adventure') saveNow();
  runtime.heldKeys.clear();
  setAdventureInput(runtime.adventure, 0, 0);
  runtime.page = page;
  runtime.notice = '';
  syncStage();
  render();
  app.querySelector('main h1')?.focus({ preventScroll: true });
}

function navButton(page, label) {
  return `<button class="nav-button" data-page="${page}" ${runtime.page === page ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${iconMap[page]}</span><span>${label}</span></button>`;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    app.querySelector('[data-shell-status]')?.replaceChildren('Trình duyệt chưa cho phép mở toàn màn hình.');
  }
}

function syncFullscreenButton() {
  const button = app.querySelector('[data-fullscreen]');
  if (!button) return;
  const label = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
}

document.addEventListener('fullscreenchange', syncFullscreenButton);

function shell(content) {
  if (runtime.page !== 'settings') runtime.audio.setScene(resolveSoundScene(runtime.page, runtime.adventure));
  const player = runtime.save.player;
  const sameScreen = app.querySelector('.shell')?.dataset.screen === runtime.page;
  const scrollTop = sameScreen ? app.querySelector('.main').scrollTop : 0;
  const gold = escapeHtml(player.gold);
  const essence = escapeHtml(player.essence);
  app.innerHTML = `
    <div class="shell" data-screen="${runtime.page}">
      <header class="game-bar">
        <button class="brand" data-page="home" aria-label="Về sảnh Soul of Meal">SOUL <em>OF</em> MEAL</button>
        <div class="profile-chip"><img class="profile-avatar" src="${actorArt(HERO_ID)}" alt=""><div class="profile-copy">${escapeHtml(player.name)}<small>Cấp ${escapeHtml(player.level)}</small></div></div>
        <div class="game-resources">
          <span title="Vàng" aria-label="${gold} vàng"><i aria-hidden="true">◈</i> ${gold}</span>
          <span title="Tinh hoa" aria-label="${essence} tinh hoa"><i aria-hidden="true">✦</i> ${essence}</span>
        </div>
        ${runtime.cloud ? '<button class="cloud-badge" data-page="settings" title="Trạng thái lưu trên máy chủ"></button>' : ''}
        ${document.fullscreenEnabled ? '<button class="shell-icon" type="button" data-fullscreen>⛶</button>' : ''}
      </header>
      <main class="main">${content}</main>
      <nav class="game-dock" aria-label="Chế độ chơi">
        ${navButton('home', 'Sảnh')}${navButton('adventure', 'Phiêu lưu')}${navButton('tcg', 'Đấu thẻ')}${navButton('chess', 'Đấu cờ')}${navButton('roster', 'Vị Linh')}${navButton('settings', 'Cài đặt')}
      </nav>
      <p class="shell-status" data-shell-status role="status"></p>
    </div>`;
  const viewport = app.querySelector('main');
  viewport.scrollTop = scrollTop;
  const heading = viewport.querySelector('h1');
  if (heading) heading.tabIndex = -1;
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  app.querySelector('[data-fullscreen]')?.addEventListener('click', toggleFullscreen);
  syncFullscreenButton();
  if (runtime.cloud) updateCloudStatus(runtime.cloudStatus, runtime.cloudError);
}

function pageHeader(kicker, title, description, back = 'home') {
  return `<div class="topline"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description ? `<p class="subtitle">${description}</p>` : ''}</div><button class="button light compact" data-page="${back}" aria-label="Quay lại">←</button></div>`;
}

function renderHome() {
  const quest = runtime.save.adventure.quest;
  const headline = ({
    not_started: 'Gặp Lilia ở quảng trường',
    accepted: 'Theo dấu Thất Vị vào rừng',
    ready_to_claim: 'Trở về báo tin cho Lilia',
    completed: 'Trở lại Làng Ẩm Thực',
  })[quest];
  shell(`
    <section class="lobby">
      <div class="lobby-copy">
        <h1>Hành Trình<br>Vị Linh</h1>
        <p>${headline ?? 'Trở lại Làng Ẩm Thực'}</p>
        <button class="entry-action" data-page="adventure">${quest === 'not_started' ? 'Vào làng' : 'Tiếp tục phiêu lưu'} <b aria-hidden="true">›</b></button>
      </div>
      <div class="lobby-modes" role="group" aria-label="Chọn lối chơi">
        <button class="lobby-mode" data-page="tcg"><img src="${originalCardArt('card_demo_10')}" alt=""><span><strong>Thẻ chiến thuật</strong><small>${runtime.tcg && !runtime.tcg.result ? 'Tiếp tục ván đấu' : 'Đấu thẻ với bot'}</small></span><b aria-hidden="true">›</b></button>
        <button class="lobby-mode" data-page="chess"><img src="${sceneArt('arena')}" alt=""><span><strong>Auto Chess</strong><small>${runtime.chess && runtime.chess.phase !== 'finished' ? 'Tiếp tục vòng ' + runtime.chess.round : 'Đấu cờ với bot'}</small></span><b aria-hidden="true">›</b></button>
      </div>
    </section>`);
}

function renderAdventure() {
  const save = runtime.save;
  const adventure = runtime.adventure;
  const battle = adventure.battle;
  const target = nearestInteraction(adventure, save, runtime.maps);
  const questLabel = ({ not_started: 'Chưa nhận', accepted: 'Đang tìm nguyên liệu', ready_to_claim: 'Có thể báo tin', completed: 'Hoàn thành' })[save.adventure.quest];
  const actionLabel = target ? `Tương tác · ${target.label}` : 'Tiến gần điểm tương tác';
  const actorRows = save.roster.map((member, index) => {
    const actor = battle?.actors.find((candidate) => candidate.actor_id === member.id) ?? member;
    const skill = adventureBalance.ultimates[actor.id];
    return `<div class="combatant skill-card" data-actor="${actor.id}">
      <img src="${escapeAttr(actorArt(actor.id))}" alt="">
      <div class="skill-info"><strong>${escapeHtml(characterNames[actor.id])}</strong>
        <div class="meter" aria-label="Sinh lực"><i data-hp style="width:${actor.hp / actor.maxHp * 100}%"></i></div>
        <div class="meter energy" aria-label="Năng lượng"><i data-energy style="width:${actor.energy}%"></i></div>
      </div>
      ${battle ? `<button class="button skill-button" data-ultimate="${actor.id}" title="${escapeAttr(skill.description)}" disabled><span class="key-tag">${index + 1}</span><img class="skill-art" src="${effectArt(actor.element, 'impact')}" alt="">${escapeHtml(skill.name)}<small data-charge>${actor.energy}%</small></button>` : `<small>${escapeHtml(skill.name)}</small>`}
    </div>`;
  }).join('');
  const resultPanel = battle?.phase === 'battle_end' ? `<div class="result-box ${battle.result}"><strong>${battle.result === 'victory' ? 'Chiến thắng' : 'Đội hình đã gục'}</strong><p>${battle.result === 'victory' ? 'Phần thưởng · 60 vàng và 10 tinh hoa' : 'Đội hình có thể vào trận lại.'}</p><button class="button" data-battle-result>${battle.result === 'victory' ? 'Nhận thưởng' : 'Thử lại'}</button></div>` : '';
  const battleControls = battle?.phase === 'battle_running' ? `
    <button class="button light compact" data-battle-pause></button>
    <button class="button light compact" data-battle-speed aria-label="Tăng tốc trận đấu" aria-pressed="false">2×</button>
    <span class="key-hint">1–5 · Tuyệt kỹ</span>` : '';
  const stoveControls = adventureBalance.bossStoves.positions.map((_, index) => `
    <button class="button light stove-button" data-stove="boss_stove_${index + 1}" aria-pressed="false">
      <img src="${propArt('boss_stove')}" alt=""><span><b>${index + 6} · Bếp ${index + 1}</b><small data-stove-hp></small></span>
    </button>`).join('');
  shell(`
    ${pageHeader('Phiêu lưu', adventure.map === 'village' ? 'Làng Ẩm Thực' : 'Rừng Nguyên Liệu', '', 'home')}
    <div class="game-layout adventure-layout"><section class="panel world-panel">
      <div class="canvas-wrap"><canvas id="adventure-canvas" width="960" height="540" aria-label="Bản đồ phiêu lưu tương tác"></canvas>
      <span class="phase-pill world-phase ${battle ? 'combat' : ''}">${battle ? battle.phase === 'battle_end' ? 'Kết quả' : 'Đợt ' + (battle.wave + 1) + '/2' : 'Khám phá'}</span></div>
      <p class="controls-hint" data-adventure-message role="status">${escapeHtml(adventure.lastMessage)}</p>
      <div class="action-row">${battle ? battleControls : `<button class="button" data-interact ${!target ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button><span class="key-hint">WASD / chạm để đi · E để tương tác</span>`}</div>
      ${resultPanel}
    </section>
    <aside class="side-stack">
      ${battle ? `<section class="panel battle-target"><h2 data-enemy-name>Đối thủ</h2><div class="meter enemy"><i data-enemy-hp></i></div>
        <div class="telegraph" data-telegraph hidden><div class="telegraph-heading"><b data-telegraph-name></b><span data-telegraph-seconds></span></div>
          <progress data-telegraph-time aria-label="Thời gian trước đòn boss"></progress>
          <div class="stove-controls" data-stove-controls hidden><p>Phá 2 bếp để hạ hộ thuẫn và ngắt chiêu.</p><div class="stove-buttons">${stoveControls}</div></div>
        </div></section>` : `<section class="panel"><h2>Dấu Vết Thất Vị</h2><div class="data-list"><div class="data-row"><span>Nhiệm vụ</span><strong>${questLabel}</strong></div><div class="data-row"><span>Rương tiếp tế</span><span>${save.adventure.chestOpened ? 'Đã mở' : 'Chưa mở'}</span></div></div><div class="action-row"><button class="button light" data-page="journey">Nhật ký hành trình</button></div></section>`}
      <section class="panel party-panel"><h2>Đội hình Vị Linh</h2><div class="actor-list">${actorRows}</div></section>
    </aside></div>
  `);
  app.querySelector('[data-interact]')?.addEventListener('click', doAdventureInteract);
  app.querySelectorAll('[data-ultimate]').forEach((button) => button.addEventListener('click', () => useUltimate(button.dataset.ultimate)));
  app.querySelectorAll('[data-stove]').forEach(button => button.addEventListener('click', () => selectBossStove(button.dataset.stove)));
  app.querySelector('[data-battle-pause]')?.addEventListener('click', () => {
    battle.paused = !battle.paused;
    updateBattleHud(battle);
  });
  app.querySelector('[data-battle-speed]')?.addEventListener('click', () => {
    battle.speed = battle.speed === 2 ? 1 : 2;
    updateBattleHud(battle);
  });
  app.querySelector('[data-battle-result]')?.addEventListener('click', claimAdventureBattle);
  const canvas = app.querySelector('#adventure-canvas');
  canvas?.addEventListener('pointerdown', onWorldPointer);
  if (battle) updateBattleHud(battle);
}

function renderAdventureJournal() {
  const journal = adventureJournal(runtime.save);
  const statusText = { done: 'Hoàn thành', current: 'Mục tiêu hiện tại', upcoming: 'Sắp tới' };
  shell(`
    ${pageHeader('Phiêu lưu', 'Nhật ký hành trình', '', 'adventure')}
    <section class="panel journey-panel">
      <h2>Dấu Vết Thất Vị</h2>
      <ol class="journey-steps">${journal.labels.map(({ title, status }) =>
        `<li data-step-status="${status}" ${status === 'current' ? 'aria-current="step"' : ''}>
          <strong>${title}</strong><small>${statusText[status]}</small>
        </li>`).join('')}</ol>
      <div class="action-row">
        ${journal.action && !runtime.adventure.battle ? '<button class="button" data-guide-objective>Dẫn đường</button>' : ''}
        <button class="button light" data-page="adventure">Về bản đồ</button>
      </div>
    </section>`);
  app.querySelector('[data-guide-objective]')?.addEventListener('click', () => {
    const map = getAdventureMap(runtime.maps, runtime.adventure.map);
    const objective = map?.interactables.find(item => item.action === journal.action);
    navigate('adventure');
    if (objective) queueWorldPath({ x: objective.x, y: objective.y });
  });
}

function updateBattleHud(battle) {
  for (const card of app.querySelectorAll('[data-actor]')) {
    const actor = battle.actors.find((candidate) => candidate.actor_id === card.dataset.actor);
    if (!actor) continue;
    card.querySelector('[data-hp]').style.width = actor.hp / actor.maxHp * 100 + '%';
    card.querySelector('[data-energy]').style.width = actor.energy + '%';
    const button = card.querySelector('[data-ultimate]');
    button.disabled = battle.paused || !actor.alive || actor.energy < 100 || Boolean(actor.action)
      || actor.ultimateReadyTick > battle.tick || battle.phase !== 'battle_running';
    button.querySelector('[data-charge]').textContent = actor.energy + '%';
    card.classList.toggle('skill-ready', !button.disabled);
  }
  const enemy = battle.actors.find((actor) => actor.boss) ?? battle.actors.find((actor) => actor.team === 'enemy' && actor.alive);
  if (enemy) {
    app.querySelector('[data-enemy-name]').textContent = enemy.name;
    app.querySelector('[data-enemy-hp]').style.width = enemy.hp / enemy.maxHp * 100 + '%';
  }
  const telegraph = app.querySelector('[data-telegraph]');
  telegraph.hidden = !battle.bossTelegraph;
  const stoveControls = app.querySelector('[data-stove-controls]');
  stoveControls.hidden = !battle.stoves.length;
  for (const button of stoveControls.querySelectorAll('[data-stove]')) {
    const stove = battle.stoves.find(target => target.actor_id === button.dataset.stove);
    button.disabled = !stove?.alive;
    button.setAttribute('aria-pressed', String(stove?.actor_id === battle.stoveTargetId));
    const hp = button.querySelector('[data-stove-hp]');
    const label = stove?.alive ? `${stove.hp}/${stove.maxHp} HP` : 'Đã phá';
    if (hp.textContent !== label) hp.textContent = label;
  }
  if (battle.bossTelegraph) {
    const { attack, duration, ticks } = battle.bossTelegraph;
    const name = telegraph.querySelector('[data-telegraph-name]');
    if (name.textContent !== attack) name.textContent = attack;
    const time = telegraph.querySelector('[data-telegraph-time]');
    time.max = duration;
    time.value = ticks;
    const seconds = telegraph.querySelector('[data-telegraph-seconds]');
    const remaining = Math.ceil(ticks / 3) / 10;
    const label = remaining.toLocaleString('vi', { minimumFractionDigits: 1 }) + ' s';
    if (seconds.textContent !== label) seconds.textContent = label;
  }
  const pause = app.querySelector('[data-battle-pause]');
  if (pause) {
    const label = battle.paused ? 'Tiếp tục' : 'Tạm dừng';
    if (pause.textContent !== label) pause.textContent = label;
    app.querySelector('[data-battle-speed]').setAttribute('aria-pressed', String(battle.speed === 2));
    const pill = app.querySelector('.world-phase');
    const phase = battle.paused ? 'Tạm dừng' : `Đợt ${battle.wave + 1}/2`;
    if (pill.textContent !== phase) pill.textContent = phase;
  }
}

function selectBossStove(stoveId) {
  const battle = runtime.adventure.battle;
  if (focusBossStove(battle, stoveId)) updateBattleHud(battle);
}

function doAdventureInteract() {
  const result = interactAdventure(runtime.adventure, runtime.save, runtime.maps);
  runtime.adventure = result.state;
  runtime.save = result.save;
  if (result.changed) saveNow();
  render();
}

function useUltimate(actorId) {
  const result = activateUltimate(runtime.adventure, runtime.save, actorId);
  if (!result.ok) runtime.adventure.lastMessage = result.reason;
  updateBattleHud(runtime.adventure.battle);
}

function claimAdventureBattle() {
  if (runtime.adventure.battle?.result === 'defeat') {
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
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * WORLD.width;
  const y = (event.clientY - rect.top) / rect.height * WORLD.height;
  const battle = runtime.adventure.battle;
  if (battle) {
    const stove = battle.stoves.find(target => target.alive
      && Math.abs(target.x - x) <= 39 && y >= target.y - 73 && y <= target.y + 10);
    if (stove) selectBossStove(stove.actor_id);
    return;
  }
  const map = getAdventureMap(runtime.maps, runtime.adventure.map);
  const action = map?.interactables.find(item => Math.hypot(item.x - x, item.y - y) < 35)?.action;
  canvas.dataset.pathLength = String(queueWorldPath({ x, y }, action));
}

function queueWorldPath(destination, action = null) {
  const adventure = runtime.adventure;
  const path = findAdventurePath(adventure.map, adventure, destination, undefined, runtime.maps);
  if (!path.length) {
    adventure.lastMessage = 'Không tìm được đường đi tới điểm đó.';
    return 0;
  }
  adventure.walkPath = path;
  adventure.walkTarget = destination;
  adventure.tapInteraction = action;
  return path.length;
}

function drawAdventureFrame(deltaSeconds) {
  const canvas = app.querySelector('#adventure-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(960 * ratio)) { canvas.width = Math.round(960 * ratio); canvas.height = Math.round(540 * ratio); }
  context.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
  const adventure = runtime.adventure;
  const camera = resolveCameraViewport(adventure.x, adventure.y, { width: 960, height: 540 }, WORLD.width, WORLD.height);
  const cameraContext = { ...camera };
  if (adventure.walkPath?.length && !adventure.battle && runtime.heldKeys.size === 0) {
    const waypoint = adventure.walkPath[0];
    const dx = waypoint.x - adventure.x; const dy = waypoint.y - adventure.y;
    if (Math.hypot(dx, dy) < 10) {
      adventure.walkPath.shift();
      if (!adventure.walkPath.length) {
        adventure.walkTarget = null;
        setAdventureInput(adventure, 0, 0);
        const action = adventure.tapInteraction;
        adventure.tapInteraction = null;
        if (action && nearestInteraction(adventure, runtime.save, runtime.maps)?.id === action) return doAdventureInteract();
      }
    } else setAdventureInput(adventure, dx, dy);
  }
  if (adventure.battle) setAdventureInput(adventure, 0, 0);
  else if (runtime.heldKeys.size) {
    const x = Number(runtime.heldKeys.has('ArrowRight') || runtime.heldKeys.has('d')) - Number(runtime.heldKeys.has('ArrowLeft') || runtime.heldKeys.has('a'));
    const y = Number(runtime.heldKeys.has('ArrowDown') || runtime.heldKeys.has('s')) - Number(runtime.heldKeys.has('ArrowUp') || runtime.heldKeys.has('w'));
    setAdventureInput(adventure, x, y);
    adventure.walkTarget = null;
    adventure.walkPath = [];
    adventure.tapInteraction = null;
  }
  const previousPhase = adventure.battle?.phase;
  const previousWave = adventure.battle?.wave;
  const oldX = adventure.x;
  const oldY = adventure.y;
  const playbackDelta = adventure.battle?.paused ? 0 : deltaSeconds * (adventure.battle?.speed ?? 1);
  stepAdventure(adventure, runtime.save, playbackDelta, runtime.maps);
  if (!adventure.battle && Math.hypot(adventure.x - oldX, adventure.y - oldY) > .3) {
    runtime.stepSoundTime = (runtime.stepSoundTime ?? 0) + deltaSeconds;
    if (runtime.stepSoundTime >= .34) {
      runtime.stepSoundTime -= .34;
      runtime.audio.play('sfx_footstep');
    }
  }
  syncAdventureAnimations(adventure);
  runtime.animations.advance(playbackDelta * 1000);
  runtime.effects.advance(playbackDelta);
  if (adventure.battle) {
    if (previousPhase !== adventure.battle.phase || previousWave !== adventure.battle.wave) return renderAdventure();
    updateBattleHud(adventure.battle);
  }
  const message = app.querySelector('[data-adventure-message]');
  if (message.textContent !== adventure.lastMessage) message.textContent = adventure.lastMessage;
  const target = nearestInteraction(adventure, runtime.save, runtime.maps);
  const interactButton = app.querySelector('[data-interact]');
  if (interactButton && !adventure.battle) {
    interactButton.disabled = !target;
    interactButton.textContent = target ? `Tương tác · ${target.label}` : 'Tiến gần một điểm tương tác';
  }
  const now = Date.now();
  if (now - runtime.lastSavedLocation > 900 && !adventure.battle
      && (runtime.save.adventure.x !== adventure.x || runtime.save.adventure.y !== adventure.y)) {
    runtime.lastSavedLocation = now;
    saveNow();
  }
  canvas.dataset.worldX = String(Math.round(adventure.x));
  canvas.dataset.worldY = String(Math.round(adventure.y));
  canvas.dataset.simTick = String(adventure.tick);
  canvas.dataset.pathRemaining = String(adventure.walkPath?.length ?? 0);
  const heroAnimation = runtime.animations.getActorState(HERO_ID)?.animation;
  canvas.dataset.animationClip = heroAnimation?.requestedClipId ?? 'idle';
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
    for (const actor of adventure.battle.actors) {
      views.push({ actorId: actor.actor_id, characterId: actor.id, team: actor.team, x: actor.x, y: actor.y, direction: actor.direction, alive: actor.alive, speed: actor.moving ? 1.5 : 0 });
    }
  } else {
    const direction = ({ up: 'N', right: 'E', down: 'S', left: 'W' })[adventure.facing] ?? 'S';
    views.push({ actorId: HERO_ID, characterId: TRAVEL_HERO, team: 'player', x: adventure.x, y: adventure.y, direction, alive: true });
  }

  for (const view of views) {
    runtime.animations.registerActor(view);
    if (adventure.battle?.phase === 'battle_end' && view.alive) continue;
    runtime.animations.syncMotion(view.actorId, {
      x: view.x,
      y: view.y,
      direction: view.direction,
      speed: view.speed ?? (Math.hypot(adventure.input.x, adventure.input.y) > 0 ? 1.5 : 0),
      alive: view.alive,
    });
  }
  runtime.animations.retainActors(views.map((view) => view.actorId));
}

function drawWorldScene(context, adventure, save) {
  const forest = adventure.map === 'forest';
  const map = getAdventureMap(runtime.maps, adventure.map);
  context.fillStyle = forest ? '#466a52' : '#b79864';
  context.fillRect(0, 0, 960, 540);
  spriteRenderer.drawImage(context, sceneArt(forest ? 'forest' : 'village'), 0, 0, 960, 540);
  drawMapVisuals(context, map, save);
  drawPlayer(context, adventure.x, adventure.y, runtime.animations.getActorState(HERO_ID)?.animation);
}

function drawMapVisuals(context, map, save) {
  for (const visual of map?.visuals ?? []) {
    const { x, y } = visual;
    if (visual.kind === 'house') {
      const art = propArt(visual.id.replace('building_', 'house_'));
      drawFitted(context, art, x + visual.width / 2, y + visual.height, visual.width, visual.height);
      const label = ({ building_kitchen: 'NHÀ BẾP', building_guild: 'HỘI QUÁN', building_merchant: 'TIỆM' })[visual.id];
      drawMapLabel(context, label, x + visual.width / 2, y + visual.height + 13);
    } else if (visual.kind === 'table') {
      drawFitted(context, propArt('table'), x + visual.width / 2, y + visual.height, visual.width, visual.height);
    } else if (visual.kind === 'tree') {
      drawFitted(context, propArt('tree'), x, y + 26, 66, 93);
    } else if (visual.kind === 'marker' && visual.id === 'npc_lilia') {
      drawFitted(context, actorArt('npc_lilia'), x, y + 11, 65, 70);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'marker') {
      drawFitted(context, actorArt('mob_mushroom_01'), x, y + 10, 59, 62);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'chest') {
      drawFitted(context, propArt(save.adventure.chestOpened ? 'chest_open' : 'chest_closed'), x, y + 19, 58, 53);
      drawMapLabel(context, 'RƯƠNG', x, y + 33);
    } else if (visual.kind === 'portal') {
      const open = visual.id === 'forest_return_portal' ? save.adventure.forestCleared : save.adventure.chestOpened;
      context.save();
      context.globalAlpha = open ? 1 : .48;
      drawFitted(context, propArt('portal'), x, y + 16, 78, 89);
      context.restore();
      drawMapLabel(context, open ? visual.label : 'KHÓA', x, y + 29);
    }
  }
}

function drawMapLabel(context, label, x, y) {
  context.save();
  context.textAlign = 'center';
  context.font = '700 10px DM Sans, sans-serif';
  context.lineWidth = 3;
  context.strokeStyle = '#193d32';
  context.fillStyle = '#fff6e3';
  context.strokeText(label, x, y);
  context.fillText(label, x, y);
  context.restore();
}

function drawFitted(context, path, x, baseline, width, height) {
  const image = spriteRenderer.images.get(path);
  if (!image?.naturalWidth) return;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  spriteRenderer.drawImage(context, path, x - w / 2, baseline - h, w, h);
}

function drawBattleScene(context, adventure) {
  const battle = adventure.battle;
  context.fillStyle = '#283f33';
  context.fillRect(0, 0, 960, 540);
  spriteRenderer.drawImage(context, sceneArt('arena'), 0, 0, 960, 540);
  const boss = battle.actors.find((actor) => actor.boss && actor.alive);
  if (boss && battle.bossTelegraph) {
    const { ticks, duration } = battle.bossTelegraph;
    const opacity = .46 + .33 * (1 - ticks / duration);
    drawBossWarning(context, boss.x, boss.y + 2, 230, opacity);
    for (const target of bossTelegraphTargets(battle, boss)) {
      drawBossWarning(context, target.x, target.y + 2, 79, opacity);
    }
  }
  for (const actor of [...battle.actors, ...battle.stoves].sort((a, b) => a.y - b.y)) {
    if (actor.stove) {
      if (actor.alive) drawBossStove(context, actor, battle.stoveTargetId === actor.actor_id);
    } else {
      drawActor(context, actor, runtime.animations.getActorState(actor.actor_id)?.animation,
        actor.boss && battle.bossTelegraph?.phase === 2);
    }
  }
  runtime.effects.draw(context, battle, runtime.save.settings.reducedMotion);
}

function drawBossWarning(context, x, y, size, opacity) {
  const options = { x, y, size, opacity };
  if (!drawEffectTexture(context, spriteRenderer, combatArt('boss_warning'), options)) {
    drawElementEffect(context, spriteRenderer, 'fire', 'impact', options);
  }
}

function drawBossStove(context, stove, focused) {
  const { x, y } = stove;
  drawBossWarning(context, x, y, focused ? 116 : 93, focused ? 1 : .55);
  drawFitted(context, propArt('boss_stove'), x, y + 3, 72, 70);
  context.save();
  context.fillStyle = '#291b20';
  context.fillRect(x - 30, y - 81, 60, 7);
  context.fillStyle = focused ? '#ffe292' : '#ff9870';
  context.fillRect(x - 29, y - 80, 58 * stove.hp / stove.maxHp, 5);
  context.font = '800 17px system-ui';
  context.textAlign = 'center';
  context.strokeStyle = '#291b20';
  context.lineWidth = 4;
  const key = stove.actor_id === 'boss_stove_1' ? '6' : '7';
  context.strokeText(key, x, y - 88);
  context.fillText(key, x, y - 88);
  context.restore();
}

function drawActor(context, actor, animation, protectedByStoves) {
  const { x, y } = actor;
  context.save();
  context.globalAlpha = actor.alive ? 1 : .32;
  context.fillStyle = '#101e1c8c';
  context.beginPath();
  context.ellipse(x, y + 2, actor.boss ? 33 : 23, 7, 0, 0, Math.PI * 2);
  context.fill();
  const drawn = spriteRenderer.drawSprite(context, actor.id, animation, x, y, { scale: actor.boss ? 1.04 : .67 });
  if (!drawn) {
    const pose = placeholderPose(animation);
    drawFitted(context, actorArt(actor.id), x, y + pose.offsetY,
      (actor.boss ? 150 : 77) * pose.scaleX, (actor.boss ? 128 : 78) * pose.scaleY);
  }
  if (actor.shield || protectedByStoves) {
    const options = { x, y: y - (protectedByStoves ? 66 : 39), size: protectedByStoves ? 210 : 113, opacity: .72 };
    if (!drawEffectTexture(context, spriteRenderer, combatArt('shield_bubble'), options)) {
      drawElementEffect(context, spriteRenderer, 'light', 'impact', options);
    }
  }
  const barY = y - (actor.boss ? 140 : drawn ? 104 : 89);
  const barWidth = actor.boss ? 94 : 50;
  context.fillStyle = '#182726';
  context.fillRect(x - barWidth / 2, barY, barWidth, 6);
  context.fillStyle = actor.team === 'player' ? '#b4e09c' : '#ff865e';
  context.fillRect(x - barWidth / 2 + 1, barY + 1, (barWidth - 2) * actor.hp / actor.maxHp, 4);
  context.restore();
}

function drawPlayer(context, x, y, animation) {
  if (!spriteRenderer.drawSprite(context, TRAVEL_HERO, animation, x, y, { scale: .55 })) {
    drawFitted(context, actorArt(HERO_ID), x, y, 71, 69);
  }
}

function placeholderPose(animation) {
  const clip = animation?.requestedClipId ?? animation?.clipId ?? 'idle';
  const phase = animation?.frameIndex ?? 0;
  if (clip === 'hit') return { scaleX: 1.13, scaleY: .82, offsetY: 4 };
  if (clip === 'attack_a' || clip === 'attack_b') return { scaleX: 1.12, scaleY: 1.02, offsetY: 0 };
  if (clip === 'skill_01' || clip === 'ultimate_01') return { scaleX: 1.18, scaleY: 1.12, offsetY: -3 };
  if (clip === 'defeat') return { scaleX: .94, scaleY: .7, offsetY: 8 };
  if (clip === 'walk' || clip === 'run') return { scaleX: 1, scaleY: phase % 2 === 0 ? .96 : 1.04, offsetY: phase % 2 === 0 ? 2 : -2 };
  return { scaleX: 1, scaleY: phase % 2 === 0 ? 1 : 1.02, offsetY: phase % 2 === 0 ? 0 : -1 };
}

const CARD_TYPES = { unit: 'Vị Linh', trap: 'Bẫy', fast_spell: 'Tốc chú', slow_spell: 'Chậm chú', burst_spell: 'Tức chú' };
const ELEMENT_NAMES = { fire: 'Hỏa', water: 'Thủy', wood: 'Mộc', light: 'Quang', shadow: 'Ảnh' };
const TCG_PHASES = { action: 'Triển khai', reaction: 'Phản ứng', combat: 'Tấn công', block_assign: 'Chọn quân chặn', round_end: 'Kết thúc lượt' };

function playerDeck() {
  try {
    validateDeck(runtime.save.tcgDeck, runtime.cards);
    return runtime.save.tcgDeck;
  } catch {
    return runtime.deck;
  }
}

function startTcg(seed) {
  runtime.mulligan.clear();
  runtime.selectedTarget = 'commander';
  runtime.tcgAttackers = null;
  return createTcgMatch(runtime.cards, playerDeck(), seed, runtime.deck);
}

function cardArt(card) {
  const entry = card.card_id && runtime.cards.cards.find((candidate) => candidate.card_id === card.card_id);
  return actorArt(card.character_id ?? entry?.character_id)
    ?? originalCardArt(card.card_id)
    ?? effectArt(card.element ?? entry?.element, card.type === 'fast_spell' ? 'trail' : 'impact');
}

function tcgLaneId(player, lane) { return `lane:p${player}:${lane}`; }

function tcgImpact(id) {
  const impact = runtime.tcgImpacts.get(id);
  if (!impact || impact.matchId !== runtime.tcg.battleId || impact.expires <= performance.now()) return '';
  const visual = runtime.save.settings.reducedMotion ? '' : `<img class="tcg-impact" src="${effectArt(impact.element, 'impact')}" alt="">`;
  return `${visual}<span class="tcg-damage ${runtime.save.settings.reducedMotion ? 'static' : ''}" aria-hidden="true">−${impact.damage}</span>`;
}

function renderTcg() {
  if (!runtime.tcg) runtime.tcg = startTcg(41);
  else if (runtime.tcg.priority === 1 && !runtime.tcg.result) runtime.tcg = runTcgBot(runBotPriority(runtime.tcg), { yieldToPlayer: true });
  const match = runtime.tcg;
  for (const [id, impact] of runtime.tcgImpacts) {
    if (impact.matchId !== match.battleId || impact.expires <= performance.now()) runtime.tcgImpacts.delete(id);
  }
  const [user, bot] = match.players;
  const opening = match.mulliganDone === false && match.round === 1 && match.eventSeq === 0;
  const canPlay = !opening && !match.result && ['action', 'reaction'].includes(match.phase) && match.priority === 0;
  const hand = user.hand.map((card) => {
    const affordable = card.cost <= user.mana;
    const playable = canPlay && affordable
      && (match.phase !== 'reaction' || card.type === 'fast_spell')
      && (card.type !== 'unit' || user.units.length < 5)
      && (card.type !== 'trap' || user.traps.length < 2);
    const selected = opening && runtime.mulligan.has(card.instance_id);
    return `<button class="playing-card element-${card.element} ${selected ? 'selected' : ''}" data-card="${escapeAttr(card.instance_id)}" ${opening ? `aria-pressed="${selected}"` : ''} ${opening || playable ? '' : 'disabled'}><span class="card-cost">${card.cost}</span><span class="card-element">${ELEMENT_NAMES[card.element]}</span><div class="card-thumb"><img src="${escapeAttr(cardArt(card))}" alt=""></div><strong>${escapeHtml(cardName(card))}</strong><small>${CARD_TYPES[card.type]}${card.type === 'unit' ? ` · ${card.atk}/${card.max_def}` : card.effect?.kind === 'deal_damage' ? ` · ${card.effect.value} sát thương` : ''}</small></button>`;
  }).join('');
  const phaseLabel = match.result ? match.winner === 0 ? 'Chiến thắng' : match.winner === null ? 'Hòa trận' : 'Thất bại' : TCG_PHASES[match.phase];
  const showCombat = match.phase === 'combat' && match.activePlayer === 0 && !match.result;
  const defending = match.phase === 'block_assign' && match.priority === 0;
  const incoming = declaredTcgAttackers(match);
  const declared = new Set(incoming.map(unit => unit.instance_id));
  const blocked = new Set(match.pendingAttack?.blocks?.map(block => block.blockerId));
  if (showCombat) runtime.tcgAttackers ??= new Set(user.units.filter(unit => unit.ready && unit.current_def > 0).map(unit => unit.instance_id));
  else runtime.tcgAttackers = null;
  const selected = runtime.tcgAttackers?.size ?? 0;
  const stackTop = match.stack.at(-1);
  const trapReveal = match.stack.find((item) => item.kind === 'counter' || item.kind === 'attack_counter');
  if (!bot.units.some((unit) => unit.instance_id === runtime.selectedTarget)) runtime.selectedTarget = 'commander';
  shell(`
    ${pageHeader('Đấu với bot', 'Thẻ chiến thuật', '', 'home')}
    <div class="game-layout tactical-layout"><section class="panel tcg-board">
      <div class="duel-top"><div><strong>Chủ soái đối thủ</strong><small>${bot.deck.length} lá trong bộ bài · ${bot.hand.length} lá trên tay · ${bot.traps.length} bẫy úp</small></div><div class="commander-hp enemy-hp">${bot.hp}<small> / 8000 HP</small>${tcgImpact('commander:p1')}</div></div>
      <div class="unit-row enemy-row">${tcgLanes(bot.units, false, declared, blocked)}</div>
      <div class="stack-strip"><span>Vòng ${match.round} · ${phaseLabel}</span><b>${match.activePlayer === 0 ? 'Lượt của bạn' : 'Lượt đối thủ'}</b><span>${match.priority === 0 ? 'Ưu tiên: bạn' : 'Ưu tiên: đối thủ'}</span></div>
      ${stackTop ? `<p class="tcg-stack-top">Xử lý trước: <strong>${escapeHtml(cardName(stackTop.card))}</strong> · ${match.stack.length} chờ</p>` : ''}
      ${defending ? tcgDefensePanel(incoming, user.units) : ''}
      ${trapReveal ? `<div class="trap-reveal" role="status"><img src="${escapeAttr(cardArt(trapReveal.card))}" alt="">Bẫy lật mở · ${escapeHtml(cardName(trapReveal.card))}</div>` : ''}
      <div class="unit-row friendly-row">${tcgLanes(user.units, true, declared, blocked)}</div>
      <div class="duel-bottom"><div><strong>Người Kết Vị</strong><small>${user.units.length}/5 Vị Linh · ${user.traps.length}/2 bẫy úp</small></div><div class="commander-hp">${user.hp}<small> / 8000 HP</small>${tcgImpact('commander:p0')}</div></div>
      <div class="hand-heading"><strong>${opening ? 'Chọn các lá muốn đổi' : 'Bài trên tay'}</strong><span>${user.mana}/${user.maxMana} mana</span></div>
      <div class="hand-row">${hand || '<p class="empty-message">Không còn bài trên tay.</p>'}</div>
      ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      ${match.result ? `<div class="result-box ${match.winner === 0 ? 'victory' : 'defeat'}"><strong>${phaseLabel}</strong><button class="button" data-tcg-new>Ván mới</button></div>` : opening ? `<div class="action-row"><button class="button" data-tcg-mulligan>${runtime.mulligan.size ? 'Đổi ' + runtime.mulligan.size + ' lá' : 'Giữ bài và vào trận'}</button></div>` : ''}
      ${canPlay ? `<div class="action-row"><label class="target-select">Mục tiêu <select id="tcg-target"><option value="commander">Chủ soái đối thủ</option>${bot.units.map(unit => `<option value="${escapeAttr(unit.instance_id)}" ${runtime.selectedTarget === unit.instance_id ? 'selected' : ''}>${escapeHtml(cardName(unit))}</option>`).join('')}</select></label>
      <button class="button" data-tcg-pass>${match.phase === 'reaction' ? 'Bỏ phản ứng' : 'Bỏ ưu tiên'}</button></div>` : ''}
      ${showCombat ? `<div class="action-row"><button class="button" data-tcg-attack>${selected ? `Tấn công với ${selected} Vị Linh` : 'Bỏ tấn công'}</button>${selected ? '<button class="button light" data-tcg-skip>Bỏ tấn công</button><span class="key-hint">Chạm Vị Linh để chọn đội tấn công</span>' : ''}</div>` : ''}
      ${!match.result && match.phase === 'round_end' && match.activePlayer === 0 ? '<div class="action-row"><button class="button" data-tcg-end>Kết thúc lượt</button></div>' : ''}
    </section><aside class="side-stack"><section class="panel"><h2>Bộ bài</h2><p class="muted-copy">Chỉnh 36 lá cho ván kế tiếp.</p><button class="button light" data-page="deck">Sửa bộ bài</button><button class="button light" data-tcg-restart>Ván mới</button></section><section class="panel"><h2>Nhật ký trận</h2>${renderTextLog(match.log)}</section></aside></div>
  `);
  app.querySelector('#tcg-target')?.addEventListener('change', (event) => { runtime.selectedTarget = event.target.value; });
  app.querySelectorAll('[data-card]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.card;
    if (opening) {
      if (!runtime.mulligan.delete(id)) runtime.mulligan.add(id);
      renderTcg();
      app.querySelector(`[data-card="${CSS.escape(id)}"]`)?.focus();
    } else actTcg(() => playTcgCard(runtime.tcg, 0, id, runtime.selectedTarget));
  }));
  app.querySelector('[data-tcg-mulligan]')?.addEventListener('click', () => {
    actTcg(() => mulliganTcg(runtime.tcg, [...runtime.mulligan]));
    runtime.mulligan.clear();
  });
  app.querySelector('[data-tcg-pass]')?.addEventListener('click', () => actTcg(() => passTcgPriority(runtime.tcg, 0)));
  app.querySelectorAll('[data-tcg-attacker]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.tcgAttacker;
    if (!runtime.tcgAttackers.delete(id)) runtime.tcgAttackers.add(id);
    renderTcg();
    app.querySelector(`[data-tcg-attacker="${CSS.escape(id)}"]`)?.focus();
  }));
  app.querySelector('[data-tcg-attack]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [...runtime.tcgAttackers])));
  if (defending) bindTcgDefense();
  app.querySelector('[data-tcg-skip]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [])));
  app.querySelector('[data-tcg-end]')?.addEventListener('click', () => actTcg(() => endTcgTurn(runtime.tcg, 0)));
  function restart() {
    runtime.tcg = startTcg(Date.now() % 999_983);
    saveNow();
    render();
  }
  app.querySelector('[data-tcg-new]')?.addEventListener('click', restart);
  app.querySelector('[data-tcg-restart]')?.addEventListener('click', () => {
    if (opening || match.result || confirm('Kết thúc ván hiện tại và bắt đầu ván mới?')) restart();
  });
  saveNow();
}

function actTcg(action) {
  try {
    runtime.tcg = runTcgBot(runBotPriority(action()), { yieldToPlayer: true });
    runtime.notice = '';
    saveNow();
  } catch (error) {
    runtime.notice = error.message;
  }
  render();
}

function tcgLanes(units, friendly, declared, blocked) {
  return Array.from({ length: 5 }, (_, lane) => {
    const unit = units.find((candidate) => candidate.lane === lane);
    if (!unit) return `<div class="empty-slot" aria-label="Vị trí trống">·${tcgImpact(tcgLaneId(friendly ? 0 : 1, lane))}</div>`;
    const selectable = friendly && runtime.tcgAttackers && unit.ready && unit.current_def > 0;
    const selected = selectable && runtime.tcgAttackers.has(unit.instance_id);
    const attacking = declared.has(unit.instance_id);
    const blocking = blocked.has(unit.instance_id);
    const badge = selected || attacking ? 'Tấn công' : blocking ? 'Chặn' : unit.ready ? 'Sẵn sàng' : 'Nghỉ';
    const css = `tcg-unit ${friendly ? 'friendly' : ''} ${selected || attacking ? 'tcg-attacking' : ''} ${blocking ? 'tcg-blocking' : ''}`;
    const content = `<span class="tcg-unit-avatar"><img src="${escapeAttr(cardArt(unit))}" alt=""></span><b>${escapeHtml(cardName(unit))}</b><span>${unit.atk} / ${unit.current_def}</span><small>${badge}</small>${tcgImpact(unit.instance_id)}`;
    return selectable
      ? `<button type="button" class="${css}" data-tcg-attacker="${escapeAttr(unit.instance_id)}" aria-pressed="${selected}">${content}</button>`
      : `<div class="${css}">${content}</div>`;
  }).join('');
}

function tcgDefensePanel(attackers, defenders) {
  const units = defenders.filter(unit => unit.current_def > 0);
  return `<section class="tcg-defense" aria-label="Chọn quân chặn">
    <div class="tcg-defense-header"><strong>Chọn quân chặn</strong><span data-tcg-exposed role="status"></span></div>
    <div class="tcg-block-grid">${attackers.map(unit => `<label>
      <span>Đường ${unit.lane + 1} · ${escapeHtml(cardName(unit))} · ${unit.atk} ATK</span>
      <select data-tcg-block="${unit.lane}" data-damage="${unit.atk}">
        <option value="">Không chặn</option>
        ${units.map(blocker => `<option value="${escapeAttr(blocker.instance_id)}">${escapeHtml(cardName(blocker))} · ${blocker.atk}/${blocker.current_def}</option>`).join('')}
      </select>
    </label>`).join('')}</div>
    <button class="button" data-tcg-confirm-block>Chốt phòng thủ</button>
  </section>`;
}

function bindTcgDefense() {
  const fields = [...app.querySelectorAll('[data-tcg-block]')];
  const exposed = app.querySelector('[data-tcg-exposed]');
  function updateBlocks() {
    const selected = new Set(fields.map(field => field.value).filter(Boolean));
    let damage = 0;
    for (const field of fields) {
      if (!field.value) damage += Number(field.dataset.damage);
      for (const option of field.options) option.disabled = option.value !== field.value && selected.has(option.value);
    }
    exposed.textContent = `Chủ soái dự kiến nhận ${damage} sát thương`;
  }
  fields.forEach(field => field.addEventListener('change', updateBlocks));
  updateBlocks();
  app.querySelector('[data-tcg-confirm-block]').addEventListener('click', () => {
    const blocks = fields.filter(field => field.value)
      .map(field => ({ lane: Number(field.dataset.tcgBlock), blockerId: field.value }));
    actTcg(() => assignTcgBlockers(runtime.tcg, 0, blocks));
  });
}

function renderDeck() {
  runtime.deckDraft ??= Object.fromEntries(playerDeck().cards.map(({ card_id, count }) => [card_id, count]));
  const count = Object.values(runtime.deckDraft).reduce((sum, value) => sum + value, 0);
  shell(`${pageHeader('Thẻ chiến thuật', 'Bộ bài của bạn', 'Chọn 36 lá, tối đa hai bản sao mỗi lá.', 'tcg')}
    <section class="panel deck-editor">
      <div class="action-row"><strong>${count}/36 lá</strong><button class="button" data-deck-save ${count === 36 ? '' : 'disabled'}>Lưu bộ bài</button><button class="button light" data-deck-reset>Dùng bộ khởi đầu</button><button class="button light" data-page="tcg">Về trận đấu</button></div>
      ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      <div class="deck-grid">${runtime.cards.cards.map((card) => {
        const copies = runtime.deckDraft[card.card_id] ?? 0;
        return `<article class="deck-card element-${card.element}"><img src="${escapeAttr(cardArt(card))}" alt=""><div><strong>${escapeHtml(cardName(card))}</strong><small>${CARD_TYPES[card.type]} · ${card.cost} mana</small></div><div class="deck-count"><button class="button light" data-deck-id="${card.card_id}" data-change="-1" aria-label="Bớt ${escapeAttr(cardName(card))}" ${copies === 0 ? 'disabled' : ''}>−</button><b>${copies}</b><button class="button light" data-deck-id="${card.card_id}" data-change="1" aria-label="Thêm ${escapeAttr(cardName(card))}" ${copies === 2 || count >= 36 ? 'disabled' : ''}>+</button></div></article>`;
      }).join('')}</div>
    </section>`);
  app.querySelectorAll('[data-deck-id]').forEach((button) => button.addEventListener('click', () => {
    const { deckId, change } = button.dataset;
    runtime.deckDraft[deckId] = (runtime.deckDraft[deckId] ?? 0) + Number(change);
    renderDeck();
    app.querySelector(`[data-deck-id="${deckId}"][data-change="${change}"]:not(:disabled)`)?.focus();
  }));
  app.querySelector('[data-deck-reset]').addEventListener('click', () => {
    runtime.deckDraft = Object.fromEntries(runtime.deck.cards.map(({ card_id, count: amount }) => [card_id, amount]));
    runtime.notice = '';
    renderDeck();
  });
  app.querySelector('[data-deck-save]').addEventListener('click', () => {
    const deck = { ...runtime.deck, deck_id: 'deck_player', cards: Object.entries(runtime.deckDraft).filter(([, amount]) => amount > 0).map(([card_id, amount]) => ({ card_id, count: amount })) };
    try {
      validateDeck(deck, runtime.cards);
      runtime.save.tcgDeck = deck;
      saveNow();
      runtime.notice = 'Đã lưu. Bộ bài được dùng khi bắt đầu ván mới.';
    } catch (error) { runtime.notice = error.message; }
    renderDeck();
  });
}

function renderTextLog(items) {
  return `<div class="log">${items.slice(0, 12).map((item) => `<p>${escapeHtml(item.text ?? item.type ?? item)}</p>`).join('')}</div>`;
}

function renderChess() {
  if (!runtime.chess) runtime.chess = createChessRun(runtime.units, runtime.shopConfig, 2077);
  const run = runtime.chess;
  const replaying = Boolean(runtime.chessReplay);
  const boardCells = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7; const y = Math.floor(index / 7);
    const unitIndex = run.board.findIndex((unit) => unit.x === x && unit.y === y);
    const unit = run.board[unitIndex];
    return `<button class="chess-cell ${unit ? 'occupied' : ''} ${runtime.selectedBench !== null && !unit ? 'place-target' : ''} ${runtime.selectedBoard === unitIndex && unit ? 'selected' : ''}" data-cell="${x},${y}" ${run.phase === 'prepare' ? '' : 'disabled'} aria-label="Ô ${x + 1}, ${y + 1}${unit ? ', ' + escapeAttr(unit.display_name) : ''}">${unit ? `${chessPortrait(unit)}<small>${unit.star}★</small><b>${unit.hp} HP</b>` : '<span>·</span>'}</button>`;
  }).join('');
  const shop = run.shop.map((unit, index) => unit ? `<button class="shop-unit" data-buy="${index}" ${run.phase !== 'prepare' || run.gold < unit.cost ? 'disabled' : ''}>${chessPortrait(unit)}<small>${ELEMENT_NAMES[unit.element]} · Bậc ${unit.cost}</small><b>${escapeHtml(unit.display_name)}</b><span>◈ ${unit.cost}</span></button>` : `<div class="shop-unit shop-empty"><span>Đã mua</span></div>`).join('');
  const bench = run.bench.map((unit, index) => `<button class="bench-unit ${runtime.selectedBench === index ? 'selected' : ''}" data-bench="${index}">${chessPortrait(unit)}<b>${escapeHtml(unit.display_name)}</b><small>${unit.star}★ · T${unit.cost}</small></button>`).join('') || '<div class="empty-message">Băng ghế trống · mua quân ở cửa hàng bên dưới</div>';
  const result = run.phase === 'finished'
    ? `<div class="result-box ${run.result === 'victory' ? 'victory' : 'defeat'}"><strong>${run.result === 'victory' ? 'Vô địch đấu trường' : 'Run đã kết thúc'}</strong><p>${run.wins} trận thắng · ${run.losses} trận thua · ${run.hp} HP chỉ huy còn lại.</p><button class="button" data-chess-new>Bắt đầu run mới</button></div>`
    : run.result && !replaying ? `<div class="result-box ${run.result.won ? 'victory' : 'defeat'}"><strong>${run.result.won ? 'Chiến thắng' : 'Thất bại'}</strong><p>${run.result.won ? 'Đối thủ mất 12 HP.' : `Mất ${run.result.damage} HP.`} · +${run.result.income} vàng · ${run.result.ticks} tick.</p><button class="button" data-chess-next>Sang vòng tiếp</button>${run.combat?.startActors ? '<button class="button light" data-chess-replay>Xem lại</button>' : ''}</div>` : '';
  shell(`
    ${pageHeader('Đấu với bot · 7 đối thủ', 'Đấu trường linh thú', 'Mua và bố trí quân trong nửa bàn 7×4 của bạn. Mỗi ba bản sao cùng cấp sẽ hợp thể.', 'home')}
    <div class="chess-topbar"><div class="resource">Vòng <b>${run.round}</b> / 10</div><div class="resource">Chỉ huy <b>${run.hp}</b> HP</div><div class="resource">Cấp <b>${run.level}</b></div><div class="resource">Kinh nghiệm <b>${run.experience}/4</b></div><div class="resource">◈ <b>${run.gold}</b></div><div class="resource">${run.wins} thắng · ${run.losses} thua</div></div>
    <div class="game-layout chess-layout"><section class="panel chess-main"><div class="panel-heading"><div><h2>${run.phase === 'prepare' ? 'Sắp xếp đội hình' : replaying ? 'Giao tranh vòng ' + run.round : run.phase === 'finished' ? 'Kết thúc trận' : 'Kết quả vòng ' + run.round}</h2><p>${run.phase === 'prepare' ? `${run.board.length}/${run.level} quân trên bàn · ${run.bench.length}/9 ghế` : 'Các Vị Linh giao tranh theo đội hình đã xếp.'}</p></div><span class="phase-pill ${run.phase !== 'prepare' ? 'combat' : ''}">${({ prepare: 'Chuẩn bị', result: replaying ? 'Giao tranh' : 'Kết quả', finished: 'Kết thúc' })[run.phase] ?? 'Giao tranh'}</span></div>
      ${replaying ? '<canvas class="chess-replay" id="chess-replay" width="760" height="480" aria-label="Giao tranh Auto Chess"></canvas><button class="button light" data-chess-skip>Bỏ qua phát lại</button>' : `<div class="chess-grid" role="group" aria-label="Bàn cờ 7 cột 4 hàng">${boardCells}</div>`}
      ${result}
      <div class="bench-heading"><strong>Băng ghế</strong><span>${run.bench.length}/9</span></div><div class="bench-row">${bench}</div>
      <div class="shop-heading"><strong>Cửa hàng</strong><span>Làm mới 2 vàng · cửa hàng ${run.shopLocked ? 'đã khóa' : 'mở'}</span></div><div class="shop-row">${shop}</div>
      <div class="action-row"><button class="button light" data-chess-refresh ${run.phase !== 'prepare' || run.gold < 2 || run.shopLocked ? 'disabled' : ''}>Làm mới · 2 ◈</button><button class="button light" data-chess-xp ${run.phase !== 'prepare' || run.gold < 4 || run.level >= 9 ? 'disabled' : ''}>Nâng cấp · 4 ◈</button><button class="button light" data-chess-lock ${run.phase !== 'prepare' ? 'disabled' : ''}>${run.shopLocked ? 'Mở khóa' : 'Khóa cửa hàng'}</button><button class="button danger" data-chess-sell ${run.phase !== 'prepare' || (runtime.selectedBench === null && runtime.selectedBoard === null) ? 'disabled' : ''}>Bán quân đã chọn</button><button class="button" data-chess-fight ${run.phase !== 'prepare' || !run.board.length ? 'disabled' : ''}>Khóa đội hình & chiến đấu →</button></div>
      ${runtime.notice ? `<p class="notice">${escapeHtml(runtime.notice)}</p>` : ''}
    </section><aside class="side-stack"><section class="panel"><h2>Hiệp lực</h2>${renderSynergies(run.board)}</section><section class="panel"><h2>Đối thủ kế tiếp</h2><div class="data-list"><div class="data-row"><span>Đội hình</span><span>${run.opponents[(run.round - 1) % run.opponents.length]?.units.length ?? 0} quân</span></div><div class="data-row"><span>Đối thủ còn lại</span><span>${run.opponents.filter((opponent) => opponent.hp > 0).length}/7</span></div><div class="data-row"><span>Payout</span><span>+5 base · interest ≤5</span></div></div><p class="muted-copy">Hiệp lực cần hai Vị Linh khác nhau cùng hệ trên bàn.</p></section><section class="panel"><h2>Nhật ký đấu trường</h2>${renderTextLog(run.log)}</section></aside></div>
  `);
  app.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => updateChess(() => buyChessOffer(runtime.chess, Number(button.dataset.buy)))));
  app.querySelectorAll('[data-bench]').forEach((button) => button.addEventListener('click', () => { runtime.selectedBench = Number(button.dataset.bench); runtime.selectedBoard = null; render(); }));
  app.querySelectorAll('[data-cell]').forEach((button) => button.addEventListener('click', () => onChessCell(button.dataset.cell)));
  app.querySelector('[data-chess-refresh]')?.addEventListener('click', () => updateChess(() => refreshChessShop(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-lock]')?.addEventListener('click', () => updateChess(() => toggleChessLock(runtime.chess)));
  app.querySelector('[data-chess-sell]')?.addEventListener('click', sellSelectedChessUnit);
  app.querySelector('[data-chess-xp]')?.addEventListener('click', () => updateChess(() => buyChessExperience(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-fight]')?.addEventListener('click', () => updateChess(() => {
    const resolved = startChessCombat(runtime.chess);
    startChessReplay(resolved.combat);
    return resolved;
  }));
  app.querySelector('[data-chess-replay]')?.addEventListener('click', () => { startChessReplay(run.combat); renderChess(); });
  app.querySelector('[data-chess-skip]')?.addEventListener('click', () => { runtime.chessReplay = null; renderChess(); });
  app.querySelector('[data-chess-next]')?.addEventListener('click', () => updateChess(() => advanceChessRound(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-new]')?.addEventListener('click', () => {
    runtime.chess = createChessRun(runtime.units, runtime.shopConfig, Date.now() % 999_983);
    runtime.selectedBench = null; runtime.selectedBoard = null; runtime.chessReplay = null; runtime.notice = '';
    saveNow(); render();
  });
  saveNow();
}

function chessPortrait(unit) {
  return `<img class="chess-portrait" src="${escapeAttr(cardArt({ character_id: unit.id }))}" alt="">`;
}

function startChessReplay(combat) {
  runtime.chessReplay = new ChessReplay(combat, spriteRenderer, runtime.save.settings.reducedMotion);
}

function drawChessReplay(delta) {
  const canvas = app.querySelector('#chess-replay');
  if (!canvas || !runtime.chessReplay) return;
  const ended = runtime.chessReplay.advance(delta, (event) => runtime.audio.handle(event));
  runtime.chessReplay.draw(canvas);
  if (ended) {
    runtime.chessReplay = null;
    if (runtime.chess.result?.won) runtime.audio.play('sfx_victory');
    renderChess();
  }
}

function onChessCell(coordinates) {
  const [x, y] = coordinates.split(',').map(Number);
  try {
    if (runtime.selectedBench !== null) runtime.chess = placeChessUnit(runtime.chess, runtime.selectedBench, x, y);
    else if (runtime.selectedBoard !== null) {
      runtime.chess = moveChessUnit(runtime.chess, runtime.selectedBoard, x, y);
      runtime.selectedBoard = null;
    }
    else {
      const index = runtime.chess.board.findIndex((unit) => unit.x === x && unit.y === y);
      if (index >= 0) runtime.selectedBoard = index;
    }
    runtime.selectedBench = null;
    runtime.notice = '';
    saveNow();
  } catch (error) { runtime.notice = error.message; }
  render();
}

function sellSelectedChessUnit() {
  try {
    if (runtime.selectedBench !== null) runtime.chess = sellChessUnit(runtime.chess, 'bench', runtime.selectedBench);
    else if (runtime.selectedBoard !== null) runtime.chess = sellChessUnit(runtime.chess, 'board', runtime.selectedBoard);
    runtime.selectedBench = null; runtime.selectedBoard = null; runtime.notice = '';
    saveNow();
  } catch (error) { runtime.notice = error.message; }
  render();
}

function updateChess(action) {
  try { runtime.chess = action(); runtime.selectedBench = null; runtime.selectedBoard = null; runtime.notice = ''; saveNow(); }
  catch (error) { runtime.notice = error.message; }
  render();
}

function renderSynergies(board) {
  const counts = chessTraits(board);
  return `<div class="synergy-list">${Object.entries(CHESS_TRAITS).map(([element, trait]) => {
    const count = counts.get(element) ?? 0;
    return `<div class="synergy-row ${count >= 2 ? 'active' : ''}"><i class="element-dot" style="background:${elementColors[element]}"></i><div><strong>${trait.name}</strong><small>${trait.detail}</small></div><b>${Math.min(2, count)}/2</b></div>`;
  }).join('')}</div>`;
}

function renderRoster() {
  shell(`${pageHeader('Phiêu lưu', 'Đội hình Vị Linh', 'Chỉ số và tuyệt kỹ của từng Vị Linh.', 'home')}<section class="roster-grid">${runtime.save.roster.map((actor) => `<article class="roster-card"><div class="roster-avatar" style="--unit-color:${elementColors[actor.element]}"><img src="${escapeAttr(actorArt(actor.id))}" alt="${escapeAttr(characterNames[actor.id])}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;"></div><div><div class="eyebrow">${actor.element} · ${actor.role}</div><h2>${escapeHtml(characterNames[actor.id])}</h2><div class="data-list"><div class="data-row"><span>HP</span><b>${actor.hp}/${actor.maxHp}</b></div><div class="data-row"><span>ATK</span><b>${actor.atk}</b></div><div class="data-row"><span>DEF</span><b>${actor.def}</b></div></div></div></article>`).join('')}</section>`);
}

function renderSettings() {
  const settings = runtime.save.settings;
  const guestActions = runtime.cloud ? '' : '<div class="action-row"><button class="button light" data-page="title">Về màn hình bắt đầu</button><button class="button danger" data-reset-save>Khởi tạo lại tiến trình</button></div>';
  const cloudPanel = runtime.cloud ? `<section class="settings-list panel cloud-panel"><h2>Tài khoản ${escapeHtml(runtime.account.username)}</h2><p>Tiến trình luyện tập lưu trên máy chủ.</p><p role="status" data-cloud-status></p><div class="action-row"><button class="button light" data-cloud-action="retry" hidden>Thử lưu lại</button><button class="button light" data-cloud-action="reload" hidden>Tải bản trên máy chủ</button><button class="button light" data-cloud-action="reauth" hidden>Đăng nhập lại</button><button class="button danger" data-cloud-action="logout">Lưu và đăng xuất</button></div></section>` : '';
  shell(`${pageHeader(runtime.cloud ? 'Tài khoản' : 'Thiết bị này', 'Cài đặt', '', 'home')}<section class="settings-list panel">${[['music', 'Nhạc'], ['sfx', 'Hiệu ứng'], ['ambience', 'Môi trường']].map(([key, label]) => `<label class="setting-row"><span>${label}</span><input type="range" min="0" max="100" value="${settings[key]}" data-setting="${key}"><b>${settings[key]}%</b></label>`).join('')}<label class="setting-row"><span>Giảm chuyển động</span><input type="checkbox" data-setting-motion ${settings.reducedMotion ? 'checked' : ''}><b>${settings.reducedMotion ? 'Bật' : 'Tắt'}</b></label>${guestActions}</section>${cloudPanel}`);
  app.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('input', () => { runtime.save.settings[input.dataset.setting] = Number(input.value); input.nextElementSibling.textContent = `${input.value}%`; runtime.audio.setSettings(runtime.save.settings); saveNow(); }));
  app.querySelector('[data-setting-motion]')?.addEventListener('change', (event) => { runtime.save.settings.reducedMotion = event.target.checked; runtime.animations.setReducedMotion(event.target.checked); syncMotion(); saveNow(); renderSettings(); });
  app.querySelector('[data-reset-save]')?.addEventListener('click', () => {
    if (!confirm('Xóa tiến trình đã lưu trên thiết bị này?')) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('soul-of-meal.save.v1');
    window.location.reload();
  });
  app.querySelectorAll('[data-cloud-action]').forEach(button =>
    button.addEventListener('click', () => runCloudAction(button.dataset.cloudAction)));
}

function render() {
  if (runtime.page === 'title') {
    runtime.audio.setScene(resolveSoundScene('title', runtime.adventure));
    return renderEntry(app, enterGame, accountApi
      ? () => openAccountDialog(app, accountApi, enterAccount)
      : null);
  }
  if (runtime.page === 'home') return renderHome();
  if (runtime.page === 'adventure') return renderAdventure();
  if (runtime.page === 'journey') return renderAdventureJournal();
  if (runtime.page === 'tcg') return renderTcg();
  if (runtime.page === 'chess') return renderChess();
  if (runtime.page === 'roster') return renderRoster();
  if (runtime.page === 'deck') return renderDeck();
  if (runtime.page === 'settings') return renderSettings();
  runtime.page = 'home'; renderHome();
}

function cardName(card) {
  return runtime.cards.cards.find((entry) => entry.card_id === card.card_id)?.display_name ?? card.display_name ?? card.card_id;
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function escapeAttr(value = '') { return escapeHtml(value); }

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.target?.matches?.('input, select, textarea')) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key) && runtime.page === 'adventure') {
    runtime.heldKeys.add(key); event.preventDefault();
  }
  if (event.repeat || runtime.page !== 'adventure') return;
  if (key === 'e' && !runtime.adventure.battle) doAdventureInteract();
  if (/^[1-5]$/.test(key) && runtime.adventure.battle) {
    const button = app.querySelectorAll('[data-ultimate]')[Number(key) - 1];
    if (button && !button.disabled) useUltimate(button.dataset.ultimate);
  }
  if (key === '6' || key === '7') selectBossStove('boss_stove_' + (Number(key) - 5));
  if (key === 'p') app.querySelector('[data-battle-pause]')?.click();
});
window.addEventListener('keyup', (event) => runtime.heldKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => runtime.heldKeys.clear());

let lastFrame = 0;
function animate(now) {
  const delta = Math.min(.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  if (runtime.page === 'adventure' && runtime.animations) drawAdventureFrame(delta);
  if (runtime.page === 'chess' && runtime.chessReplay) drawChessReplay(delta);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

if (import.meta.env?.MODE) {
  import('./shell/webStage.ts').then(({ mountWebStage }) => {
    webStage = mountWebStage(stageHost);
    systemMotion.addEventListener('change', syncMotion);
    syncMotion();
    syncStage();
  }).catch((error) => console.warn('Không mở được cảnh Phaser.', error));
}

syncStage();
render();
