import { adventureCheckpoint, createAdventureState, interactAdventure, nearestInteraction, availableAdventureInteractions, purchaseAdventureSupplies, setAdventureInput, stepAdventure, activateUltimate, activateLanternWard, retreatFromTide, activateBossCounter, beginAdventureChallenge, beginBattle, bossTelegraphTargets, focusBossStove, claimBattleResult, leaveAdventureDefeat, WORLD, resolveCameraViewport } from './modes/adventure.js';
import { createTcgMatch, playTcgCard, passTcgPriority, runBotPriority, runTcgBot, attackTcg, assignTcgBlockers, declaredTcgAttackers, endTcgTurn, mulliganTcg, surrenderTcg, validateDeck, tcgCardIssue, tcgEffectText, tcgTableDeck, tcgTableDraft, tcgSpellTargets, strikeTcg, tcgStrikePreview, tcgStrikeTargets, decideTcgTrap, tcgExposedDamage, tcgTrapAnchor, TCG_DIFFICULTIES } from './modes/tcg.js';
import { tcgCanAttack, tcgCanBlock, tcgUnitAttack } from './modes/tcgStrategy.js';
import { tcgCardCost, tcgEffectBadge, tcgRecipeFor, TCG_RECIPES, tcgBoardLimit, tcgTrapLimit, tcgCommanderMax, usesTcgTable, TCG_TABLE_VERSION, TCG_TABLE_DECK_SIZE, TCG_KEYWORDS } from './modes/tcgCards.js';
import { TCG_TRAP_LABELS, tcgAttackLanes, tcgTrapArmed, tcgTrapOptions, tcgTrapRule } from './modes/tcgTraps.js';
import { advanceChessRound, arrangeChessUnit, benchChessUnit, buyChessOffer, chessBenchSlots, chessDropState, createChessRun, nextChessOpponent, refreshChessShop, sellChessUnit, startChessCombat, toggleChessLock, buyChessExperience, canBuyChessOffer, chessRoundInfo, chessStandings, chessXpNeeded, equipChessItem, chessTraits, CHESS_PREPARATION_SECONDS, CHESS_TRAITS } from './modes/autoChess.js';
import { CHESS_ITEMS, chessItemPlacement } from './modes/chessItems.js';
import { gameEvents } from './core/events.js';
import { loadSave, migrateSave, persistSave, SAVE_KEY } from './core/save.js';
import { AnimationAdapter } from './render/animationAdapter.js';
import { findAdventurePath } from './modes/adventureNavigation.js';
import { createAdventureMapRegistry, getAdventureMap } from './modes/mapCatalog.js';
import { spriteRenderer } from './render/spriteRenderer.js';
import { actorArt, chapterArt, combatArt, cutinArt, effectArt, HERO_ID, HERO_NAMES as characterNames, originalCardArt, preloadGameAssets, propArt, sceneArt, TRAVEL_HERO } from './render/spriteAssets.js';
import { drawEffectTexture, drawElementEffect } from './render/elementEffects.js';
import { ADVENTURE_TICK_RATE, adventureBalance, adventureEncounters } from './modes/adventureBalance.js';
import { adventureSpiritStats, canAffordSpiritCost, changeSpiritProgress, MAX_SPIRIT_RANK, SPIRIT_BONDS, SPIRIT_GEAR, SPIRIT_GIFTS, SPIRIT_MEMORIES, SPIRIT_RANKS, spiritProfile } from './modes/spiritProgress.js';
import { BattleEffects } from './render/battleEffects.js';
import { BattleRigClock, loadSpiritRigs } from './render/spiritRig.js';
import { adventureViewport, battleActorPoint, SPIRIT_RIG_SCALE } from './render/adventureStage.js';
import { GameAudio } from './core/audio.js';
import { resolveSoundScene } from './core/soundScenes.js';
import { ADVENTURE_CHALLENGE_TIERS, adventureChallenge, adventureChallenges } from './modes/adventureChallenges.js';
import { adventureJournal } from './modes/adventureJournal.js';
import { ROOM_EXIT, VILLAGE_ROOMS } from './modes/villageRooms.js';
import { adventureChronicle, CHAPTER_DIALOGUES } from './modes/adventureStory.js';
import { bindWorldStick, drawWorldMinimap } from './render/worldHud.js';
import { BOARD_SPRITE, BoardSprites } from './render/boardSprites.js';
import { bindTableDrag, paintTableGhost } from './render/tableDrag.js';
import { TcgCardMotion } from './render/tcgCardMotion.js';
import { DuelEffects } from './render/duelEffects.js';
import { ChessReplay } from './render/chessReplay.js';
import { canvasContext, canvasResolution } from './render/canvasSurface.js';
import { renderEntry } from './shell/entry.js';
import { createAccountApi, accountErrorMessage } from './core/accountApi.js';
import { createCloudSave } from './core/cloudSave.js';
import { activeContentRelease, pinnedContentRelease } from './core/contentRelease.js';
import { openAccountDialog } from './shell/accountDialog.js';
import { openStoryDialog } from './shell/storyDialog.js';

const app = document.querySelector('#app');
const stageHost = document.querySelector('#web-stage');
const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactBattle = window.matchMedia('(max-height: 620px) and (orientation: landscape)');
const portraitBattle = window.matchMedia('(max-width: 760px) and (orientation: portrait)');
let webStage;
const pinnedRelease = pinnedContentRelease(new URL(location.href));
const accountApi = import.meta.env?.SOM_ACCOUNTS ? createAccountApi() : null;
const runtime = {
  page: 'title', save: loadSave(), adventure: null, cards: null, deck: null, units: null, maps: null,
  shopConfig: null, tcg: null, chess: null, selectedTarget: null, selectedSpell: null, tcgAttackers: null, tcgStrike: null, selectedBench: null, mulligan: new Set(),
  deckDrafts: new Map(), deckSlot: null, chessUpgrade: null,
  account: null, cloud: null, cloudStatus: 'saved', cloudError: null, deckFilters: { search: '', type: '', element: '', view: 'all' },
  selectedBoard: null, chessLock: null, chessReplayPaused: false, chessReplaySpeed: 1, notice: '', lastSavedLocation: 0, heldKeys: new Set(), tcgImpacts: new Map(),
  rosterId: HERO_ID, rosterTab: 'info', showMinimap: true, worldStick: null, rigClocks: new Map(), tcgReveal: null, tcgCutIn: null,
};
runtime.adventure = createAdventureState(runtime.save);
runtime.tcg = runtime.save.modes.tcg;
runtime.chess = runtime.save.modes.chess;
runtime.effects = new BattleEffects(spriteRenderer);
const boardSprites = new BoardSprites(spriteRenderer);
const duelEffects = new DuelEffects(spriteRenderer);
const tcgCardMotion = new TcgCardMotion();
runtime.audio = new GameAudio(runtime.save.settings);
void runtime.audio.loadSoundtracks();
window.addEventListener('click', () => runtime.audio.unlock(), { capture: true });
window.addEventListener('keydown', () => runtime.audio.unlock(), { once: true, capture: true });
gameEvents.addEventListener('game-event', ({ detail }) => {
  if (detail.type === 'chess_units_merged' && runtime.page === 'chess') {
    runtime.chessUpgrade = { ...detail.payload, expires: performance.now() + 950 };
  }
  const battle = runtime.adventure.battle;
  const clock = battle && detail.battle_id === battle.id ? runtime.rigClocks.get(detail.source_id) : null;
  const delayedSlash = clock && detail.type === 'attack_started' && !detail.payload.travel_ticks;
  const origin = clock ? handleAdventureRigEvent(detail, battle, clock) : undefined;
  if (!delayedSlash) runtime.effects.handle(detail, battle, origin);
  if (detail.rules_version?.startsWith('client-tcg-') && handleTcgPresentation(detail)) return;
  if (!delayedSlash && detail.payload.source_kind !== 'auto_chess_attack') {
    runtime.audio.handle(detail);
  }
});

function handleTcgPresentation(detail) {
  if (runtime.page !== 'tcg' || detail.battle_id !== runtime.tcg?.battleId) return false;
  const { type, payload, battle_id: matchId, action_seq: actionSeq, source_id: sourceId, target_id: targetId } = detail;
  const { element, target_player, target_lane, defeated, ultimate } = payload;
  const now = performance.now();
  const reduced = app.dataset.motion === 'reduced';
  if (['trap_set', 'trap_revealed', 'card_played', 'unit_summoned'].includes(type) && !payload.revived) {
    const { player_index: owner, slot, card_id: cardId } = payload;
    const set = type === 'trap_set';
    const reveal = type === 'trap_revealed';
    const summon = type === 'unit_summoned';
    const card = set ? owner === 0 && runtime.tcgPlayingCard : runtime.cards.cards.find(entry => entry.card_id === cardId);
    const handId = card?.instance_id ?? (summon ? targetId : payload.instance_id);
    const trap = set || reveal ? `[data-duel-id="${tcgTrapAnchor(owner, slot)}"]` : null;
    const from = reveal ? app.querySelector(trap)
      : (owner === 0 && handId && app.querySelector(`[data-card="${CSS.escape(handId)}"]`))
        || app.querySelector(owner === 1 ? '.duel-top' : '.duel-bottom');
    const to = set ? trap : summon ? `[data-duel-id="${CSS.escape(targetId)}"]` : '.duel-mid';
    const kind = set ? card ? 'set' : 'hidden' : reveal ? 'reveal' : 'place';
    tcgCardMotion.collect(app.querySelector('.duel-field'), { kind, card, art: card && matchCardArt(card), from, to });
  }
  if (type === 'tcg_recipe_resolved') {
    runtime.tcgRecipeFlash = { ...payload, matchId, expires: now + 1450 };
    runtime.audio.handle({ type: 'cast_started', payload: { element } });
    return true;
  }
  if (type === 'trap_set') {
    runtime.audio.play('sfx_ui_confirm');
    return true;
  }
  if (type === 'trap_revealed') {
    runtime.tcgReveal = { ...payload, matchId, expires: now + 1400 };
    runtime.audio.handle({ type: 'spell_launched', payload: { element } });
    return true;
  }
  if (type === 'tcg_ultimate_resolved') {
    runtime.tcgCutIn = { ...payload, matchId, expires: now + (reduced ? 480 : 790) };
    boardSprites.cue(tcgSpriteKey(matchId, sourceId), 'ultimate_01', now, actionSeq, now + (reduced ? 0 : 330));
    runtime.audio.handle({ type: 'cast_started', payload: { element } });
    return true;
  }
  if (type === 'card_played') {
    runtime.audio.handle({ type: 'spell_launched', payload: { element } });
    return true;
  }
  if (type === 'unit_summoned' || type === 'tcg_cards_drawn' || type === 'tcg_trap_disarmed') {
    const label = type === 'tcg_cards_drawn' ? `Rút ${payload.amount} lá`
      : type === 'tcg_trap_disarmed' ? 'Gỡ bẫy' : payload.revived ? 'Hồi sinh' : 'Vào sân';
    runtime.tcgImpacts.set(targetId, { element, matchId, actionSeq, text: label, style: 'support', contact: now, expires: now + 720 });
    runtime.audio.handle(type === 'unit_summoned' ? detail : { type: 'spell_launched', payload: { element } });
    return true;
  }
  const support = type === 'tcg_support_resolved';
  if (type !== 'hit_resolved' && !support) return false;
  const melee = payload.source_kind === 'tcg_combat';
  const clip = ultimate ? 'ultimate_01' : melee ? (actionSeq % 2 === 0 ? 'attack_a' : 'attack_b') : undefined;
  const contact = duelEffects.queue(app.querySelector('.duel-field'), detail, now, reduced, clip);
  if (melee) {
    runtime.audio.handle({ type: 'attack_started', payload: { element, clip_id: clip } });
    if (contact > now) boardSprites.cue(tcgSpriteKey(matchId, sourceId), clip, now, actionSeq, contact);
  }
  if (!support && targetId) boardSprites.cue(tcgSpriteKey(matchId, targetId), defeated ? 'defeat' : 'hit', contact, actionSeq);
  const prior = runtime.tcgImpacts.get(targetId);
  const sameAction = prior?.matchId === matchId && prior?.actionSeq === actionSeq && prior.style === 'damage';
  const damage = (sameAction ? prior.damage ?? 0 : 0) + (payload.hp_damage ?? payload.damage ?? 0);
  const style = support ? payload.kind === 'shield' ? 'shield' : 'support' : damage === 0 && payload.absorbed ? 'guard' : 'damage';
  const oldUnit = defeated && app.querySelector(`[data-duel-id="${CSS.escape(targetId)}"] [data-chibi-id]`);
  const impact = {
    element, matchId, actionSeq, damage, style, contact, expires: contact + 670,
    text: support ? `+${payload.amount} ${payload.label}` : style === 'guard' ? 'Chặn' : null,
    fallen: oldUnit ? { id: oldUnit.dataset.chibiId, direction: oldUnit.dataset.chibiFacing, targetId } : null,
  };
  runtime.tcgImpacts.set(targetId, impact);
  if (Number.isInteger(target_lane)) runtime.tcgImpacts.set(tcgLaneId(target_player, target_lane), impact);
  return true;
}

function handleAdventureRigEvent({ type, payload, source_id }, battle, clock) {
  const strike = type === 'hit_resolved' && !payload.travel_ticks;
  const support = type === 'support_cast_released';
  if (!strike && !support && type !== 'projectile_spawned') return;
  const actor = battle.actors.find(item => item.actor_id === source_id);
  if (!actor || !clock.contact(battle, payload.clip_id)) return;
  const { x, y } = battleActorPoint(actor, 1, battle.bossTelegraph?.safeX);
  const point = clock.rig.effectPoint(payload.clip_id, x, y, actor.direction, SPIRIT_RIG_SCALE,
    app.dataset.motion === 'reduced');
  if (strike) {
    runtime.effects.add('strike', payload.element, .24, { ...point, angle: actor.direction === 'W' ? Math.PI : 0 });
    if (payload.source_kind === 'basic') runtime.audio.handle({ type: 'attack_started', payload });
  } else if (support) {
    runtime.effects.add('cast', payload.element, .36, point);
  }
  return point;
}

const iconMap = { home: '⌂', adventure: '⌖', tcg: '▤', chess: '▦', roster: '✿', settings: '⚙' };
const elementColors = { fire: '#dd684a', water: '#428eac', wood: '#548d56', light: '#b8923c', shadow: '#75627e' };

const contentFiles = [
  'cards/cards.catalog.json', 'cards/starter_deck.json',
  'auto_chess/units.json', 'auto_chess/shop_odds.json',
  'maps/village.json', 'maps/forest.json', 'maps/harbor.json', 'maps/caldera.json', 'maps/sanctum.json',
  ...VILLAGE_ROOMS.map(key => 'maps/' + key + '.json'),
];

async function loadContent(report) {
  let loaded = 0;
  const signal = AbortSignal.timeout(15000);
  const message = 'Đang tải dữ liệu hành trình…';
  report(0, message);
  const [cards, deck, unitsData, shopConfig, ...maps] = await Promise.all(
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
  runtime.maps = createAdventureMapRegistry(maps);
  const [manifests, rigs] = await Promise.all([
    preloadGameAssets(spriteRenderer), loadSpiritRigs(spriteRenderer, signal),
  ]);
  spriteRenderer.rigs = rigs;
  runtime.rigClocks = new Map([...rigs].map(([id, rig]) => [id, new BattleRigClock(rig, ADVENTURE_TICK_RATE)]));
  runtime.animations = new AnimationAdapter({
    eventTarget: gameEvents, manifests, reducedMotion: app.dataset.motion === 'reduced',
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
  runtime.save.adventure.battle = adventureCheckpoint(runtime.adventure.battle);
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
  const reduced = runtime.save.settings.reducedMotion || systemMotion.matches;
  app.dataset.motion = reduced ? 'reduced' : 'full';
  runtime.animations?.setReducedMotion(reduced);
  runtime.chessReplay?.setReducedMotion(reduced);
  webStage?.setReducedMotion(reduced);
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
  runtime.chessLock = null;
  runtime.selectedTarget = null;
  runtime.selectedSpell = null;
  runtime.tcgAttackers = null;
  runtime.tcgStrike = null;
  runtime.tcgRecipeFlash = null;
  tcgCardMotion.clear();
  runtime.selectedBoard = null;
  runtime.selectedBench = null;
  runtime.mulligan.clear();
  runtime.deckDrafts.clear();
  runtime.deckSlot = null;
  runtime.tcgImpacts.clear();
  runtime.tcgReveal = null;
  runtime.tcgCutIn = null;
  boardSprites.clear();
  duelEffects.clear();
  runtime.effects = new BattleEffects(spriteRenderer);
  runtime.animations?.retainActors([]);
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
  if (['adventure', 'chess'].includes(runtime.page) && runtime.page !== page) saveNow();
  runtime.heldKeys.clear();
  runtime.worldStick = null;
  setAdventureInput(runtime.adventure, 0, 0);
  if (runtime.page !== page) {
    boardSprites.clear();
    duelEffects.clear();
    runtime.tcgImpacts.clear();
    runtime.tcgReveal = null;
    runtime.tcgCutIn = null;
    runtime.tcgRecipeFlash = null;
    runtime.tcgStrike = null;
    tcgCardMotion.clear();
  }
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
  const handScroll = sameScreen ? app.querySelector('.hand-row')?.scrollLeft : undefined;
  const previousFocus = document.activeElement;
  const focusKey = sameScreen && app.contains(previousFocus)
    ? ['data-card', 'data-tcg-pass', 'data-tcg-end', 'data-bench', 'data-cell', 'data-buy'].find(key => previousFocus.hasAttribute(key))
    : null;
  const focusValue = focusKey ? previousFocus.getAttribute(focusKey) : null;
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
  const hand = viewport.querySelector('.hand-row');
  if (hand && handScroll !== undefined) hand.scrollLeft = handScroll;
  if (focusKey) app.querySelector(`[${focusKey}="${CSS.escape(focusValue)}"]:not([disabled])`)?.focus({ preventScroll: true });
  if (!sameScreen) viewport.querySelector('.topline')?.classList.add('scene-enter');
  const heading = viewport.querySelector('h1');
  if (heading) heading.tabIndex = -1;
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  app.querySelector('[data-fullscreen]')?.addEventListener('click', toggleFullscreen);
  syncFullscreenButton();
  const menu = viewport.querySelector('.match-menu');
  if (menu) {
    viewport.addEventListener('click', event => {
      if (!menu.contains(event.target)) menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }
  if (runtime.cloud) updateCloudStatus(runtime.cloudStatus, runtime.cloudError);
}

function pageHeader(kicker, title, description, back = 'home') {
  return `<div class="topline"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description ? `<p class="subtitle">${description}</p>` : ''}</div><button class="button light compact" data-page="${back}" aria-label="Quay lại">←</button></div>`;
}

function renderHome() {
  const { quest } = runtime.save.adventure;
  const journal = adventureJournal(runtime.save);
  const headline = journal.completedCampaign ? 'Đã hoàn thành Hành Trình Vị Linh'
    : journal.labels[journal.step]?.title ?? journal.nextChapterLabel ?? 'Trở lại Làng Ẩm Thực';
  shell(`
    <section class="lobby">
      <div class="lobby-copy">
        <h1>Hành Trình<br>Vị Linh</h1>
        <p>${headline}</p>
        <button class="entry-action" data-page="adventure">${quest === 'not_started' ? 'Vào làng' : 'Tiếp tục phiêu lưu'} <b aria-hidden="true">›</b></button>
        ${pinnedRelease ? `<div class="release-update" data-content-update hidden>
          <p role="status">Có bản phát hành khác sẵn sàng.</p>
          <button type="button" class="button light" data-apply-release>Cập nhật</button>
        </div>` : ''}
      </div>
      <div class="lobby-modes" role="group" aria-label="Chọn lối chơi">
        <button class="lobby-mode" data-page="tcg"><img src="${originalCardArt('card_demo_10')}" alt=""><span><strong>Thẻ chiến thuật</strong><small>${runtime.tcg && !runtime.tcg.result ? 'Tiếp tục ván đấu' : 'Đấu thẻ với bot'}</small></span><b aria-hidden="true">›</b></button>
        <button class="lobby-mode" data-page="chess"><img src="${sceneArt('chess_court')}" alt=""><span><strong>Auto Chess</strong><small>${runtime.chess && runtime.chess.phase !== 'finished' ? 'Tiếp tục vòng ' + chessRoundInfo(runtime.chess).label : 'Đấu cờ với bot'}</small></span><b aria-hidden="true">›</b></button>
      </div>
    </section>`);
  void checkForContentUpdate();
}

function openMatches() {
  return [
    runtime.adventure.battle && 'Phiêu lưu',
    runtime.tcg && !runtime.tcg.result && 'Đấu thẻ',
    runtime.chess && runtime.chess.phase !== 'finished' && 'Đấu cờ',
  ].filter(Boolean);
}

async function checkForContentUpdate() {
  const panel = app.querySelector('[data-content-update]');
  if (!pinnedRelease || !panel || panel.dataset.checking) return;
  panel.dataset.checking = 'true';
  try {
    const next = await activeContentRelease(pinnedRelease.root);
    if (!panel.isConnected) return;
    panel.hidden = next.build === pinnedRelease.build;
    if (panel.hidden) return;
    const button = panel.querySelector('[data-apply-release]');
    const pending = openMatches();
    panel.querySelector('[role="status"]').textContent = pending.length
      ? `Có bản cập nhật. Hoàn tất ${pending.join(', ')} để áp dụng.` : 'Có bản cập nhật sẵn sàng.';
    button.disabled = pending.length > 0;
    button.onclick = () => applyContentUpdate(panel, button);
  } catch {
    // A failed release check leaves the current scene usable.
  } finally {
    delete panel.dataset.checking;
  }
}

async function applyContentUpdate(panel, button) {
  if (openMatches().length) return;
  button.disabled = true;
  const status = panel.querySelector('[role="status"]');
  status.textContent = 'Đang kiểm tra bản cập nhật…';
  try {
    const next = await activeContentRelease(pinnedRelease.root);
    if (!panel.isConnected || runtime.page !== 'home') return;
    if (next.build === pinnedRelease.build) {
      panel.hidden = true;
      return;
    }
    saveNow();
    if (runtime.cloud && !await runtime.cloud.flush()) {
      status.textContent = 'Tiến trình chưa được lưu. Kiểm tra tài khoản trong Cài đặt rồi thử lại.';
      return;
    }
    if (panel.isConnected && runtime.page === 'home' && !openMatches().length) location.replace(next.entry);
  } catch {
    status.textContent = 'Chưa tải được bản cập nhật. Hãy thử lại.';
  } finally {
    button.disabled = false;
  }
}

function renderAdventure() {
  const save = runtime.save;
  const adventure = runtime.adventure;
  const battle = adventure.battle;
  const target = nearestInteraction(adventure, save, runtime.maps);
  const journal = adventureJournal(save);
  const guideAction = journal.action ?? journal.nextChapterAction;
  const inRoom = VILLAGE_ROOMS.includes(adventure.map);
  const encounter = adventureEncounters[battle?.encounter ?? 'forest'];
  const challenge = battle?.challengeTier ? adventureChallenge(save, battle.encounter, battle.challengeTier) : null;
  const firstClear = challenge && !save.adventure.challengeRecords[challenge.key];
  const mapTitle = challenge ? challenge.boss.name : getAdventureMap(runtime.maps, adventure.map)?.display_name ?? 'Làng Ẩm Thực';
  runtime.worldStick = null;
  const actionLabel = target ? `Tương tác · ${target.label}` : 'Tiến gần điểm tương tác';
  const actorRows = save.roster.map((member, index) => {
    const actor = battle?.actors.find((candidate) => candidate.actor_id === member.id) ?? adventureSpiritStats(member, spiritProfile(save, member.id));
    const skill = adventureBalance.ultimates[actor.id];
    return `<div class="combatant skill-card" data-actor="${actor.id}" data-primed="${actor.energy >= 100}">
      <button type="button" class="party-avatar" data-profile-id="${escapeAttr(actor.id)}" aria-label="Hồ sơ ${escapeAttr(characterNames[actor.id])}"><img src="${escapeAttr(actorArt(actor.id))}" alt=""></button>
      <div class="skill-info"><strong>${escapeHtml(characterNames[actor.id])}</strong>
        <div class="meter" aria-label="Sinh lực"><i data-hp style="width:${actor.hp / actor.maxHp * 100}%"></i></div>
        <div class="meter energy" aria-label="Năng lượng"><i data-energy style="width:${actor.energy}%"></i></div>
      </div>
      ${battle ? `<button class="button skill-button" data-ultimate="${actor.id}" title="${escapeAttr(skill.description)}" disabled>
        <span class="key-tag" aria-hidden="true">${index + 1}</span><img class="skill-art" src="${effectArt(actor.element, 'impact')}" alt="">
        <span class="skill-name">${escapeHtml(skill.name)}</span><small data-charge>${actor.energy}%</small>
      </button>` : `<small>${escapeHtml(skill.name)}</small>`}
    </div>`;
  }).join('');
  const resultPanel = battle?.phase === 'battle_end' ? `<div class="result-box ${battle.result}">
    <strong>${battle.result === 'victory' ? 'Chiến thắng' : 'Đội hình đã gục'}</strong>
    <p>${battle.result === 'victory'
      ? challenge && !firstClear ? `Thời gian khiêu chiến · ${(battle.tick / ADVENTURE_TICK_RATE).toFixed(1)} giây`
        : `Phần thưởng · ${(challenge ?? encounter.reward).gold} vàng và ${(challenge ?? encounter.reward).essence} tinh hoa`
      : 'Đội hình có thể vào trận lại.'}</p>
    <div class="action-row"><button class="button" data-battle-result>${battle.result === 'victory' ? challenge && !firstClear ? 'Ghi thành tích' : 'Nhận thưởng' : 'Thử lại'}</button>
      ${battle.result === 'defeat' ? '<button class="button light" data-adventure-prepare>Chuẩn bị đội hình</button>' : ''}</div></div>` : '';
  const battleControls = battle?.phase === 'battle_running' ? `
    <button class="button light compact" data-battle-pause></button>
    <button class="button light compact" data-battle-speed aria-label="Tăng tốc trận đấu" aria-pressed="false">2×</button>
    <span class="key-hint">1–5 · Tuyệt kỹ</span>` : '';
  const sequenceOptions = encounter?.phases[2]?.sequence?.options;
  const sequenceButtons = Object.entries(sequenceOptions ?? {}).map(([id, label]) =>
    `<button class="button light compact" type="button" data-boss-counter="${id}">${label}</button>`).join('');
  const stoveControls = adventureBalance.bossStoves.positions.map((_, index) => `
    <button class="button light stove-button" data-stove="boss_stove_${index + 1}" aria-pressed="false">
      <img src="${propArt('boss_stove')}" alt=""><span><b>${index + 6} · Bếp ${index + 1}</b><small data-stove-hp></small></span>
    </button>`).join('');
  const party = `<section class="panel party-panel ${battle ? 'battle-party' : ''}" aria-label="${battle ? 'Tuyệt kỹ đội hình' : 'Đội hình Vị Linh'}">
    ${battle ? '' : '<h2>Đội hình Vị Linh</h2>'}<div class="actor-list">${actorRows}</div></section>`;
  shell(`
    ${pageHeader(challenge ? 'Khiêu chiến · ' + challenge.name : 'Phiêu lưu', escapeHtml(mapTitle), '', 'home')}
    <div class="game-layout adventure-layout ${battle ? 'in-battle' : ''}"><section class="panel world-panel">
      <div class="canvas-wrap"><canvas id="adventure-canvas" width="960" height="540" aria-label="Bản đồ phiêu lưu tương tác"></canvas>
      ${battle ? '' : `<div class="minimap-widget">
        <button class="map-toggle" type="button" data-map-toggle aria-controls="world-minimap" aria-expanded="${runtime.showMinimap}">Bản đồ</button>
        <canvas id="world-minimap" width="180" height="102" aria-hidden="true" ${runtime.showMinimap ? '' : 'hidden'}></canvas>
      </div><div class="world-stick" data-world-stick aria-hidden="true"><i></i></div>`}
      <span class="phase-pill world-phase ${battle ? 'combat' : ''}">${battle ? battle.phase === 'battle_end' ? 'Kết quả' : challenge ? 'Boss · ' + challenge.name : `Đợt ${battle.wave + 1}/${encounter.waves.length}` : 'Khám phá'}</span></div>
      ${battle ? '' : `<p class="controls-hint" data-adventure-message role="status">${escapeHtml(adventure.lastMessage)}</p>
        <div class="action-row"><button class="button" data-interact ${!target ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button><span class="key-hint">WASD hoặc chạm để đi · E để tương tác</span></div>`}
      ${resultPanel}
    </section>
    <aside class="side-stack">
      ${battle ? `<section class="panel battle-target"><h2 data-enemy-name>Đối thủ</h2><div class="meter enemy"><i data-enemy-hp></i></div>
        <p class="controls-hint" data-adventure-message role="status">${escapeHtml(adventure.lastMessage)}</p>
        ${battleControls ? `<div class="action-row battle-controls">${battleControls}</div>` : ''}
        <div class="telegraph" data-telegraph hidden><div class="telegraph-heading"><b data-telegraph-name></b><span data-telegraph-seconds></span></div>
          <progress data-telegraph-time aria-label="Thời gian trước đòn boss"></progress>
          <div class="stove-controls" data-stove-controls hidden><p>Phá 2 bếp để hạ hộ thuẫn và ngắt chiêu.</p><div class="stove-buttons">${stoveControls}</div></div>
          ${sequenceButtons ? `<div class="boss-counter" data-boss-sequence hidden>
            <p data-boss-sequence-progress aria-live="polite"></p><div class="action-row">${sequenceButtons}</div>
          </div>` : ''}
        </div>
        ${battle.encounter === 'seal' && battle.phase === 'battle_running' ? `<div class="ward-controls"><p>Giảm ${encounter.wardReductionBp / 100}% sát thương của một đợt sương.</p>
          <button class="button light" data-lantern-ward type="button" disabled>F · Đèn Giữ Vị</button></div>` : ''}
        ${battle.encounter === 'tide' && battle.phase === 'battle_running' ? `<div class="tide-controls" data-tide-controls hidden>
          <p data-tide-threat></p><button class="button light" data-tide-retreat type="button">R · Lùi về vùng khô</button></div>` : ''}
        </section>` : `<section class="panel"><h2>${journal.title}</h2>
          <p class="quest-objective">${journal.labels[journal.step]?.title ?? journal.nextChapterLabel ?? (journal.completedCampaign ? 'Hành Trình Vị Linh đã hoàn thành' : 'Chương đã hoàn thành')}</p>
          <div class="action-row">${inRoom ? '<button class="button" data-leave-room>Ra quảng trường</button>'
            : guideAction ? '<button class="button" data-guide-objective>Dẫn đường</button>' : ''}
            <button class="button light" data-page="journey">Nhật ký hành trình</button>
            ${adventureChallenges(save).some(item => item.unlocked) ? '<button type="button" class="button light" data-adventure-challenges>Khiêu chiến</button>' : ''}</div>
        </section>`}
      ${battle ? '' : party}
    </aside>${battle ? party : ''}</div>
  `);
  app.querySelector('[data-interact]')?.addEventListener('click', doAdventureInteract);
  app.querySelector('[data-adventure-challenges]')?.addEventListener('click', openAdventureChallenges);
  app.querySelectorAll('[data-profile-id]').forEach(button => button.addEventListener('click', () => {
    runtime.rosterId = button.dataset.profileId;
    runtime.rosterTab = 'info';
    navigate('roster');
  }));
  app.querySelector('[data-guide-objective]')?.addEventListener('click', () => guideToObjective(guideAction));
  app.querySelector('[data-leave-room]')?.addEventListener('click', () => {
    const exit = availableAdventureInteractions(adventure.map, save, runtime.maps).find(item => item.action === ROOM_EXIT);
    if (exit) queueWorldPath(exit, ROOM_EXIT);
  });
  app.querySelector('[data-lantern-ward]')?.addEventListener('click', () => {
    if (activateLanternWard(adventure)) updateBattleHud(battle);
  });
  app.querySelector('[data-tide-retreat]')?.addEventListener('click', () => {
    if (retreatFromTide(adventure)) updateBattleHud(battle);
  });
  app.querySelectorAll('[data-boss-counter]').forEach(button => button.addEventListener('click', () => {
    if (activateBossCounter(adventure, button.dataset.bossCounter)) updateBattleHud(battle);
  }));
  app.querySelectorAll('[data-ultimate]').forEach((button) => button.addEventListener('click', () => useUltimate(button.dataset.ultimate)));
  app.querySelectorAll('[data-stove]').forEach(button => button.addEventListener('click', () => selectBossStove(button.dataset.stove)));
  app.querySelector('[data-battle-pause]')?.addEventListener('click', () => {
    battle.paused = !battle.paused;
    saveNow();
    updateBattleHud(battle);
  });
  app.querySelector('[data-battle-speed]')?.addEventListener('click', () => {
    battle.speed = battle.speed === 2 ? 1 : 2;
    updateBattleHud(battle);
  });
  app.querySelector('[data-battle-result]')?.addEventListener('click', claimAdventureBattle);
  app.querySelector('[data-adventure-prepare]')?.addEventListener('click', () => {
    if (leaveAdventureDefeat(adventure)) navigate('roster');
  });
  const canvas = app.querySelector('#adventure-canvas');
  canvas?.addEventListener('pointerdown', onWorldPointer);
  const minimap = app.querySelector('#world-minimap');
  const toggle = app.querySelector('[data-map-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      runtime.showMinimap = !runtime.showMinimap;
      minimap.hidden = !runtime.showMinimap;
      toggle.setAttribute('aria-expanded', String(runtime.showMinimap));
    });
    runtime.minimapObjective = guideAction;
  }
  const stick = app.querySelector('[data-world-stick]');
  if (stick) bindWorldStick(stick, input => {
    runtime.worldStick = input;
    adventure.walkPath = [];
    adventure.walkTarget = null;
    adventure.tapInteraction = null;
  });
  if (battle) updateBattleHud(battle);
}

function renderAdventureJournal() {
  const { save, adventure } = runtime;
  const journal = adventureJournal(save);
  const guideAction = journal.action ?? journal.nextChapterAction;
  const chronicle = adventureChronicle(save);
  const statusText = { done: 'Hoàn thành', current: 'Mục tiêu hiện tại', upcoming: 'Sắp tới' };
  shell(`
    ${pageHeader('Phiêu lưu', 'Nhật ký hành trình', '', 'adventure')}
    <section class="panel journey-panel">
      <h2>${journal.title}</h2>
      ${journal.completedCampaign ? '<p class="quest-objective">Hành Trình Vị Linh đã hoàn thành</p>' : ''}
      <ol class="journey-steps">${journal.labels.map(({ title, status }) =>
        `<li data-step-status="${status}" ${status === 'current' ? 'aria-current="step"' : ''}>
          <strong>${title}</strong><small>${statusText[status]}</small>
        </li>`).join('')}</ol>
      ${journal.clues.length ? `<details class="journal-clues"><summary>Manh mối đã ghi (${journal.clues.length})</summary>
        <dl>${journal.clues.map(clue => `<dt>${clue.title}</dt><dd>${clue.note}</dd>`).join('')}</dl>
      </details>` : ''}
      <div class="action-row">
        ${guideAction && !adventure.battle ? `<button class="button" data-guide-objective>${guideAction === ROOM_EXIT ? 'Dẫn đến lối ra' : 'Dẫn đường'}</button>` : ''}
        ${!adventure.battle && adventureChallenges(save).some(item => item.unlocked) ? '<button type="button" class="button light" data-adventure-challenges>Khiêu chiến</button>' : ''}
        <button class="button light" data-page="adventure">Về bản đồ</button>
      </div>
    </section>
    <section class="panel chronicle-panel" aria-label="Manga Hành Trình Vị Linh">
      <h2>Manga Hành Trình Vị Linh</h2>
      <div class="chronicle-grid">${chronicle.map(chapter => `<article class="chronicle-entry ${chapter.scenes.length ? '' : 'locked'}">
        ${chapter.scenes.length ? `<img loading="lazy" src="${chapterArt(chapter.number)}" alt="">` : ''}
        <div class="chronicle-copy"><span>Chương ${chapter.number}${chapter.scenes.length ? '' : ' · Chưa mở'}</span><h3>${chapter.title}</h3>
          ${chapter.scenes.map(scene => `<button class="button light compact" data-story-replay="${scene}">${CHAPTER_DIALOGUES[scene].title}</button>`).join('')}
        </div></article>`).join('')}</div>
    </section>`);
  app.querySelector('[data-guide-objective]')?.addEventListener('click', () => guideToObjective(guideAction));
  app.querySelector('[data-adventure-challenges]')?.addEventListener('click', openAdventureChallenges);
  app.querySelectorAll('[data-story-replay]').forEach(button => {
    button.addEventListener('click', () => openStoryDialog(app, button.dataset.storyReplay));
  });
}

function openAdventureChallenges() {
  const { adventure, save } = runtime;
  if (adventure.battle) return;
  const entries = adventureChallenges(save);
  const unlocked = entries.filter(item => item.unlocked);
  if (!unlocked.length) return;
  const dialog = openInfoDialog('Khiêu chiến Vị Linh', `
    <div class="challenge-pickers">
      <label>Đối thủ<select data-challenge-boss>${entries.map(item =>
        `<option value="${item.id}" ${item.unlocked ? '' : 'disabled'}>${escapeHtml(item.boss.name)}${item.unlocked ? '' : ' · Chương ' + item.chapter}</option>`).join('')}</select></label>
      <label>Độ khó<select data-challenge-tier>${Object.entries(ADVENTURE_CHALLENGE_TIERS).map(([id, tier]) =>
        `<option value="${id}">${tier.name}</option>`).join('')}</select></label>
    </div>
    <div class="challenge-preview" data-challenge-preview aria-live="polite"></div>
    <div class="action-row"><button type="button" class="button" data-start-challenge>Vào khiêu chiến</button></div>`);
  const boss = dialog.querySelector('[data-challenge-boss]');
  const tier = dialog.querySelector('[data-challenge-tier]');
  const preview = dialog.querySelector('[data-challenge-preview]');
  boss.value = unlocked[0].id;
  function refresh() {
    const challenge = adventureChallenge(save, boss.value, tier.value);
    if (!challenge) return;
    const record = save.adventure.challengeRecords[challenge.key];
    const art = challenge.boss.stationary ? propArt(challenge.boss.artId ?? challenge.boss.id) : actorArt(challenge.boss.id);
    preview.innerHTML = `${art ? `<img src="${art}" alt="">` : ''}<div>
      <strong>${escapeHtml(challenge.boss.name)} · ${challenge.name}</strong>
      <p>${challenge.tactic}</p>
      <small>${record ? `Kỷ lục ${(record.bestTicks / ADVENTURE_TICK_RATE).toFixed(1)} giây · ${record.mostSurvivors}/${save.roster.length} sống sót · ${record.clears} lần thắng`
        : `Thưởng lần đầu · ${challenge.gold} vàng · ${challenge.essence} tinh hoa`}</small>
    </div>`;
  }
  boss.addEventListener('change', refresh);
  tier.addEventListener('change', refresh);
  dialog.querySelector('[data-start-challenge]').addEventListener('click', () => {
    if (!beginAdventureChallenge(adventure, save, boss.value, tier.value)) return;
    dialog.close();
    navigate('adventure');
    saveNow();
  });
  refresh();
}

function guideToObjective(action) {
  const objective = availableAdventureInteractions(runtime.adventure.map, runtime.save, runtime.maps)
    .find(item => item.action === action);
  if (runtime.page !== 'adventure') navigate('adventure');
  if (objective) queueWorldPath(objective);
}

function updateBattleHud(battle) {
  for (const card of app.querySelectorAll('[data-actor]')) {
    const actor = battle.actors.find((candidate) => candidate.actor_id === card.dataset.actor);
    if (!actor) continue;
    card.querySelector('[data-hp]').style.width = actor.hp / actor.maxHp * 100 + '%';
    card.querySelector('[data-energy]').style.width = actor.energy + '%';
    const button = card.querySelector('[data-ultimate]');
    const cooldown = Math.max(0, Math.ceil((actor.ultimateReadyTick - battle.tick) / ADVENTURE_TICK_RATE));
    const primed = actor.alive && actor.energy >= 100 && battle.phase === 'battle_running';
    if (primed && card.dataset.primed === 'false' && !battle.paused) runtime.audio.play('sfx_skill_ready', { gain: .62 });
    if (card.dataset.primed !== String(primed)) card.dataset.primed = String(primed);
    button.disabled = battle.paused || battle.bossTelegraph?.retreating || !primed || Boolean(actor.action) || cooldown > 0;
    const charge = button.querySelector('[data-charge]');
    const label = !actor.alive ? 'Đã gục' : cooldown ? `Hồi ${cooldown} s` : actor.action?.sourceKind === 'ultimate'
      ? 'Đang thi triển' : button.disabled ? `${actor.energy}%` : 'Sẵn sàng';
    if (charge.textContent !== label) charge.textContent = label;
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
  const sequenceControls = app.querySelector('[data-boss-sequence]');
  if (sequenceControls) {
    const tell = battle.bossTelegraph;
    sequenceControls.hidden = tell?.counter !== 'sequence';
    if (!sequenceControls.hidden) {
      const { options, order } = adventureEncounters[battle.encounter].phases[tell.phase].sequence;
      const done = tell.counterStep === order.length;
      const status = sequenceControls.querySelector('[data-boss-sequence-progress]');
      const text = done ? 'Đã kích hoạt đủ.' : `Thứ tự ${order.map(id => options[id]).join(' → ')} · ${tell.counterStep}/${order.length}`;
      if (status.textContent !== text) status.textContent = text;
      for (const button of sequenceControls.querySelectorAll('[data-boss-counter]')) button.disabled = battle.paused || done;
    }
  }
  const pause = app.querySelector('[data-battle-pause]');
  const ward = app.querySelector('[data-lantern-ward]');
  if (ward) {
    ward.disabled = battle.paused || battle.wardUsed || battle.bossTelegraph?.counter !== 'lantern';
    const label = battle.bossTelegraph?.warded ? 'Đang che chở' : battle.wardUsed ? 'Đèn đã dùng' : 'F · Đèn Giữ Vị';
    if (ward.textContent !== label) ward.textContent = label;
  }
  const tideControls = app.querySelector('[data-tide-controls]');
  if (tideControls) {
    const wave = battle.bossTelegraph;
    tideControls.hidden = wave?.counter !== 'retreat';
    if (!tideControls.hidden) {
      const threatened = battle.actors.filter(actor => actor.team === 'player' && actor.alive && actor.x > wave.safeX).length;
      const summary = tideControls.querySelector('[data-tide-threat]');
      const label = threatened ? `${threatened} Vị Linh đang trong vùng nước.` : 'Đội đang ở vùng khô.';
      if (summary.textContent !== label) summary.textContent = label;
      const button = tideControls.querySelector('[data-tide-retreat]');
      button.disabled = battle.paused || Boolean(wave.retreating);
      button.textContent = wave.retreating ? 'Giữ vị trí đến khi sóng qua' : 'R · Lùi về vùng khô';
    }
  }
  if (pause) {
    const label = battle.paused ? 'Tiếp tục' : 'Tạm dừng';
    if (pause.textContent !== label) pause.textContent = label;
    app.querySelector('[data-battle-speed]').setAttribute('aria-pressed', String(battle.speed === 2));
    const pill = app.querySelector('.world-phase');
    const tier = ADVENTURE_CHALLENGE_TIERS[battle.challengeTier];
    const phase = battle.paused ? 'Tạm dừng' : tier ? 'Boss · ' + tier.name
      : `Đợt ${battle.wave + 1}/${adventureEncounters[battle.encounter ?? 'forest'].waves.length}`;
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
  if (result.changed || result.dialogue || result.service) {
    runtime.heldKeys.clear();
    setAdventureInput(runtime.adventure, 0, 0);
    runtime.adventure.walkPath = [];
    runtime.adventure.walkTarget = null;
    runtime.adventure.tapInteraction = null;
  }
  if (result.changed) saveNow();
  if (result.service) return openVillageService(result.service, result.offer);
  render();
  if (result.dialogue) openStoryDialog(app, result.dialogue);
}

function openVillageService(service, offer) {
  if (service === 'gear') {
    runtime.rosterTab = 'gear';
    return navigate('roster');
  }
  if (service === 'journal') return navigate('journey');
  if (service !== 'supplies' || !offer) return;
  const affordable = runtime.save.player.gold >= offer.gold;
  const dialog = openInfoDialog('Tiệm Nguyên Liệu', `
    <p>Đổi vàng lấy tinh hoa dùng để nâng cấp, chế tác và tặng quà Vị Linh.</p>
    <p><b>${escapeHtml(offer.essence)} tinh hoa</b> · ${escapeHtml(offer.gold)} vàng</p>
    <button type="button" class="button" data-buy-supplies ${affordable ? '' : 'disabled'}>${affordable ? 'Đổi nguyên liệu' : 'Chưa đủ vàng'}</button>`);
  dialog.querySelector('[data-buy-supplies]').addEventListener('click', () => {
    const purchase = purchaseAdventureSupplies(runtime.adventure, runtime.save, runtime.maps);
    if (purchase.purchased) {
      runtime.save = purchase.save;
      runtime.adventure.lastMessage = `Đã đổi ${offer.gold} vàng lấy ${offer.essence} tinh hoa.`;
      saveNow();
      runtime.audio.play('sfx_ui_confirm');
    } else {
      runtime.adventure.lastMessage = 'Không thể đổi nguyên liệu. Kiểm tra số vàng và vị trí.';
    }
    dialog.close();
    renderAdventure();
    app.querySelector('[data-interact]')?.focus({ preventScroll: true });
  }, { once: true });
}

function useUltimate(actorId) {
  const result = activateUltimate(runtime.adventure, runtime.save, actorId);
  if (!result.ok) runtime.adventure.lastMessage = result.reason;
  updateBattleHud(runtime.adventure.battle);
}

function claimAdventureBattle() {
  const battle = runtime.adventure.battle;
  if (battle?.result === 'defeat') {
    if (battle.challengeTier) beginAdventureChallenge(runtime.adventure, runtime.save, battle.encounter, battle.challengeTier);
    else beginBattle(runtime.adventure, runtime.save, battle.encounter);
    saveNow();
    render();
    return;
  }
  runtime.save = claimBattleResult(runtime.adventure, runtime.save);
  saveNow();
  render();
}

function onWorldPointer(event) {
  if (app.querySelector('dialog[open]')) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const battle = runtime.adventure.battle;
  const view = adventureViewport(battle, compactBattle.matches, portraitBattle.matches);
  const x = view.left + (event.clientX - rect.left) / rect.width * view.width;
  const y = view.top + (event.clientY - rect.top) / rect.height * view.height;
  if (battle) {
    const stove = battle.stoves.find(target => target.alive
      && Math.abs(target.x - x) <= 39 && y >= target.y - 73 && y <= target.y + 10);
    if (stove) selectBossStove(stove.actor_id);
    return;
  }
  const target = availableAdventureInteractions(runtime.adventure.map, runtime.save, runtime.maps)
    .find(item => Math.hypot(item.x - x, item.y - y) < 35);
  canvas.dataset.pathLength = String(queueWorldPath(target ?? { x, y }, target?.action));
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
  const adventure = runtime.adventure;
  const view = adventureViewport(adventure.battle, compactBattle.matches, portraitBattle.matches);
  const resolution = canvasResolution(canvas, view.width, view.height);
  const context = canvasContext(canvas, resolution, view.width, view.height, view.left, view.top);
  if (!context) return;
  const camera = resolveCameraViewport(adventure.x, adventure.y, { width: 960, height: 540 }, WORLD.width, WORLD.height);
  const cameraContext = { ...camera };
  if (adventure.walkPath?.length && !adventure.battle && runtime.heldKeys.size === 0 && !runtime.worldStick) {
    const waypoint = adventure.walkPath[0];
    if (Math.hypot(waypoint.x - adventure.x, waypoint.y - adventure.y) < .01) adventure.walkPath.shift();
    const next = adventure.walkPath[0];
    if (next) {
      setAdventureInput(adventure, next.x - adventure.x, next.y - adventure.y);
    } else {
      adventure.walkTarget = null;
      setAdventureInput(adventure, 0, 0);
      const action = adventure.tapInteraction;
      adventure.tapInteraction = null;
      if (action && nearestInteraction(adventure, runtime.save, runtime.maps)?.id === action) return doAdventureInteract();
    }
  }
  if (adventure.battle) setAdventureInput(adventure, 0, 0);
  else if (runtime.heldKeys.size) {
    const x = Number(runtime.heldKeys.has('ArrowRight') || runtime.heldKeys.has('d')) - Number(runtime.heldKeys.has('ArrowLeft') || runtime.heldKeys.has('a'));
    const y = Number(runtime.heldKeys.has('ArrowDown') || runtime.heldKeys.has('s')) - Number(runtime.heldKeys.has('ArrowUp') || runtime.heldKeys.has('w'));
    setAdventureInput(adventure, x, y);
    adventure.walkTarget = null;
    adventure.walkPath = [];
    adventure.tapInteraction = null;
  } else if (runtime.worldStick) {
    Object.assign(adventure.input, runtime.worldStick);
  } else if (!adventure.walkPath?.length) {
    setAdventureInput(adventure, 0, 0);
  }
  const previousPhase = adventure.battle?.phase;
  const previousWave = adventure.battle?.wave;
  const previousTelegraph = adventure.battle?.bossTelegraph;
  const oldX = adventure.x;
  const oldY = adventure.y;
  const playbackDelta = adventure.battle?.paused ? 0 : deltaSeconds * (adventure.battle?.speed ?? 1);
  stepAdventure(adventure, runtime.save, playbackDelta, runtime.maps);
  const moved = Math.hypot(adventure.x - oldX, adventure.y - oldY);
  if (!adventure.battle && moved > 0) runtime.audio.footstep(adventure.map, moved);
  syncAdventureAnimations(adventure, moved > .1);
  runtime.animations.advance(playbackDelta * 1000);
  runtime.effects.advance(playbackDelta);
  if (adventure.battle) {
    if (previousPhase !== adventure.battle.phase || previousWave !== adventure.battle.wave) {
      saveNow();
      return renderAdventure();
    }
    if (previousTelegraph !== adventure.battle.bossTelegraph) saveNow();
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
  canvas.dataset.battleRig = adventure.battle && spriteRenderer.rigs.has(HERO_ID) ? 'bunbo' : '';
  if (adventure.battle) drawBattleScene(context, adventure.battle, view);
  else {
    context.save();
    context.translate(-cameraContext.x, -cameraContext.y);
    drawWorldScene(context, adventure, runtime.save, moved > .25);
    context.restore();
    const minimap = app.querySelector('#world-minimap:not([hidden])');
    const map = getAdventureMap(runtime.maps, adventure.map);
    if (minimap && map) drawWorldMinimap(minimap, map, adventure,
      availableAdventureInteractions(adventure.map, runtime.save, runtime.maps), runtime.minimapObjective);
  }
}

function syncAdventureAnimations(adventure, moved) {
  const views = [];
  if (adventure.battle) {
    for (const actor of adventure.battle.actors) {
      const moveSpeed = spriteRenderer.rigs.has(actor.id) ? 3 : 1.5;
      views.push({ actorId: actor.actor_id, characterId: actor.id, team: actor.team, x: actor.x, y: actor.y, direction: actor.direction, alive: actor.alive, speed: actor.moving ? moveSpeed : 0 });
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
      speed: view.speed ?? (moved ? 1.5 : 0),
      alive: view.alive,
    });
  }
  runtime.animations.retainActors(views.map((view) => view.actorId));
}

function drawWorldScene(context, adventure, save, moving) {
  const map = getAdventureMap(runtime.maps, adventure.map);
  context.fillStyle = ({ village: '#b79864', forest: '#466a52', harbor: '#52677c', caldera: '#55423c', sanctum: '#382944' })[adventure.map] ?? '#466a52';
  context.fillRect(0, 0, 960, 540);
  spriteRenderer.drawImage(context, sceneArt(map?.runtime_key ?? 'village'), 0, 0, 960, 540);
  drawMapVisuals(context, map, save);
  if (adventure.walkTarget) {
    drawElementEffect(context, spriteRenderer, 'light', 'impact', {
      x: adventure.walkTarget.x, y: adventure.walkTarget.y + 1, size: 30, opacity: .66,
    });
  }
  if (moving && app.dataset.motion !== 'reduced') {
    drawElementEffect(context, spriteRenderer, adventure.map === 'forest' ? 'wood' : 'light', 'trail', {
      x: adventure.x, y: adventure.y + 1, size: 32, opacity: .20,
    });
  }
  drawPlayer(context, adventure.x, adventure.y, runtime.animations.getActorState(HERO_ID)?.animation);
}

function drawMapVisuals(context, map, save) {
  const activeIds = new Set(availableAdventureInteractions(map?.runtime_key, save, runtime.maps).map(item => item.id));
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
    } else if (visual.kind === 'marker' && (visual.id === 'feast_lilia' && activeIds.has(visual.id)
      || visual.id === 'npc_lilia' && save.adventure.finale[5].stage !== 'completed')) {
      drawFitted(context, actorArt('npc_lilia'), x, y + 11, 65, 70);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'guide') {
      drawFitted(context, actorArt(visual.actorId), x, y + 11, 65, 70);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'feast_guest' && save.adventure.finale[6].stage === 'completed') {
      drawFitted(context, actorArt(visual.actorId), x, y + 10, 65, 70);
      drawElementEffect(context, spriteRenderer, visual.element, 'impact', { x, y: y - 56, size: 24, opacity: .7 });
    } else if (visual.kind === 'clue' && activeIds.has(visual.id)) {
      drawElementEffect(context, spriteRenderer, visual.element ?? 'light', 'impact', { x, y: y - 9, size: 48, opacity: .9 });
      drawMapLabel(context, visual.label, x, y + 19);
    } else if (['room_entrance', 'room_station'].includes(visual.kind) && activeIds.has(visual.id)) {
      drawElementEffect(context, spriteRenderer, visual.element, 'impact', { x, y, size: 40, opacity: .8 });
      if (visual.label) drawMapLabel(context, visual.label, x, y + 25);
    } else if (visual.kind === 'lantern' && save.adventure.chapterTwo.stage === 'accepted') {
      const lit = !activeIds.has(visual.id);
      drawElementEffect(context, spriteRenderer, visual.element, 'impact', { x, y: y - 10, size: lit ? 63 : 49, opacity: lit ? 1 : .6 });
      drawMapLabel(context, lit ? visual.label + ' · ĐÃ SÁNG' : visual.label, x, y + 19);
    } else if (visual.kind === 'seal' && activeIds.has(visual.id)) {
      drawFitted(context, propArt(visual.artId ?? 'empty_bowl_seal'), x, y + 12, 81, 85);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'marker' && activeIds.has(visual.id)) {
      drawFitted(context, actorArt('mob_mushroom_01'), x, y + 10, 59, 62);
      drawMapLabel(context, visual.label, x, y + 24);
    } else if (visual.kind === 'chest') {
      drawFitted(context, propArt(save.adventure.chestOpened ? 'chest_open' : 'chest_closed'), x, y + 19, 58, 53);
      drawMapLabel(context, 'RƯƠNG', x, y + 33);
    } else if (visual.kind === 'portal') {
      const open = activeIds.has(visual.id);
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

function drawBattleScene(context, battle, view) {
  context.fillStyle = '#283f33';
  context.fillRect(0, 0, 960, 540);
  spriteRenderer.drawImage(context, sceneArt(adventureEncounters[battle.encounter ?? 'forest'].scene ?? 'arena'), 0, 0, 960, 540);
  if (battle.encounter === 'seal') {
    context.fillStyle = '#2f154852';
    context.fillRect(0, 0, 960, 540);
  }
  const boss = battle.actors.find((actor) => actor.boss && actor.alive);
  if (boss && battle.bossTelegraph) {
    const { ticks, duration, counter, safeX } = battle.bossTelegraph;
    const opacity = .46 + .33 * (1 - ticks / duration);
    if (counter === 'retreat') {
      drawTideWarning(context, safeX, opacity);
      drawElementEffect(context, spriteRenderer, 'water', 'impact', { x: boss.x, y: boss.y + 5, size: 180, opacity });
    } else if (boss.element === 'shadow') {
      drawElementEffect(context, spriteRenderer, 'shadow', 'impact', { x: boss.x, y: boss.y + 5, size: 198, opacity });
    } else drawBossWarning(context, boss.x, boss.y + 2, 230, opacity);
    for (const target of bossTelegraphTargets(battle, boss)) {
      const { x, y } = battleActorPoint(target, 1, safeX);
      if (boss.element === 'shadow') {
        const element = battle.bossTelegraph.warded ? 'light' : 'shadow';
        drawElementEffect(context, spriteRenderer, element, 'impact', { x, y: y + 2, size: 96, opacity });
      } else if (counter === 'retreat') {
        drawElementEffect(context, spriteRenderer, 'water', 'impact', { x, y: y + 2, size: 79, opacity });
      } else drawBossWarning(context, x, y + 2, 79, opacity);
    }
  }
  const reducedMotion = app.dataset.motion === 'reduced';
  const interpolate = !battle.paused && battle.phase === 'battle_running' && !reducedMotion;
  const fraction = interpolate ? Math.min(1, Math.max(0, (battle.accumulator ?? 0) * ADVENTURE_TICK_RATE)) : 0;
  const blend = interpolate ? fraction : 1;
  const actors = [...battle.actors, ...battle.stoves]
    .map(actor => ({ actor, ...battleActorPoint(actor, blend, battle.bossTelegraph?.safeX) })).sort((a, b) => a.y - b.y);
  for (const { actor, x, y } of actors) {
    if (actor.stove) {
      if (actor.alive) drawBossStove(context, actor, battle.stoveTargetId === actor.actor_id);
    } else {
      const animation = runtime.animations.getActorState(actor.actor_id)?.animation;
      const clock = runtime.rigClocks.get(actor.id);
      const rigMotion = clock?.frame(battle, actor, animation, fraction);
      drawActor(context, actor, animation,
        actor.boss && ['stoves', 'sequence'].includes(battle.bossTelegraph?.counter),
        x, y, rigMotion);
    }
  }
  runtime.effects.draw(context, battle, reducedMotion, view, fraction, blend);
}

function drawTideWarning(context, safeX, opacity) {
  context.save();
  context.fillStyle = '#5ce9ad24';
  context.fillRect(0, 220, safeX, 320);
  context.fillStyle = `rgba(36, 163, 224, ${opacity * .41})`;
  context.fillRect(safeX, 220, WORLD.width - safeX, 320);
  context.fillStyle = '#ccf7fe';
  context.fillRect(safeX - 1, 220, 2, 320);
  drawMapLabel(context, 'VÙNG KHÔ', safeX - 43, 235);
  drawMapLabel(context, 'VÙNG NƯỚC', safeX + 48, 235);
  context.restore();
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

function drawActor(context, actor, animation, guarded, x, y, rigMotion) {
  context.save();
  context.globalAlpha = actor.alive ? 1 : .32;
  context.fillStyle = '#101e1c8c';
  context.beginPath();
  context.ellipse(x, y + 2, actor.boss ? 33 : 23, 7, 0, 0, Math.PI * 2);
  context.fill();
  const drawn = (rigMotion && spriteRenderer.rigs.get(actor.id).draw(context, rigMotion, x, y, actor.direction, SPIRIT_RIG_SCALE))
    || (!actor.stationary && spriteRenderer.drawSprite(context, actor.id, animation, x, y, { scale: actor.boss ? 1.04 : .67 }));
  if (actor.stationary) {
    drawFitted(context, propArt(actor.artId ?? actor.id), x, y, 150, 129);
  } else if (!drawn) {
    const pose = placeholderPose(animation);
    drawFitted(context, actorArt(actor.id), x, y + pose.offsetY,
      (actor.boss ? 150 : 77) * pose.scaleX, (actor.boss ? 128 : 78) * pose.scaleY);
  }
  if (actor.shield || guarded) {
    const options = { x, y: y - (guarded ? 66 : 47), size: guarded ? 210 : 123, opacity: guarded ? .56 : .43 };
    if (!drawEffectTexture(context, spriteRenderer, combatArt('shield_bubble'), options)) {
      drawElementEffect(context, spriteRenderer, 'light', 'impact', options);
    }
  }
  if (actor.alive) {
    const ally = actor.team === 'player';
    const barY = ally ? y + 8 : y - (actor.boss ? 140 : drawn ? 104 : 89);
    const barWidth = ally ? 37 : actor.boss ? 94 : 50;
    context.fillStyle = '#182726';
    context.fillRect(x - barWidth / 2, barY, barWidth, 6);
    context.fillStyle = ally ? elementColors[actor.element] ?? '#b4e09c' : '#ff865e';
    context.fillRect(x - barWidth / 2 + 1, barY + 1, (barWidth - 2) * actor.hp / actor.maxHp, 4);
  }
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
const TCG_PHASES = { action: 'Triển khai', reaction: 'Phản ứng', trap_choice: 'Cơ hội bẫy', combat: 'Tấn công', block_assign: 'Chọn quân chặn', round_end: 'Kết thúc lượt' };

function playerDeck() {
  const source = runtime.save.tcgDeck;
  const cards = Object.entries(tcgTableDraft(source, runtime.cards)).map(([card_id, count]) => ({ card_id, count }));
  const deck = { ...source, cards };
  try {
    validateDeck(deck, runtime.cards, TCG_TABLE_DECK_SIZE);
    return deck;
  } catch {
    return tcgTableDeck(runtime.cards);
  }
}

const tcgDefaultPreset = difficulty => ({ hard: 'guard', extreme: 'assault' })[difficulty] ?? 'starter';

function startTcg(seed, difficulty = 'normal', opponentPreset = '') {
  runtime.mulligan.clear();
  runtime.selectedTarget = null;
  runtime.selectedSpell = null;
  runtime.tcgAttackers = null;
  runtime.tcgStrike = null;
  runtime.tcgReveal = null;
  runtime.tcgCutIn = null;
  runtime.tcgRecipeFlash = null;
  runtime.tcgImpacts.clear();
  duelEffects.clear();
  tcgCardMotion.clear();
  const preset = opponentPreset || tcgDefaultPreset(difficulty);
  return createTcgMatch(runtime.cards, playerDeck(), seed, tcgTableDeck(runtime.cards, preset), difficulty, TCG_TABLE_VERSION);
}

function cardArt(card) {
  const entry = card.card_id && runtime.cards.cards.find((candidate) => candidate.card_id === card.card_id);
  if (card.art_prop) return propArt(card.art_prop);
  if (card.art_effect) return combatArt(card.art_effect);
  return actorArt(card.character_id ?? entry?.character_id)
    ?? originalCardArt(card.art_card ?? card.card_id)
    ?? effectArt(card.element ?? entry?.element, card.type === 'fast_spell' ? 'trail' : 'impact');
}

function matchCardArt(card) {
  if (Object.hasOwn(characterNames, card.requires_character)) return cutinArt(card.requires_character);
  return Object.hasOwn(characterNames, card.character_id) ? cutinArt(card.character_id)
    : originalCardArt(card.card_id) ?? cardArt(card);
}

function matchHeader(title, controls) {
  return `<header class="match-header"><h1>${title}</h1>
    <details class="match-menu"><summary aria-label="Tùy chọn trận đấu">⋯</summary><div>${controls}</div></details></header>`;
}

function tcgCommander(match, index, targets, strikes) {
  const player = match.players[index];
  const friendly = index === 0;
  const targeting = targets.some(target => target.player === index && target.id === 'commander');
  const canStrike = !friendly && strikes.some(target => target.id === 'commander');
  const id = friendly ? 'commander:p0' : 'commander:p1';
  const preset = runtime.cards.presets?.find(item => 'deck_' + item.id === match.botDeckId);
  const name = friendly ? 'Người Kết Vị' : preset?.name ?? 'Chủ soái đối thủ';
  const hp = `<b>${player.hp}</b><small>HP</small>${tcgImpact(id)}`;
  return `<div class="${friendly ? 'duel-bottom' : 'duel-top'}">
    <span class="duel-crest" aria-hidden="true">${friendly ? `<img src="${actorArt(HERO_ID)}" alt="">` : '◆'}</span>
    <div class="duel-identity"><strong>${escapeHtml(name)}</strong><small>${player.mana}/${player.maxMana} mana · ${player.deck.length} lá bộ${friendly ? '' : ` · ${player.hand.length} lá tay`}</small></div>
    ${tcgTrapSlots(match, index, targets)}
    ${canStrike ? `<button type="button" class="commander-hp enemy-hp strike-target" data-duel-id="${id}" data-tcg-strike-target="commander" aria-pressed="${runtime.tcgStrike?.target === 'commander'}" aria-label="Tấn công ${escapeAttr(name)} · ${player.hp} HP">${hp}</button>`
      : targeting
      ? `<button type="button" class="commander-hp ${friendly ? '' : 'enemy-hp'} spell-target" data-duel-id="${id}" data-spell-target="commander" aria-pressed="${runtime.selectedTarget === 'commander'}" aria-label="${escapeAttr(name)} · ${player.hp} HP">${hp}</button>`
      : `<div class="commander-hp ${friendly ? '' : 'enemy-hp'}" data-duel-id="${id}">${hp}</div>`}
    <meter class="commander-meter" min="0" max="${tcgCommanderMax(match, index)}" value="${player.hp}" aria-label="Máu ${escapeAttr(name)}"></meter>
  </div>`;
}

function tcgCardRule(card) {
  if (card.type === 'unit') {
    const ids = new Set(card.keywords ?? []);
    if ((runtime.page === 'deck' || usesTcgTable(runtime.tcg)) && runtime.cards.table_guard_units?.includes(card.card_id)) ids.add('guard');
    const keywords = [...ids].map(id => TCG_KEYWORDS[id]).filter(Boolean);
    const onPlay = card.on_play?.kind === 'shield' ? `Vào sân với ${card.on_play.value} hộ thuẫn đến hết lượt.`
      : card.on_play?.kind === 'draw' ? `Vào sân và rút tối đa ${card.on_play.value} lá.` : '';
    return [`ATK ${card.atk} · DEF ${card.max_def}.`, onPlay, ...keywords].filter(Boolean).join(' ');
  }
  if (card.type === 'trap') return tcgTrapRule(card, runtime.page === 'deck' || usesTcgTable(runtime.tcg)) + ' Bẫy sẵn sàng khi đổi lượt và dùng một lần khi bạn kích hoạt.';
  const effect = tcgEffectText(card);
  const requirement = card.requires_character ? ` Cần ${characterNames[card.requires_character]} trên bàn đến khi phép xử lý.` : '';
  if (card.type === 'fast_spell') return effect + requirement + ' Có thể đưa vào hàng chờ khi phản ứng.';
  if (card.type === 'slow_spell') return effect + requirement + ' Chỉ đưa vào hàng chờ khi triển khai và hàng chờ trống.';
  return effect + requirement + ' Xử lý ngay, kể cả khi phản ứng. Bạn giữ quyền ưu tiên.';
}

function showTcgCard(cardId, instanceId) {
  const card = runtime.cards.cards.find(item => item.card_id === cardId);
  if (!card) return;
  const match = runtime.tcg;
  const held = runtime.page === 'tcg' && match?.players[0].hand.find(item => item.instance_id === instanceId);
  const reason = held && tcgCardIssue(match, 0, held);
  openInfoDialog(cardName(card), `<div class="inspect-tcg"><img src="${escapeAttr(matchCardArt(card))}" alt="">
    <div><strong>${card.requires_character ? 'Tuyệt kỹ · ' : ''}${CARD_TYPES[card.type]} · Hệ ${ELEMENT_NAMES[card.element]} · ${held ? tcgCardCost(match, 0, held) : card.cost} mana</strong>
    <p>${escapeHtml(tcgCardRule(held || card))}</p>${reason ? `<small>${escapeHtml(reason)}</small>` : ''}</div></div>`);
}

function showTcgGraveyard(cards) {
  const counts = new Map();
  for (const card of [...cards].reverse()) {
    const previous = counts.get(card.card_id);
    counts.set(card.card_id, { card, count: (previous?.count ?? 0) + 1 });
  }
  openInfoDialog('Mộ bài của bạn', `<ul class="tcg-graveyard">${[...counts.values()].map(({ card, count }) =>
    `<li><strong>${escapeHtml(cardName(card))} ×${count}</strong><small>${escapeHtml(tcgCardRule(card))}</small></li>`).join('')}</ul>`);
}

function boardChibi(id, key, direction, fallback) {
  if (!id || !spriteRenderer.sheets.get(id)?.loaded) return fallback;
  return `<canvas class="board-chibi" width="${BOARD_SPRITE.width}" height="${BOARD_SPRITE.height}" aria-hidden="true" data-chibi-id="${escapeAttr(id)}"
    data-chibi-key="${escapeAttr(key)}" data-chibi-facing="${direction}"></canvas>`;
}

function tcgSpriteKey(battleId, actorId) { return `${battleId}:${actorId}`; }

function tcgLaneId(player, lane) { return `lane:p${player}:${lane}`; }

function tcgImpact(id) {
  const impact = runtime.tcgImpacts.get(id);
  if (!impact || impact.matchId !== runtime.tcg.battleId || impact.expires <= performance.now()) return '';
  const delay = Math.round(impact.contact - performance.now());
  const texture = impact.style === 'shield' || impact.style === 'guard' ? combatArt('shield_bubble') : effectArt(impact.element, 'impact');
  return `<span class="tcg-hit" style="--contact-delay:${delay}ms" aria-hidden="true">
    <img class="tcg-impact" src="${texture}" alt=""><span class="tcg-damage tcg-${impact.style}">${escapeHtml(impact.text ?? '−' + impact.damage)}</span></span>`;
}

function renderTcg() {
  if (!runtime.tcg) runtime.tcg = startTcg(41);
  else if (runtime.tcg.priority === 1 && !runtime.tcg.result) runtime.tcg = runTcgBot(runBotPriority(runtime.tcg), { yieldToPlayer: true });
  const match = runtime.tcg;
  for (const [id, impact] of runtime.tcgImpacts) {
    if (impact.matchId !== match.battleId || impact.expires <= performance.now()) runtime.tcgImpacts.delete(id);
  }
  const [user, bot] = match.players;
  const table = usesTcgTable(match);
  const opening = match.mulliganDone === false && match.round === 1 && match.eventSeq === 0;
  const canPlay = !opening && !match.result && ['action', 'reaction'].includes(match.phase) && match.priority === 0;
  const spell = canPlay ? user.hand.find(card => card.instance_id === runtime.selectedSpell && !tcgCardIssue(match, 0, card)) : null;
  const targets = spell ? tcgTablePlayTargets(match, spell) : [];
  const canStrike = table && !opening && !match.result && match.activePlayer === 0 && match.priority === 0 && ['action', 'combat', 'round_end'].includes(match.phase);
  const attacker = canStrike ? user.units.find(unit => unit.instance_id === runtime.tcgStrike?.attacker && tcgCanAttack(unit)) : null;
  if (!attacker) runtime.tcgStrike = null;
  const strikes = attacker ? tcgStrikeTargets(match, 0) : [];
  const defender = strikes.find(target => target.id === runtime.tcgStrike?.target);
  const ready = canStrike ? user.units.filter(tcgCanAttack).length : 0;
  const targetIds = new Set(targets.map(target => target.id));
  if (!spell) {
    runtime.selectedSpell = null;
    runtime.selectedTarget = null;
  }
  if (!targetIds.has(runtime.selectedTarget)) runtime.selectedTarget = null;
  if (targets.length === 1 && ['row', 'deck', 'set'].includes(targets[0].id)) runtime.selectedTarget = targets[0].id;
  const hand = user.hand.map((card) => {
    const reason = opening ? '' : tcgCardIssue(match, 0, card);
    const cost = tcgCardCost(match, 0, card);
    const selected = opening ? runtime.mulligan.has(card.instance_id) : spell?.instance_id === card.instance_id;
    const detail = card.type === 'unit' ? `${card.atk}/${card.max_def}`
      : card.type === 'trap' ? TCG_TRAP_LABELS[card.trigger?.when] : tcgEffectBadge(card);
    return `<div class="hand-card"><button class="playing-card element-${card.element} ${selected ? 'selected' : ''} ${card.requires_character ? 'ultimate-card' : ''}" data-card="${escapeAttr(card.instance_id)}" ${opening || table || card.type.endsWith('_spell') ? `aria-pressed="${selected}"` : ''} ${reason ? `disabled title="${escapeAttr(reason)}"` : ''}>
      <span class="card-cost ${cost < card.cost ? 'resonant' : ''}" aria-label="${cost} mana${cost < card.cost ? ', đã giảm 1 nhờ Cộng hưởng' : ''}">${cost}</span><span class="card-thumb"><img src="${escapeAttr(matchCardArt(card))}" alt=""></span>
      <span class="card-copy"><strong>${escapeHtml(cardName(card))}</strong><small>${card.requires_character ? 'Tuyệt kỹ' : CARD_TYPES[card.type]}${detail ? ' · ' + escapeHtml(detail) : ''}</small></span></button>
      <button type="button" class="hand-inspect" data-view-tcg-card="${escapeAttr(card.card_id)}" data-inspect-instance="${escapeAttr(card.instance_id)}" aria-label="Chi tiết ${escapeAttr(cardName(card))}">i</button></div>`;
  }).join('');
  const phaseLabel = match.result ? match.winner === 0 ? 'Chiến thắng' : match.winner === null ? 'Hòa trận' : 'Thất bại' : TCG_PHASES[match.phase];
  const showCombat = !table && match.phase === 'combat' && match.activePlayer === 0 && !match.result;
  const defending = match.phase === 'block_assign' && match.priority === 0;
  const trapChoice = match.phase === 'trap_choice' && match.priority === 0;
  const incoming = declaredTcgAttackers(match);
  const declared = new Set(incoming.map(unit => unit.instance_id));
  const blocked = new Set(match.pendingAttack?.blocks?.map(block => block.blockerId));
  if (showCombat) runtime.tcgAttackers ??= new Set(user.units.filter(tcgCanAttack).map(unit => unit.instance_id));
  else runtime.tcgAttackers = null;
  const selected = runtime.tcgAttackers?.size ?? 0;
  const stackTop = match.stack.at(-1);
  const trapReveal = [...match.stack].reverse().find(item => item.card.type === 'trap');
  const preview = defender && tcgStrikePreview(attacker, defender.unit, bot.hp);
  const strikeControls = attacker ? `<div class="tcg-strike-controls">
    <div role="status"><strong>${escapeHtml(cardName(attacker))}${defender ? ' → ' + escapeHtml(defender.label) : ''}</strong>
    <small>${preview ? `−${preview.damage} ${defender.unit ? 'DEF' : 'HP'}${preview.absorbed ? ` · ${preview.absorbed} vào hộ thuẫn` : ''}${defender.unit ? ` · Phản đòn −${preview.counter} DEF` : ''}${preview.spill ? ` · Xuyên −${preview.spill} HP` : ''}`
      : strikes.some(target => target.unit?.keywords?.includes('guard')) ? 'Chọn Hộ vệ của đối thủ.' : 'Chọn Vị Linh địch hoặc chủ soái.'}</small></div>
    <button class="button" data-tcg-confirm-strike ${defender ? '' : 'disabled'}>Xác nhận đòn</button><button class="button light" data-tcg-cancel-strike>Hủy</button></div>` : '';
  const recipe = spell && TCG_RECIPES[tcgRecipeFor(match, 0, spell)];
  const verb = spell?.type === 'unit' ? 'Triệu hồi' : spell?.type === 'trap' ? 'Úp bài' : 'Thi triển';
  const spellControls = spell ? `<div class="action-row spell-confirm">
    <label class="target-select"><span title="${escapeAttr(tcgEffectText(spell))}">${escapeHtml(cardName(spell))} · ${escapeHtml(spell.type === 'unit' ? `${spell.atk}/${spell.max_def}` : spell.type === 'trap' ? TCG_TRAP_LABELS[spell.trigger.when] : tcgEffectBadge(spell))}</span>
      ${spell.type === 'trap' ? '' : `<select id="tcg-target"><option value="">Chọn mục tiêu</option>${targets.map(({ id, label }) =>
        `<option value="${escapeAttr(id)}" ${runtime.selectedTarget === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`}
    </label>
    ${recipe ? `<small class="tcg-recipe-hint" title="${escapeAttr(recipe.reward)}">Combo · ${recipe.name}</small>` : ''}
    <button class="button" data-tcg-cast ${runtime.selectedTarget ? '' : 'disabled'}>${verb}</button><button class="button light" data-tcg-cancel-spell>Hủy chọn</button>
  </div>` : '';
  const action = match.result ? '<button class="button" data-tcg-new>Ván mới</button>'
    : opening ? `<button class="button" data-tcg-mulligan>${runtime.mulligan.size ? 'Đổi ' + runtime.mulligan.size + ' lá' : 'Giữ bài và vào trận'}</button>`
    : spell ? spellControls
    : attacker ? strikeControls
    : table && canStrike ? '<button class="button" data-tcg-end>Kết thúc lượt</button>'
    : canPlay ? `<button class="button" data-tcg-pass>${match.phase === 'reaction' ? 'Bỏ phản ứng' : 'Bỏ ưu tiên'}</button>`
    : showCombat ? `<button class="button" data-tcg-attack>${selected ? `Tấn công · ${selected} Vị Linh` : 'Bỏ tấn công'}</button>${selected ? '<button class="button light" data-tcg-skip>Bỏ tấn công</button>' : ''}`
    : match.phase === 'round_end' && match.activePlayer === 0 ? '<button class="button" data-tcg-end>Kết thúc lượt</button>' : '';
  shell(`
    ${matchHeader('Thẻ chiến thuật', `
      <button type="button" data-tcg-log>Nhật ký</button><button type="button" data-page="deck">Sửa bộ bài</button>
      <button type="button" data-tcg-rules>Luật nhanh</button>
      <button type="button" data-tcg-graveyard ${user.graveyard.length ? '' : 'disabled'}>Mộ bài · ${user.graveyard.length}</button>
      <button type="button" data-tcg-restart>Ván mới · Bot ${TCG_DIFFICULTIES[match.difficulty] ?? TCG_DIFFICULTIES.normal}</button>
      ${match.result ? '' : '<button type="button" data-tcg-surrender>Đầu hàng</button>'}`)}
    <div class="match-layout tcg-match" data-targeting="${Boolean(spell)}" data-tcg-phase="${match.phase}" ${table ? 'data-direct' : ''}>
      <section class="duel-field" aria-label="Bàn đấu thẻ">
        ${tcgCommander(match, 1, targets, strikes)}
        <div class="unit-row enemy-row" data-tcg-row="1">${tcgLanes(bot.units, false, declared, blocked, targetIds, defending, canStrike, strikes)}</div>
        <div class="duel-mid"><div class="stack-strip">
          <b>Vòng ${match.round} · ${opening ? 'Đổi bài' : phaseLabel}</b>
          ${opening || match.result ? '' : `<span>${match.activePlayer === 0 ? 'Lượt bạn' : 'Lượt đối thủ'} · ${match.priority === 0 ? 'Bạn ưu tiên' : 'Bot ưu tiên'}</span>
            ${match.activePlayer === 0 ? `<span>${table ? ready + ' quân sẵn sàng' : user.attackUsedRound === match.round ? 'Đã đánh' : 'Còn lượt đánh'}</span>` : ''}`}
        </div>
        ${stackTop ? `<button type="button" class="tcg-stack-button ${trapReveal ? 'has-trap' : ''}" data-tcg-stack>
          <img src="${escapeAttr(cardArt(stackTop.card))}" alt=""><span>${stackTop.card.type === 'trap' ? 'Lật bẫy' : 'Xử lý trước'} · <b>${escapeHtml(cardName(stackTop.card))}</b></span><small>${match.stack.length} chờ</small>
        </button>` : ''}</div>
        <div class="unit-row friendly-row" data-tcg-row="0">${tcgLanes(user.units, true, declared, blocked, targetIds, defending, canStrike, strikes)}</div>
        ${tcgCommander(match, 0, targets, strikes)}
        <canvas class="duel-effects" aria-hidden="true" hidden></canvas>
        ${tcgStageBanners(match)}
        ${runtime.tcgRecipeFlash?.matchId === match.battleId && runtime.tcgRecipeFlash.expires > performance.now() ? `<span class="tcg-recipe-flash" role="status">Combo · ${runtime.tcgRecipeFlash.name}</span>` : ''}
      </section>
      <section class="match-command tcg-hand-dock" aria-label="Điều khiển đấu thẻ">
        ${trapChoice ? tcgTrapPanel(match) : defending ? tcgDefensePanel(incoming, user.units) : `
          <div class="hand-heading"><strong>${opening ? table ? 'Đổi tối đa 3 lá' : 'Chọn lá muốn đổi' : 'Bài trên tay'}</strong><span>${!opening && user.chainElement && !user.resonanceUsed ? `Cộng hưởng ${ELEMENT_NAMES[user.chainElement]} · ` : ''}${user.hand.length}/${table ? 8 : 9} lá</span></div>
          <div class="hand-row">${hand || '<p class="empty-message">Không còn bài trên tay.</p>'}</div>
          ${showCombat && selected ? '<p class="match-hint">Chạm Vị Linh để chọn quân tấn công.</p>' : ''}
          ${action ? `<div class="match-actions">${action}</div>` : ''}`}
        ${match.result ? `<p class="tcg-result-note">${escapeHtml(match.log.find(entry => entry.type === 'match_finished')?.text ?? phaseLabel)}</p>` : ''}
        ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      </section>
    </div>
  `);
  tcgCardMotion.render(app, user.hand, app.dataset.motion === 'reduced');
  app.querySelector('[data-tcg-log]').addEventListener('click', () => openInfoDialog('Nhật ký trận', renderTextLog(match.log)));
  app.querySelector('[data-tcg-rules]').addEventListener('click', showTcgRules);
  app.querySelector('[data-tcg-stack]')?.addEventListener('click', () => showTcgStack(match));
  app.querySelector('[data-tcg-hand]')?.addEventListener('click', () => {
    const cards = user.hand.map(card => `<li><strong>${escapeHtml(cardName(card))} · ${card.cost} mana</strong><small>${escapeHtml(tcgCardRule(card))}</small></li>`);
    openInfoDialog('Bài trên tay', cards.length ? `<ul class="tcg-graveyard">${cards.join('')}</ul>` : '<p>Không còn bài trên tay.</p>');
  });
  app.querySelectorAll('[data-view-tcg-card]').forEach(button => button.addEventListener('click', () => showTcgCard(button.dataset.viewTcgCard, button.dataset.inspectInstance)));
  app.querySelectorAll('[data-tcg-slot]').forEach(button => button.addEventListener('click', () => {
    const [owner, slot] = button.dataset.tcgSlot.split(':').map(Number);
    showTcgTrapSlot(match, owner, slot);
  }));
  app.querySelector('[data-tcg-graveyard]').addEventListener('click', () => showTcgGraveyard(user.graveyard));
  app.querySelector('[data-tcg-surrender]')?.addEventListener('click', () => {
    if (confirm('Đầu hàng ván đấu này?')) actTcg(() => surrenderTcg(runtime.tcg, 0));
  });
  function selectSpellTarget(value) {
    runtime.selectedTarget = value || null;
    const picker = app.querySelector('#tcg-target');
    if (picker) picker.value = value;
    app.querySelector('[data-tcg-cast]').disabled = !runtime.selectedTarget;
    for (const button of app.querySelectorAll('[data-spell-target]')) {
      button.setAttribute('aria-pressed', String(button.dataset.spellTarget === runtime.selectedTarget));
    }
  }
  app.querySelector('#tcg-target')?.addEventListener('change', event => selectSpellTarget(event.target.value));
  app.querySelectorAll('[data-spell-target]').forEach(button =>
    button.addEventListener('click', () => selectSpellTarget(button.dataset.spellTarget)));
  app.querySelector('[data-tcg-cast]')?.addEventListener('click', () => {
    if (runtime.selectedTarget) playTcgFromHand(spell, runtime.selectedTarget);
  });
  app.querySelector('[data-tcg-cancel-spell]')?.addEventListener('click', () => {
    runtime.selectedSpell = null;
    runtime.selectedTarget = null;
    renderTcg();
    app.querySelector(`[data-card="${CSS.escape(spell.instance_id)}"]`)?.focus({ preventScroll: true });
  });
  app.querySelectorAll('[data-card]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.card;
    if (opening) {
      if (!runtime.mulligan.delete(id) && (!table || runtime.mulligan.size < 3)) runtime.mulligan.add(id);
      renderTcg();
      app.querySelector(`[data-card="${CSS.escape(id)}"]`)?.focus();
    } else if (table || user.hand.find(card => card.instance_id === id)?.type.endsWith('_spell')) {
      runtime.tcgStrike = null;
      runtime.selectedSpell = runtime.selectedSpell === id ? null : id;
      runtime.selectedTarget = null;
      renderTcg();
      app.querySelector('#tcg-target')?.focus({ preventScroll: true });
    } else playTcgFromHand(user.hand.find(card => card.instance_id === id));
  }));
  app.querySelector('[data-tcg-mulligan]')?.addEventListener('click', () => {
    actTcg(() => mulliganTcg(runtime.tcg, [...runtime.mulligan]));
    runtime.mulligan.clear();
  });
  app.querySelector('[data-tcg-pass]')?.addEventListener('click', () => actTcg(() => passTcgPriority(runtime.tcg, 0)));
  app.querySelectorAll('[data-tcg-attacker]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.tcgAttacker;
    if (table) {
      runtime.selectedSpell = null;
      runtime.tcgStrike = runtime.tcgStrike?.attacker === id ? null : { attacker: id };
    } else if (!runtime.tcgAttackers.delete(id)) runtime.tcgAttackers.add(id);
    renderTcg();
    app.querySelector(`[data-tcg-attacker="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }));
  app.querySelectorAll('[data-tcg-strike-target]').forEach(button => button.addEventListener('click', () => {
    runtime.tcgStrike.target = button.dataset.tcgStrikeTarget;
    renderTcg();
    app.querySelector('[data-tcg-confirm-strike]')?.focus({ preventScroll: true });
  }));
  app.querySelector('[data-tcg-confirm-strike]')?.addEventListener('click', () => actTcg(() => strikeTcg(runtime.tcg, 0, attacker.instance_id, defender.id)));
  app.querySelector('[data-tcg-cancel-strike]')?.addEventListener('click', () => { runtime.tcgStrike = null; renderTcg(); });
  if (table && !opening && !match.result) bindTcgDrag(match, canStrike);
  app.querySelector('[data-tcg-attack]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [...runtime.tcgAttackers])));
  if (defending) bindTcgDefense();
  if (trapChoice) bindTcgTrapPanel(match);
  app.querySelector('[data-tcg-skip]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [])));
  app.querySelector('[data-tcg-end]')?.addEventListener('click', () => actTcg(() => endTcgTurn(runtime.tcg, 0)));
  app.querySelector('[data-tcg-new]')?.addEventListener('click', () => openTcgSetup(match));
  app.querySelector('[data-tcg-restart]')?.addEventListener('click', () => openTcgSetup(match));
  saveNow();
}

function tcgTablePlayTargets(match, card) {
  if (card.type === 'unit') return Array.from({ length: tcgBoardLimit(match) }, (_, lane) =>
    ({ id: 'lane:' + lane, label: 'Ô triệu hồi ' + (lane + 1), lane })).filter(({ lane }) =>
    !match.players[0].units.some(unit => unit.lane === lane));
  if (card.type === 'trap') return [{ id: 'set', label: 'Ô bẫy của bạn' }];
  return tcgSpellTargets(match, 0, card);
}

function playTcgFromHand(card, target) {
  if (!card) return;
  const lane = target?.startsWith('lane:') ? Number(target.slice(5)) : null;
  runtime.tcgPlayingCard = card;
  try {
    actTcg(() => playTcgCard(runtime.tcg, 0, card.instance_id, card.type.endsWith('_spell') ? target : null, lane));
  } finally {
    runtime.tcgPlayingCard = null;
  }
}

function bindTcgDrag(match, canStrike) {
  bindTableDrag(app.querySelector('.tcg-match'), {
    sources: '[data-card]:not(:disabled), [data-tcg-attacker]',
    read(element) {
      if (element.dataset.card) {
        const card = match.players[0].hand.find(item => item.instance_id === element.dataset.card);
        if (card && !tcgCardIssue(match, 0, card)) return { card, targets: tcgTablePlayTargets(match, card) };
      } else if (canStrike) {
        const unit = match.players[0].units.find(item => item.instance_id === element.dataset.tcgAttacker);
        if (unit && tcgCanAttack(unit)) return { unit, targets: tcgStrikeTargets(match, 0) };
      }
    },
    locate(source, element) {
      const anchor = element?.closest('[data-tcg-stack], [data-duel-id], [data-tcg-row], .duel-bottom');
      if (!anchor) return null;
      const id = anchor.dataset.duelId;
      const target = source.targets.find(item => {
        if (source.unit) return item.id === (id === 'commander:p1' ? 'commander' : id);
        if (source.card.type === 'unit') return item.lane === Number(anchor.dataset.tcgSummonLane);
        if (source.card.type === 'trap') return anchor.hasAttribute('data-tcg-set-slot');
        if (item.id === 'commander') return id === 'commander:p' + item.player;
        if (item.id === 'deck') return anchor.classList.contains('duel-bottom') || id === 'commander:p0';
        if (item.id === 'row') return Number(anchor.closest('[data-tcg-row]')?.dataset.tcgRow) === item.player;
        if (item.item) return anchor.hasAttribute('data-tcg-stack') && match.stack.at(-1)?.id === item.item.id;
        if (item.slot !== undefined) return id === tcgTrapAnchor(item.player, item.slot);
        return item.id === id;
      });
      return { element: anchor, state: target ? 'valid' : 'blocked', target };
    },
    drop(source, { target }) {
      if (source.card) return playTcgFromHand(source.card, target.id);
      runtime.selectedSpell = null;
      runtime.tcgStrike = { attacker: source.unit.instance_id, target: target.id };
      renderTcg();
      app.querySelector('[data-tcg-confirm-strike]')?.focus({ preventScroll: true });
    },
    preview({ card, unit }, ghost) {
      paintTableGhost(ghost, matchCardArt(card ?? unit), cardName(card ?? unit));
    },
  });
}

function openTcgSetup(match) {
  const dialog = openInfoDialog('Ván đấu thẻ mới', `
    <div class="challenge-pickers tcg-new-options"><label>Độ khó bot<select data-tcg-difficulty>${Object.entries(TCG_DIFFICULTIES).map(([id, label]) =>
      `<option value="${id}" ${(match.difficulty ?? 'normal') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label>Bộ bài bot<select data-tcg-opponent><option value="">Theo độ khó</option><option value="starter">Khởi đầu</option>${runtime.cards.presets.map(preset =>
      `<option value="${escapeAttr(preset.id)}">${escapeHtml(preset.name)}</option>`).join('')}</select></label></div>
    <p data-tcg-difficulty-detail></p><p data-tcg-opponent-detail></p>
    ${match.result ? '' : '<p>Ván hiện tại sẽ kết thúc khi bắt đầu ván mới.</p>'}
    <button type="button" class="button" data-tcg-start-match>Bắt đầu ván mới</button>`);
  const picker = dialog.querySelector('[data-tcg-difficulty]');
  const opponent = dialog.querySelector('[data-tcg-opponent]');
  const details = {
    normal: 'Bot triển khai quân sớm và tấn công khi có mục tiêu.',
    hard: 'Bot cân nhắc mục tiêu phép, giữ quân và chọn trao đổi có lợi.',
    extreme: 'Bot tính sát thương, phản đòn và ưu tiên cơ hội kết thúc ván.',
  };
  function update() {
    dialog.querySelector('[data-tcg-difficulty-detail]').textContent = details[picker.value];
    const id = opponent.value || tcgDefaultPreset(picker.value);
    const preset = runtime.cards.presets.find(item => item.id === id);
    dialog.querySelector('[data-tcg-opponent-detail]').textContent = preset ? `${preset.name} · ${preset.description}` : 'Bộ Khởi đầu phối hợp cả năm hệ.';
  }
  picker.addEventListener('change', update);
  opponent.addEventListener('change', update);
  dialog.querySelector('[data-tcg-start-match]').addEventListener('click', () => {
    runtime.tcg = startTcg(Date.now() % 999_983, picker.value, opponent.value);
    runtime.notice = '';
    dialog.close();
    saveNow();
    renderTcg();
  });
  update();
}

function actTcg(action) {
  try {
    runtime.tcg = runTcgBot(runBotPriority(action()), { yieldToPlayer: true });
    runtime.selectedSpell = null;
    runtime.selectedTarget = null;
    runtime.tcgStrike = null;
    runtime.notice = '';
    saveNow();
  } catch (error) {
    runtime.notice = error.message;
  }
  render();
}

function tcgTrapSlots(match, owner, targets) {
  const traps = match.players[owner].traps;
  const limit = tcgTrapLimit(match);
  return `<div class="trap-slots" role="group" aria-label="${traps.length} trên ${limit} ô bẫy">${Array.from({ length: limit }, (_, slot) => {
    const trap = traps[slot];
    const id = tcgTrapAnchor(owner, slot);
    const target = targets.find(target => target.player === owner && target.slot === slot);
    if (!trap && owner === 1) return `<span class="tcg-trap-slot empty" data-duel-id="${id}" aria-label="Ô bẫy địch trống">${tcgImpact(id)}</span>`;
    const visible = trap && (owner === 0 || !trap.faceDown);
    const concealed = trap && (usesTcgTable(match) ? trap.faceDown : !visible);
    const setting = !trap && owner === 0 && targets.some(target => target.id === 'set');
    const armed = trap && tcgTrapArmed(match, trap);
    const label = !trap ? 'Ô bẫy của bạn còn trống'
      : (visible ? cardName(trap.card) : 'Bẫy địch đang úp') + (armed ? ' · Sẵn sàng' : ' · Chờ đổi lượt');
    return `<button type="button" class="tcg-trap-slot ${trap ? 'set' : 'empty'} ${concealed ? 'tcg-card-back' : ''} ${armed ? 'armed' : ''} ${target ? 'spell-target' : ''}"
      data-duel-id="${id}" ${!trap && owner === 0 ? 'data-tcg-set-slot' : ''} aria-label="${escapeAttr(label)}" ${setting ? 'data-spell-target="set"' : target ? `data-spell-target="${escapeAttr(target.id)}" aria-pressed="${runtime.selectedTarget === target.id}"` : `data-tcg-slot="${owner}:${slot}"`}>
      ${concealed ? '<span aria-hidden="true">◆</span>' : visible ? `<img src="${escapeAttr(cardArt(trap.card))}" alt="">` : '+'}${tcgImpact(id)}
    </button>`;
  }).join('')}</div>`;
}

function showTcgTrapSlot(match, owner, slot) {
  const trap = match.players[owner].traps[slot];
  if (trap) {
    if (owner === 0 || !trap.faceDown) showTcgCard(trap.card.card_id);
    else openInfoDialog('Bẫy địch đang úp', `<p>${tcgTrapArmed(match, trap) ? 'Bẫy đã sẵn sàng.' : 'Bẫy sẵn sàng khi đổi lượt.'} Bạn có thể dùng phép Soi Dấu Bẫy để biết danh tính hoặc Phá Ấn Thất Vị để gỡ.</p>`);
    return;
  }
  const hand = match.players[0].hand.filter(card => card.type === 'trap');
  const options = hand.map(card => `<button type="button" class="button light" data-place-trap="${escapeAttr(card.instance_id)}" ${tcgCardIssue(match, 0, card) || match.mulliganDone === false && match.eventSeq === 0 ? 'disabled' : ''}>${escapeHtml(cardName(card))} · ${card.cost} mana</button>`).join('');
  const dialog = openInfoDialog('Đặt bẫy úp', hand.length ? `<div class="action-row">${options}</div>` : `<p>Chọn bẫy trên tay khi đến lượt triển khai. Bạn có ${tcgTrapLimit(match)} ô bẫy.</p>`);
  dialog.querySelectorAll('[data-place-trap]').forEach(button => button.addEventListener('click', () => {
    dialog.close();
    playTcgFromHand(hand.find(card => card.instance_id === button.dataset.placeTrap));
  }));
}

function tcgTrapPanel(match) {
  const { intent } = match.pendingTrap;
  const options = tcgTrapOptions(match);
  const threat = intent.when === 'attack_declared'
    ? tcgAttackLanes(match).map(({ unit }) => `${cardName(unit)} · ${tcgUnitAttack(unit)} ATK`).join(', ')
    : runtime.cards.cards.find(card => card.card_id === intent.cardId)?.display_name ?? '';
  return `<section class="tcg-reaction" aria-label="Cơ hội phản ứng">
    <header><strong>Cơ hội phản ứng</strong><span>${TCG_TRAP_LABELS[intent.when]}</span></header>
    <p class="trap-threat" title="${escapeAttr(threat)}">${escapeHtml(threat)}</p>
    <div class="trap-options" role="group" aria-label="Chọn bẫy">${options.map(({ card }, index) =>
      `<button type="button" class="trap-option element-${card.element}" data-tcg-trap-option="${escapeAttr(card.instance_id)}" aria-pressed="${index === 0}">
        <img src="${escapeAttr(cardArt(card))}" alt=""><span>${escapeHtml(cardName(card))}</span>
      </button>`).join('')}</div>
    <p class="trap-rule" data-tcg-trap-description>${escapeHtml(options.length ? tcgTrapRule(options[0].card) : '')}</p>
    <div class="match-actions trap-actions"><button type="button" class="button" data-tcg-activate-trap ${options.length ? '' : 'disabled'}>Kích hoạt bẫy</button>
      <button type="button" class="button light" data-tcg-hold-trap>Giữ bẫy</button></div>
  </section>`;
}

function bindTcgTrapPanel(match) {
  const options = tcgTrapOptions(match);
  let selected = options[0]?.card.instance_id;
  const buttons = [...app.querySelectorAll('[data-tcg-trap-option]')];
  for (const button of buttons) button.addEventListener('click', () => {
    selected = button.dataset.tcgTrapOption;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    const trap = options.find(option => option.card.instance_id === selected);
    app.querySelector('[data-tcg-trap-description]').textContent = tcgTrapRule(trap.card);
  });
  app.querySelector('[data-tcg-activate-trap]').addEventListener('click', () => {
    if (selected) actTcg(() => decideTcgTrap(runtime.tcg, 0, selected));
  });
  app.querySelector('[data-tcg-hold-trap]').addEventListener('click', () => actTcg(() => decideTcgTrap(runtime.tcg, 0)));
}

function showTcgRules() {
  openInfoDialog('Luật nhanh', `<ul class="tcg-quick-rules">
    <li>Triển khai bằng mana. Hai lá lộ hệ liên tiếp cùng hệ giảm 1 mana cho lá sau, một lần mỗi lượt. Úp bẫy ngắt chuỗi.</li>
    ${usesTcgTable(runtime.tcg)
      ? '<li>Bộ 24 lá. Đặt tối đa 4 Vị Linh và 1 bẫy. Kéo lá lên bàn hoặc chạm để chọn, sau đó xác nhận.</li><li>Mỗi Vị Linh sẵn sàng đánh một lần trong lượt. Chọn mục tiêu để xem sát thương. Hộ vệ phải bị đánh trước. Hai Vị Linh giao chiến sẽ đánh trả đồng thời.</li>'
      : '<li>Chọn quân đánh. Khi phòng thủ, chạm quân địch rồi chạm đồng minh để chặn. Quân bị trói không thể đánh hoặc chặn.</li>'}
    <li>Phép trong hàng chờ xử lý từ lá mới nhất. Tốc chú và Tức chú có thể phản ứng. Tức chú xử lý ngay.</li>
    <li>Bẫy sẵn sàng sau khi đổi lượt. Khi đúng điều kiện, chọn kích hoạt hoặc giữ lại. Đối thủ có thể phản ứng với bẫy đã lật.</li>
    ${usesTcgTable(runtime.tcg) ? '<li>Triệu hồi Vị Linh rồi dùng phép tương ứng ngay sau đó để kích hoạt combo. Mỗi combo dùng một lần trong lượt.</li>' : ''}
    <li>Tuyệt kỹ yêu cầu Vị Linh tương ứng còn trên bàn khi xử lý.</li></ul>`);
}

function showTcgStack(match) {
  openInfoDialog('Hàng chờ phản ứng', `<ol class="tcg-stack-list">${[...match.stack].reverse().map(({ card, owner }, index) =>
    `<li><img src="${escapeAttr(cardArt(card))}" alt=""><div><strong>${escapeHtml(cardName(card))}</strong>
      <small>${owner === 0 ? 'Của bạn' : 'Đối thủ'}${index === 0 ? ' · Xử lý trước' : ''}</small><p>${escapeHtml(tcgCardRule(card))}</p></div></li>`).join('')}</ol>`);
}

function tcgStageBanners(match) {
  const now = performance.now();
  const reveal = runtime.tcgReveal;
  const cut = runtime.tcgCutIn;
  const ultimate = cut?.matchId === match.battleId && cut.expires > now && runtime.cards.cards.find(card => card.card_id === cut.card_id);
  const trap = !ultimate && reveal?.matchId === match.battleId && reveal.expires > now && runtime.cards.cards.find(card => card.card_id === reveal.card_id);
  return `${trap ? `<div class="tcg-trap-flash element-${trap.element}" role="status" style="--flash-duration:${Math.round(reveal.expires - now)}ms">
    <img src="${escapeAttr(cardArt(trap))}" alt=""><span><small>${reveal.trigger === 'scout' ? 'Lộ bẫy' : 'Lật bẫy'}</small><b>${escapeHtml(cardName(trap))}</b></span></div>` : ''}
  ${ultimate ? `<div class="tcg-cutin element-${ultimate.element}" aria-hidden="true" style="--flash-duration:${Math.round(cut.expires - now)}ms">
    <img src="${cutinArt(cut.character_id)}" alt=""><strong>${escapeHtml(cardName(ultimate))}</strong></div>` : ''}`;
}

function tcgLanes(units, friendly, declared, blocked, targetIds, defending, canStrike, strikes) {
  const player = friendly ? 0 : 1;
  return Array.from({ length: tcgBoardLimit(runtime.tcg) }, (_, lane) => {
    const laneId = tcgLaneId(player, lane);
    const unit = units.find((candidate) => candidate.lane === lane);
    if (!unit) {
      const impact = runtime.tcgImpacts.get(laneId);
      const fallen = impact?.matchId === runtime.tcg.battleId && impact.expires > performance.now() ? impact.fallen : null;
      const summon = friendly && targetIds.has('lane:' + lane);
      const tag = summon ? 'button' : 'div';
      return `<${tag} class="empty-slot ${summon ? 'spell-target' : ''}" data-duel-id="${laneId}" ${friendly ? `data-tcg-summon-lane="${lane}"` : ''} ${summon ? `type="button" data-spell-target="lane:${lane}" aria-pressed="${runtime.selectedTarget === 'lane:' + lane}"` : ''} aria-label="Vị trí ${lane + 1} trống">
        ${fallen ? `<span class="tcg-unit-avatar tcg-fallen" style="--contact-delay:${Math.round(impact.contact - performance.now())}ms">${boardChibi(fallen.id, tcgSpriteKey(runtime.tcg.battleId, fallen.targetId), fallen.direction, '')}</span>` : ''}
        ${tcgImpact(laneId)}</${tag}>`;
    }
    const selectable = friendly && (canStrike || runtime.tcgAttackers) && tcgCanAttack(unit);
    const selected = Boolean(selectable && (runtime.tcgStrike?.attacker === unit.instance_id || runtime.tcgAttackers?.has(unit.instance_id)));
    const guard = unit.keywords?.includes('guard');
    const attacking = declared.has(unit.instance_id);
    const blocking = blocked.has(unit.instance_id);
    const badge = unit.rootedUntil ? 'Trói' : selected || attacking ? 'Tấn công' : blocking ? 'Chặn' : unit.ready ? 'Sẵn sàng' : 'Nghỉ';
    const mark = badge === 'Tấn công' ? '⚔' : badge === 'Chặn' ? '◆' : badge;
    const css = `tcg-unit element-${unit.element} ${friendly ? 'friendly' : ''} ${selected || attacking ? 'tcg-attacking' : ''} ${blocking ? 'tcg-blocking' : ''}`;
    const portrait = `<img src="${escapeAttr(cardArt(unit))}" alt="">`;
    const chibi = boardChibi(unit.character_id, tcgSpriteKey(runtime.tcg.battleId, unit.instance_id), friendly ? 'E' : 'W', portrait);
    const identity = `data-duel-id="${escapeAttr(unit.instance_id)}" data-ready="${tcgCanAttack(unit)}" data-rooted="${Boolean(unit.rootedUntil)}" ${guard ? 'data-guard' : ''}`;
    const atk = tcgUnitAttack(unit);
    const shield = unit.shield ? `<span class="lane-shield" title="Hộ thuẫn ${unit.shield}">+${unit.shield}</span>` : '';
    const content = `<span class="tcg-unit-avatar">${chibi}</span><b>${escapeHtml(cardName(unit))}</b>
      <span class="lane-stats" aria-label="${atk} tấn công, ${unit.current_def} phòng thủ${unit.shield ? ', ' + unit.shield + ' hộ thuẫn' : ''}"><b class="${unit.attackBuff ? 'lane-boost' : ''}">${atk}</b> / <b>${unit.current_def}</b>${shield}</span>
      <small class="lane-state" title="${badge}" aria-label="${badge}">${mark}</small>${guard ? '<span class="lane-guard" title="Hộ vệ" aria-label="Hộ vệ">◆</span>' : ''}${tcgImpact(unit.instance_id)}`;
    if (targetIds.has(unit.instance_id)) {
      return `<button type="button" class="${css} spell-target" ${identity} data-spell-target="${escapeAttr(unit.instance_id)}" aria-pressed="${runtime.selectedTarget === unit.instance_id}">${content}</button>`;
    }
    if (strikes.some(target => target.id === unit.instance_id)) {
      return `<button type="button" class="${css} strike-target" ${identity} data-tcg-strike-target="${escapeAttr(unit.instance_id)}" aria-pressed="${runtime.tcgStrike.target === unit.instance_id}">${content}</button>`;
    }
    if (defending && !friendly && attacking) return `<button type="button" class="${css}" ${identity} data-tcg-incoming="${lane}" aria-pressed="false">${content}</button>`;
    if (defending && friendly && tcgCanBlock(unit)) return `<button type="button" class="${css}" ${identity} data-tcg-defender="${escapeAttr(unit.instance_id)}" aria-pressed="false">${content}</button>`;
    return selectable
      ? `<button type="button" class="${css}" ${identity} data-tcg-attacker="${escapeAttr(unit.instance_id)}" aria-pressed="${selected}">${content}</button>`
      : `<div class="${css}" ${identity}>${content}</div>`;
  }).join('');
}

function tcgDefensePanel(attackers, defenders) {
  const units = defenders.filter(tcgCanBlock);
  return `<section class="tcg-defense" aria-label="Chọn quân chặn">
    <div class="tcg-defense-header"><strong>Chọn quân chặn</strong><span data-tcg-exposed role="status"></span></div>
    <div class="tcg-block-grid">${attackers.map(unit => `<label>
      <span>Đường ${unit.lane + 1} · ${escapeHtml(cardName(unit))} · ${tcgUnitAttack(unit)} ATK</span>
      <select data-tcg-block="${unit.lane}" data-damage="${tcgUnitAttack(unit)}">
        <option value="">Không chặn</option>
        ${units.map(blocker => `<option value="${escapeAttr(blocker.instance_id)}">${escapeHtml(cardName(blocker))} · ${tcgUnitAttack(blocker)}/${blocker.current_def}${blocker.shield ? ' +' + blocker.shield + ' khiên' : ''}</option>`).join('')}
      </select>
    </label>`).join('')}</div>
    <div class="tcg-defense-actions">
      <button type="button" class="button" data-tcg-confirm-block>Chốt phòng thủ</button>
      <button type="button" class="button light" data-tcg-hand>Bài trên tay</button>
    </div>
  </section>`;
}

function bindTcgDefense() {
  const fields = [...app.querySelectorAll('[data-tcg-block]')];
  const exposed = app.querySelector('[data-tcg-exposed]');
  const incoming = [...app.querySelectorAll('[data-tcg-incoming]')];
  const defenders = [...app.querySelectorAll('[data-tcg-defender]')];
  let lane = Number(fields[0]?.dataset.tcgBlock);
  const blocks = () => fields.filter(field => field.value)
    .map(field => ({ lane: Number(field.dataset.tcgBlock), blockerId: field.value }));
  function updateBlocks() {
    const selected = new Set(fields.map(field => field.value).filter(Boolean));
    for (const field of fields) {
      for (const option of field.options) option.disabled = option.value !== field.value && selected.has(option.value);
    }
    for (const button of incoming) button.setAttribute('aria-pressed', String(Number(button.dataset.tcgIncoming) === lane));
    for (const button of defenders) {
      const assigned = fields.find(field => field.value === button.dataset.tcgDefender);
      button.setAttribute('aria-pressed', String(Boolean(assigned)));
      button.dataset.blockLane = assigned ? String(Number(assigned.dataset.tcgBlock) + 1) : '';
    }
    const damage = tcgExposedDamage(declaredTcgAttackers(runtime.tcg), runtime.tcg.players[0].units, blocks());
    exposed.textContent = `Chủ soái dự kiến nhận ${damage} sát thương`;
  }
  for (const field of fields) field.addEventListener('change', () => { lane = Number(field.dataset.tcgBlock); updateBlocks(); });
  for (const button of incoming) button.addEventListener('click', () => { lane = Number(button.dataset.tcgIncoming); updateBlocks(); });
  for (const button of defenders) button.addEventListener('click', () => {
    const field = fields.find(field => Number(field.dataset.tcgBlock) === lane);
    if (!field) return;
    const id = button.dataset.tcgDefender;
    const same = field.value === id;
    for (const option of fields) if (option.value === id) option.value = '';
    const newOption = [...field.options].find(option => option.value === id);
    if (newOption) newOption.disabled = false;
    field.value = same ? '' : id;
    updateBlocks();
  });
  updateBlocks();
  app.querySelector('[data-tcg-confirm-block]').addEventListener('click', () => actTcg(() => assignTcgBlockers(runtime.tcg, 0, blocks())));
}

function renderDeck() {
  const slots = Array.from({ length: 4 }, (_, index) => runtime.save.tcgDecks?.[index]
    ?? (index === 0 && !runtime.save.tcgDecks ? runtime.save.tcgDeck ?? tcgTableDeck(runtime.cards) : null));
  const activeSlot = [0, 1, 2, 3].includes(runtime.save.tcgActiveDeck) ? runtime.save.tcgActiveDeck : 0;
  const slot = runtime.deckSlot ??= activeSlot;
  if (!runtime.deckDrafts.has(slot)) {
    runtime.deckDrafts.set(slot, tcgTableDraft(slots[slot], runtime.cards));
  }
  const draft = runtime.deckDrafts.get(slot);
  const count = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const filters = runtime.deckFilters;
  const curve = [0, 0, 0, 0, 0, 0];
  const totals = { unit: 0, spell: 0, trap: 0 };
  for (const card of runtime.cards.cards) {
    const copies = draft[card.card_id] ?? 0;
    curve[Math.min(5, card.cost)] += copies;
    totals[card.type.endsWith('_spell') ? 'spell' : card.type] += copies;
  }
  const library = [...runtime.cards.cards].sort((a, b) => a.cost - b.cost || a.display_name.localeCompare(b.display_name, 'vi'));
  shell(`${pageHeader('Thẻ chiến thuật', 'Bộ bài của bạn', 'Chọn 24 lá, tối đa hai bản sao mỗi lá.', 'tcg')}
    <section class="panel deck-editor">
      <div class="deck-workbench">
        <div class="deck-summary" data-deck-drop><div><strong>${count}/${TCG_TABLE_DECK_SIZE} lá</strong><small>${totals.unit} Vị Linh · ${totals.spell} phép · ${totals.trap} bẫy</small><small>Kéo thẻ vào đây để thêm.</small></div>
        <div class="deck-curve" role="group" aria-label="Phân bố mana">${curve.map((amount, index) =>
          `<span title="${amount} lá giá ${index === 5 ? '5+' : index} mana" aria-label="${index} mana, ${amount} lá"><i style="--card-share:${amount / Math.max(1, ...curve) * 100}%"></i><b>${index === 5 ? '5+' : index}</b></span>`).join('')}</div></div>
        <div class="action-row"><label class="tcg-setup">Ô bộ bài<select data-deck-slot>${slots.map((deck, index) =>
          `<option value="${index}" ${index === slot ? 'selected' : ''}>Bộ ${index + 1}${index === activeSlot ? ' · Đang dùng' : !deck ? ' · Trống' : ''}</option>`).join('')}</select></label>
          <button class="button" data-deck-save ${count === TCG_TABLE_DECK_SIZE ? '' : 'disabled'}>Lưu và dùng</button>
          <label class="tcg-setup"><span>Bộ mẫu</span><select data-deck-preset><option value="starter">Khởi đầu</option>${(runtime.cards.presets ?? []).map(preset => `<option value="${escapeAttr(preset.id)}">${escapeHtml(preset.name)}</option>`).join('')}</select></label>
          <button class="button light" data-deck-reset>Áp dụng</button><button class="button light" data-page="tcg">Về trận đấu</button></div>
      </div>
      <div class="deck-filters" role="group" aria-label="Lọc bộ bài">
        <input type="search" data-deck-search value="${escapeAttr(filters.search)}" placeholder="Tìm thẻ" aria-label="Tìm thẻ">
        <select data-deck-type aria-label="Loại thẻ"><option value="">Mọi loại</option>${Object.entries(CARD_TYPES).map(([id, label]) =>
          `<option value="${id}" ${filters.type === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <select data-deck-element aria-label="Hệ của thẻ"><option value="">Mọi hệ</option>${Object.entries(ELEMENT_NAMES).map(([id, label]) =>
          `<option value="${id}" ${filters.element === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <button class="button light" type="button" data-deck-view aria-pressed="${filters.view === 'draft'}">Trong bộ</button>
      </div>
      ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      <p data-deck-empty hidden>Không có thẻ khớp bộ lọc.</p>
      <div class="deck-grid">${library.map((card) => {
        const copies = draft[card.card_id] ?? 0;
        return `<article class="deck-card element-${card.element}" data-deck-entry="${card.card_id}"><img data-deck-drag="${card.card_id}" src="${escapeAttr(matchCardArt(card))}" alt="" loading="lazy"><div><button class="deck-card-name" type="button" data-view-tcg-card="${escapeAttr(card.card_id)}">${escapeHtml(cardName(card))}</button><small>${card.requires_character ? 'Tuyệt kỹ' : CARD_TYPES[card.type]} · ${card.cost} mana</small></div><div class="deck-count"><button class="button light" data-deck-id="${card.card_id}" data-change="-1" aria-label="Bớt ${escapeAttr(cardName(card))}" ${copies === 0 ? 'disabled' : ''}>−</button><b>${copies}</b><button class="button light" data-deck-id="${card.card_id}" data-change="1" aria-label="Thêm ${escapeAttr(cardName(card))}" ${copies === 2 || count >= TCG_TABLE_DECK_SIZE ? 'disabled' : ''}>+</button></div></article>`;
      }).join('')}</div>
    </section>`);
  const rows = [...app.querySelectorAll('[data-deck-entry]')];
  function filterCards() {
    const search = filters.search.trim().toLocaleLowerCase('vi');
    for (const [index, row] of rows.entries()) {
      const card = library[index];
      row.hidden = Boolean((filters.element && filters.element !== card.element)
        || (filters.type && filters.type !== card.type)
        || (filters.view === 'draft' && !draft[card.card_id])
        || (search && !card.display_name.toLocaleLowerCase('vi').includes(search)));
    }
    app.querySelector('[data-deck-empty]').hidden = rows.some(row => !row.hidden);
  }
  for (const key of ['search', 'type', 'element']) app.querySelector('[data-deck-' + key + ']').addEventListener('input', event => {
    filters[key] = event.target.value;
    filterCards();
  });
  app.querySelector('[data-deck-view]').addEventListener('click', event => {
    filters.view = filters.view === 'draft' ? 'all' : 'draft';
    event.currentTarget.setAttribute('aria-pressed', String(filters.view === 'draft'));
    filterCards();
  });
  filterCards();
  app.querySelector('[data-deck-slot]').addEventListener('change', event => {
    runtime.deckSlot = Number(event.target.value);
    runtime.notice = '';
    renderDeck();
  });
  app.querySelectorAll('[data-view-tcg-card]').forEach(button => button.addEventListener('click', () => showTcgCard(button.dataset.viewTcgCard)));
  app.querySelectorAll('[data-deck-id]').forEach((button) => button.addEventListener('click', () => {
    const { deckId, change } = button.dataset;
    draft[deckId] = (draft[deckId] ?? 0) + Number(change);
    renderDeck();
    app.querySelector(`[data-deck-id="${deckId}"][data-change="${change}"]:not(:disabled)`)?.focus();
  }));
  bindTableDrag(app.querySelector('.deck-editor'), {
    sources: '[data-deck-drag]',
    read: element => library.find(card => card.card_id === element.dataset.deckDrag),
    locate(card, element) {
      const anchor = element?.closest('[data-deck-drop]');
      return anchor && { element: anchor, state: count < TCG_TABLE_DECK_SIZE && (draft[card.card_id] ?? 0) < 2 ? 'valid' : 'blocked' };
    },
    drop(card) {
      draft[card.card_id] = (draft[card.card_id] ?? 0) + 1;
      renderDeck();
    },
    preview: (card, ghost) => paintTableGhost(ghost, matchCardArt(card), cardName(card)),
  });
  app.querySelector('[data-deck-reset]').addEventListener('click', () => {
    const preset = app.querySelector('[data-deck-preset]').value;
    const deck = tcgTableDeck(runtime.cards, preset);
    runtime.deckDrafts.set(slot, Object.fromEntries(deck.cards.map(({ card_id, count: amount }) => [card_id, amount])));
    runtime.notice = '';
    renderDeck();
    app.querySelector('[data-deck-preset]').value = preset;
  });
  app.querySelector('[data-deck-save]').addEventListener('click', () => {
    const deck = { ...runtime.deck, deck_id: 'deck_player_' + (slot + 1), catalog_version: runtime.cards.catalog_version, cards: Object.entries(draft).filter(([, amount]) => amount > 0).map(([card_id, amount]) => ({ card_id, count: amount })) };
    try {
      validateDeck(deck, runtime.cards, TCG_TABLE_DECK_SIZE);
      slots[slot] = deck;
      runtime.save.tcgDecks = slots;
      runtime.save.tcgActiveDeck = slot;
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

function openInfoDialog(title, body) {
  const menu = app.querySelector('.match-menu[open]');
  const previousFocus = menu?.querySelector('summary') ?? document.activeElement;
  if (menu) menu.open = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'game-info-dialog';
  dialog.setAttribute('aria-labelledby', 'game-info-title');
  dialog.innerHTML = `<header class="story-heading"><h2 id="game-info-title">${escapeHtml(title)}</h2>
    <button class="button light compact" type="button" data-close-info aria-label="Đóng" autofocus>×</button></header>${body}`;
  dialog.querySelector('[data-close-info]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    previousFocus?.focus({ preventScroll: true });
  });
  app.append(dialog);
  dialog.showModal();
  return dialog;
}

function renderChess() {
  if (!runtime.chess) runtime.chess = createChessRun(runtime.units, runtime.shopConfig, 2077);
  const run = runtime.chess;
  const replaying = Boolean(runtime.chessReplay);
  const locking = runtime.chessLock !== null;
  const preparing = run.phase === 'prepare' && !locking;
  if (!Number.isFinite(run.preparationSeconds)) run.preparationSeconds = CHESS_PREPARATION_SECONDS;
  const opponent = run.phase === 'prepare' ? nextChessOpponent(run)
    : run.result?.opponentId === 0 ? run.neutral : run.opponents.find(bot => bot.id === run.result?.opponentId);
  const opponentName = opponent?.neutral ? opponent.name : opponent ? 'Đối thủ ' + opponent.id : 'Đối thủ';
  const remaining = run.opponents.filter(bot => bot.hp > 0).length;
  const round = chessRoundInfo(run);
  const xp = chessXpNeeded(run);
  const traits = chessTraits(run.board);
  const activeTraits = Object.entries(CHESS_TRAITS).filter(([id]) => run.lobby || Object.hasOwn(ELEMENT_NAMES, id));
  const activeSynergies = activeTraits.filter(([id]) => traits.get(id) >= 2).length;
  const synergies = renderSynergies(traits, activeTraits);
  const boardCells = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7; const y = 3 - Math.floor(index / 7);
    const unitIndex = run.board.findIndex((unit) => unit.x === x && unit.y === y);
    const unit = run.board[unitIndex];
    const chibi = unit ? boardChibi(unit.id, `chess:${run.seed}:p:${unitIndex}:${unit.id}`, 'E', chessPortrait(unit)) : '';
    return `<button class="chess-cell ${run.lobby && y % 2 ? 'hex-offset' : ''} ${unit ? 'occupied element-' + unit.element : ''} ${runtime.selectedBench !== null && (unit || run.board.length < run.level) ? 'place-target' : ''} ${runtime.selectedBoard === unitIndex && unit ? 'selected' : ''}" data-cell="${x},${y}" ${preparing && unit ? `data-chess-board-index="${unitIndex}"` : ''} ${preparing ? '' : 'disabled'} aria-label="Ô ${x + 1}, ${y + 1}${unit ? ', ' + escapeAttr(unit.display_name) : ''}">${unit ? `${chibi}${chessStars(unit, x, y)}${chessEquipmentMarker(unit)}` : ''}</button>`;
  }).join('');
  const owned = [...run.board, ...run.bench];
  const shop = run.shop.map((unit, index) => {
    if (!unit) return '<div class="shop-unit shop-empty"><span>Trống</span></div>';
    const copies = owned.filter(member => member.id === unit.id && member.star === 1).length;
    const affordable = preparing && canBuyChessOffer(run, index);
    return `<button class="shop-unit element-${unit.element} ${copies === 2 ? 'merge-offer' : ''}" data-buy="${index}" ${affordable ? '' : 'disabled'}>
      <span class="shop-art"><img src="${escapeAttr(matchCardArt({ character_id: unit.id }))}" alt=""></span>
      <span class="shop-price" aria-label="${unit.cost} vàng">◈ ${unit.cost}</span>
      <span class="card-copy"><b>${escapeHtml(unit.display_name)}</b><small>${copies === 2 ? 'Hợp thể' : ELEMENT_NAMES[unit.element]}</small></span></button>`;
  }).join('');
  const bench = chessBenchSlots(run).map((index, slot) => {
    const unit = run.bench[index];
    const position = 'data-chess-bench-slot="' + slot + '"';
    return unit ? `<button class="bench-unit element-${unit.element} ${runtime.selectedBench === index ? 'selected' : ''}" data-bench="${index}" ${position} aria-label="${escapeAttr(unit.display_name)} · ${unit.star} sao">${chessPortrait(unit)}${chessStars(unit, null, null, slot)}${chessEquipmentMarker(unit)}</button>`
      : `<button type="button" class="bench-slot" ${position} aria-label="Ghế ${slot + 1} trống"></button>`;
  }).join('');
  const enemyCells = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7;
    const row = Math.floor(index / 7);
    const y = run.lobby ? row : 3 - row;
    const unit = opponent?.units.find(item => item.x === x && item.y === y);
    const chibi = unit ? boardChibi(unit.id, `chess:${run.seed}:rival:${opponent.id}:${index}:${unit.id}`, 'W', chessPortrait(unit)) : '';
    return `<div class="chess-cell rival-cell ${run.lobby && row % 2 === 0 ? 'hex-offset' : ''} ${unit ? 'occupied element-' + unit.element : ''}" ${unit ? `title="${escapeAttr(unit.display_name)} · ${unit.star}★"` : 'aria-hidden="true"'}>${unit ? `${chibi}<small>${unit.star}★</small>` : ''}</div>`;
  }).join('');
  const selectionHint = runtime.selectedBench !== null && run.board.length >= run.level ? 'Đổi với quân đang trên bàn'
    : runtime.selectedBench !== null || runtime.selectedBoard !== null ? 'Chọn vị trí để chuyển hoặc đổi quân'
    : run.bench.length ? 'Kéo quân hoặc chạm để xếp đội' : 'Mua quân để xếp đội';
  const result = run.phase === 'finished'
    ? `<div class="result-box ${run.result === 'victory' ? 'victory' : 'defeat'}"><strong>${run.placement ? run.placement === 1 ? 'Vô địch đấu trường' : 'Hạng ' + run.placement + '/8'
      : run.result === 'victory' ? remaining ? 'Thắng lượt chơi' : 'Vô địch đấu trường' : 'Lượt chơi đã kết thúc'}</strong><p>${run.wins} trận thắng · ${run.losses} trận thua · ${run.hp} HP chỉ huy còn lại.</p><button class="button" data-chess-new>Bắt đầu lượt chơi mới</button></div>`
    : run.result && !replaying ? `<div class="result-box ${run.result.won ? 'victory' : run.result.draw ? 'draw' : 'defeat'}">
      <strong>${run.result.won ? 'Chiến thắng' : run.result.draw ? 'Hòa' : 'Thất bại'}</strong>
      <p>${run.result.won ? opponent?.neutral ? 'Đã vượt vòng quái.' : `Đối thủ mất ${run.result.enemyDamage ?? 12} HP.`
        : run.result.draw ? 'Hai chỉ huy giữ nguyên HP.' : `Mất ${run.result.damage} HP.`} · +${run.result.income} vàng${run.result.payout ? ` (${run.result.payout.base} cơ bản · ${run.result.payout.win} thắng · ${run.result.payout.interest} lãi · ${run.result.payout.streak} chuỗi)` : ''}</p>
      ${run.result.rewardItem ? `<p>Nhặt được <b>${CHESS_ITEMS[run.result.rewardItem].name}</b>. Trang bị trong Túi vật phẩm ở vòng sau.</p>` : ''}
      <div class="action-row"><button class="button" data-chess-next>${run.hp <= 0 || !remaining || run.round >= (run.lobby?.max_rounds ?? 10) ? 'Xem kết quả' : 'Sang vòng tiếp'}</button>${run.combat?.startActors ? '<button class="button light" data-chess-replay>Xem lại</button>' : ''}</div></div>` : '';
  const hasSelection = runtime.selectedBench !== null || runtime.selectedBoard !== null;
  shell(`
    ${matchHeader('Đấu trường linh thú', `
      ${hasSelection ? '<button type="button" data-chess-inspect>Chi tiết quân đang chọn</button>' : ''}
      ${preparing && opponent ? '<button type="button" data-chess-scout>Do thám đội hình</button>' : ''}
      <button type="button" data-chess-standings>Bảng xếp hạng · ${remaining + Number(run.hp > 0)}/8</button>
      ${run.phase !== 'finished' ? '<button type="button" data-chess-reset>Ván mới</button>' : ''}
      ${hasSelection || !preparing ? `<button type="button" data-chess-synergy>Hiệp lực · ${activeSynergies}</button>` : ''}
      <button type="button" data-chess-log>Nhật ký</button>`)}
    <div class="chess-hud" aria-label="Trạng thái đấu trường">
      <div><small>${round.neutral ? 'Vòng quái' : 'Vòng'}</small><b>${run.lobby ? round.label : run.round + '/10'}</b></div>
      <div><small>Chỉ huy</small><b>${run.hp} HP</b></div>
      <div><small>Cấp ${run.level}</small><b>${xp ? `${run.experience}/${xp} XP` : 'Tối đa'}</b></div>
      <div><small>Vàng</small><b class="chess-gold">◈ ${run.gold}</b></div>
      <div><small>${locking ? 'Đã khóa' : preparing ? 'Chuẩn bị' : replaying ? 'Giao tranh' : 'Kết quả'}</small>
        ${preparing ? `<b class="${run.preparationSeconds <= 5 ? 'clock-urgent' : ''}" data-chess-clock role="timer">${Math.ceil(run.preparationSeconds)} s</b>` : `<b>${run.wins}T · ${run.losses}B</b>`}</div>
    </div>
    <div class="match-layout chess-match"><section class="chess-stage" aria-label="Bàn cờ">
      ${replaying ? '<div class="chess-replay-stage"><canvas class="chess-replay" id="chess-replay" width="760" height="480" aria-label="Giao tranh Auto Chess"></canvas></div>'
        : `<div class="chess-formation ${run.lobby ? 'chess-hex' : ''}">
          <div class="formation-label rival-label">${escapeHtml(opponentName)}${opponent ? `${opponent.neutral ? '' : ` <span>${opponent.hp} HP</span>`}<span class="rival-lineup" aria-hidden="true">${opponent.units.map(chessPortrait).join('')}</span>` : ''}</div>
          <div class="chess-grid enemy-formation" role="group" aria-label="Nửa bàn đối thủ">${enemyCells}</div>
          <div class="formation-divider" aria-hidden="true"><i>◆</i></div>
          <div class="chess-grid player-formation" role="group" aria-label="Nửa bàn của bạn, 7 cột 4 hàng">${boardCells}</div>
          <div class="formation-label">Đội hình <span>${run.board.length}/${run.level} quân</span></div>
        </div>`}
      ${preparing ? `<div class="chess-bench"><div class="bench-heading"><strong>Băng ghế · ${run.bench.length}/9</strong>${run.lobby ? `<button type="button" class="chess-bag" data-chess-items>Túi vật phẩm · ${run.items.length}</button>` : ''}</div><div class="bench-row" data-chess-bench-zone>${bench}</div></div>` : ''}
    </section><section class="match-command chess-controls" aria-label="Điều khiển đấu cờ">
      ${result}
      ${replaying ? '<div class="replay-controls"><progress data-chess-replay-progress max="1" value="0" aria-label="Tiến độ giao tranh"></progress><div class="match-actions"><button class="button light" data-chess-pause>Tạm dừng</button><button class="button light" data-chess-speed aria-pressed="false">2×</button><button class="button" data-chess-skip>Bỏ qua</button></div></div>' : ''}
      ${preparing ? `<div class="shop-heading"><strong>Cửa hàng</strong><span>${hasSelection ? selectionHint : `${run.shopLocked ? 'Đã khóa · ' : ''}Lãi +${Math.min(Math.floor(run.gold / 10), 5)} ◈`}</span></div>
      <div class="shop-row">${shop}</div><div class="match-actions shop-tools">
        <button class="button light" data-chess-refresh ${run.gold < 2 || run.shopLocked ? 'disabled' : ''}>Làm mới · 2 ◈</button>
        <button class="button light" data-chess-xp ${run.gold < 4 || run.level >= 9 ? 'disabled' : ''}>${run.lobby ? '+4 XP' : 'Nâng cấp'} · 4 ◈</button>
        <button class="button light" data-chess-lock aria-pressed="${run.shopLocked}">${run.shopLocked ? 'Mở khóa' : 'Khóa chợ'}</button>
      </div>
      <div class="match-actions chess-ready ${runtime.selectedBoard !== null ? 'has-board-selection' : ''}">
        ${hasSelection ? `${runtime.selectedBoard !== null ? `<button class="button light" data-chess-bench ${run.bench.length >= 9 ? 'disabled' : ''}>Rút về ghế</button>` : ''}
          <button class="button danger" data-chess-sell data-chess-sell-zone>Bán quân</button>` : `<button type="button" class="button light" data-chess-synergy>Hiệp lực · ${activeSynergies}</button><span class="chess-sell-zone" data-chess-sell-zone>Kéo để bán</span>`}
        <button class="button" data-chess-fight ${!run.board.length || !opponent ? 'disabled' : ''}>Chiến đấu</button>
      </div>` : ''}
      ${locking ? '<p class="match-hint" role="status">Đang vào giao tranh…</p>' : ''}
      ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
    </section></div>
  `);
  app.querySelector('[data-chess-log]').addEventListener('click', () => openInfoDialog('Nhật ký đấu trường', renderTextLog(run.log)));
  app.querySelector('[data-chess-standings]').addEventListener('click', () => showChessStandings(run));
  app.querySelector('[data-chess-items]')?.addEventListener('click', () => showChessItems(run));
  app.querySelector('[data-chess-reset]')?.addEventListener('click', () => {
    const dialog = openInfoDialog('Ván đấu cờ mới', '<p>Ván đang chơi sẽ kết thúc. Bắt đầu lại với bàn lục giác và bảy đối thủ bot.</p><button type="button" class="button" data-chess-confirm-new>Bắt đầu ván mới</button>');
    dialog.querySelector('[data-chess-confirm-new]').addEventListener('click', () => {
      dialog.close();
      startNewChessRun();
    });
  });
  app.querySelector('[data-chess-synergy]')?.addEventListener('click', () => openInfoDialog('Hiệp lực đội hình', synergies));
  if (preparing) bindChessDrag(run);
  if (replaying) {
    app.querySelector('[data-chess-pause]').textContent = runtime.chessReplayPaused ? 'Tiếp tục' : 'Tạm dừng';
    app.querySelector('[data-chess-speed]').setAttribute('aria-pressed', String(runtime.chessReplaySpeed === 2));
    runtime.chessReplay.draw(app.querySelector('#chess-replay'));
  }
  app.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => updateChess(() => buyChessOffer(runtime.chess, Number(button.dataset.buy)))));
  app.querySelectorAll('[data-chess-bench-slot]').forEach(button => button.addEventListener('click', () => {
    const slot = Number(button.dataset.chessBenchSlot);
    const source = selectedChessSource();
    if (source) updateChess(() => arrangeChessUnit(run, source, { zone: 'bench', slot }));
    else if (button.hasAttribute('data-bench')) { runtime.selectedBench = Number(button.dataset.bench); renderChess(); }
  }));
  app.querySelector('[data-chess-inspect]')?.addEventListener('click', () => showChessUnit(run, selectedChessSource()));
  app.querySelectorAll('[data-cell]').forEach((button) => button.addEventListener('click', () => onChessCell(button.dataset.cell)));
  app.querySelector('[data-chess-refresh]')?.addEventListener('click', () => updateChess(() => refreshChessShop(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-lock]')?.addEventListener('click', () => updateChess(() => toggleChessLock(runtime.chess)));
  app.querySelector('[data-chess-bench]')?.addEventListener('click', () => updateChess(() => benchChessUnit(runtime.chess, runtime.selectedBoard)));
  app.querySelector('[data-chess-scout]')?.addEventListener('click', () => showChessScout(opponent, Boolean(run.lobby)));
  app.querySelector('[data-chess-sell]')?.addEventListener('click', sellSelectedChessUnit);
  app.querySelector('[data-chess-xp]')?.addEventListener('click', () => updateChess(() => buyChessExperience(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-fight]')?.addEventListener('click', lockChessRound);
  app.querySelector('[data-chess-replay]')?.addEventListener('click', () => { startChessReplay(run.combat); renderChess(); });
  app.querySelector('[data-chess-skip]')?.addEventListener('click', () => { runtime.chessReplay = null; renderChess(); });
  app.querySelector('[data-chess-pause]')?.addEventListener('click', event => {
    runtime.chessReplayPaused = !runtime.chessReplayPaused;
    event.currentTarget.textContent = runtime.chessReplayPaused ? 'Tiếp tục' : 'Tạm dừng';
  });
  app.querySelector('[data-chess-speed]')?.addEventListener('click', event => {
    runtime.chessReplaySpeed = runtime.chessReplaySpeed === 2 ? 1 : 2;
    event.currentTarget.setAttribute('aria-pressed', String(runtime.chessReplaySpeed === 2));
  });
  app.querySelector('[data-chess-next]')?.addEventListener('click', () => updateChess(() => advanceChessRound(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-new]')?.addEventListener('click', startNewChessRun);
  saveNow();
}

function startNewChessRun() {
  runtime.chess = createChessRun(runtime.units, runtime.shopConfig, Date.now() % 999_983);
  runtime.chessUpgrade = null;
  runtime.selectedBench = null;
  runtime.selectedBoard = null;
  runtime.chessLock = null;
  runtime.chessReplay = null;
  runtime.notice = '';
  saveNow();
  render();
}

function lockChessRound() {
  if (runtime.chess.phase !== 'prepare' || runtime.chessLock !== null) return;
  runtime.chess.preparationSeconds = 0;
  runtime.chessLock = 1;
  renderChess();
}

function updateChessClock(delta) {
  const run = runtime.chess;
  if (run?.phase !== 'prepare' || document.hidden || app.querySelector('dialog[open]')) return;
  if (runtime.chessLock !== null) {
    runtime.chessLock = Math.max(0, runtime.chessLock - delta);
    if (runtime.chessLock === 0) {
      runtime.chessLock = null;
      updateChess(() => {
        const resolved = startChessCombat(run);
        startChessReplay(resolved.combat);
        return resolved;
      });
    }
    return;
  }
  run.preparationSeconds = Math.max(0, run.preparationSeconds - delta);
  const display = app.querySelector('[data-chess-clock]');
  const seconds = Math.ceil(run.preparationSeconds);
  if (display && display.textContent !== seconds + ' s') {
    display.textContent = seconds + ' s';
    display.classList.toggle('clock-urgent', seconds <= 5);
    if (seconds % 5 === 0) saveNow();
  }
  if (run.preparationSeconds === 0) lockChessRound();
}

function bindChessDrag(run) {
  bindTableDrag(app.querySelector('.chess-match'), {
    sources: '[data-chess-board-index], [data-bench]',
    read(element) {
      const { chessBoardIndex, bench } = element.dataset;
      return chessBoardIndex !== undefined ? { zone: 'board', index: Number(chessBoardIndex) } : { zone: 'bench', index: Number(bench) };
    },
    locate(source, element) {
      const destination = element?.closest('[data-cell], [data-chess-bench-slot], [data-chess-sell-zone]');
      if (!destination) return null;
      if (destination.hasAttribute('data-chess-sell-zone')) return { element: destination, zone: 'sell', state: 'sell' };
      const { cell, chessBenchSlot } = destination.dataset;
      const [x, y] = cell?.split(',').map(Number) ?? [];
      const place = cell ? { zone: 'board', x, y } : { zone: 'bench', slot: Number(chessBenchSlot) };
      return { element: destination, state: chessDropState(run, source, place), ...place };
    },
    drop(source, destination) {
      updateChess(() => destination.zone === 'sell' ? sellChessUnit(run, source.zone, source.index) : arrangeChessUnit(run, source, destination));
    },
    inspect: source => showChessUnit(run, source),
    preview(source, ghost) {
      const unit = run[source.zone][source.index];
      paintTableGhost(ghost, cardArt({ character_id: unit.id }), unit.display_name + ' ' + '★'.repeat(unit.star));
    },
  });
}

function selectedChessSource() {
  if (runtime.selectedBench !== null) return { zone: 'bench', index: runtime.selectedBench };
  if (runtime.selectedBoard !== null) return { zone: 'board', index: runtime.selectedBoard };
  return null;
}

function chessStars(unit, x, y, benchSlot = null) {
  const upgrade = runtime.chessUpgrade;
  const animating = upgrade?.expires > performance.now() && upgrade.unit_id === unit.id && upgrade.star === unit.star
    && (benchSlot === null ? upgrade.x === x && upgrade.y === y : upgrade.bench_slot === benchSlot);
  return `<small class="chess-stars" aria-label="${unit.star} sao">${'★'.repeat(unit.star)}</small>${animating ? '<span class="chess-star-up" aria-hidden="true">✦</span>' : ''}`;
}

function showChessUnit(run, source) {
  const unit = source && run[source.zone][source.index];
  if (!unit) return;
  const copies = [...run.board, ...run.bench].filter(other => other.id === unit.id && other.star === unit.star).length;
  openInfoDialog(unit.display_name, `<div class="inspect-tcg">${chessPortrait(unit)}<div><strong>${'★'.repeat(unit.star)} · Hệ ${ELEMENT_NAMES[unit.element]}</strong>
    <p>${unit.star < 3 ? `Đang có ${copies}/3 quân cùng số sao để hợp thể.` : 'Đã đạt 3 sao.'}</p>
    <p>${unit.maxHp} HP · ${unit.atk} ATK · ${unit.def} DEF${unit.items?.length ? ' · ' + unit.items.map(id => escapeHtml(CHESS_ITEMS[id]?.name ?? id)).join(', ') : ''}</p></div></div>`);
}

function chessEquipmentMarker(unit) {
  if (!unit.items?.length) return '';
  const names = unit.items.map(id => CHESS_ITEMS[id]?.name).filter(Boolean);
  return `<span class="chess-item-marker" title="${escapeAttr(names.join(' · '))}" aria-label="${escapeAttr(names.join(', '))}">✦ ${names.length}</span>`;
}

function showChessStandings(run) {
  const dialog = openInfoDialog('Bảng xếp hạng', `<ol class="chess-standings">${chessStandings(run).map(player =>
    `<li class="${player.id === 0 ? 'own' : ''}"><strong>${player.id === 0 ? 'Bạn' : 'Bot ' + player.id}</strong>
      <span>${player.hp > 0 ? player.hp + ' HP' : 'Đã bị loại'}${player.level ? ' · Cấp ' + player.level : ''}</span>
      ${player.id > 0 && player.hp > 0 ? `<button type="button" class="button light compact" data-scout-standing="${player.id}">Do thám</button>` : ''}</li>`).join('')}</ol>`);
  for (const button of dialog.querySelectorAll('[data-scout-standing]')) {
    button.addEventListener('click', () => {
      const opponent = run.opponents.find(bot => bot.id === Number(button.dataset.scoutStanding));
      dialog.close();
      showChessScout(opponent, Boolean(run.lobby));
    });
  }
}

function showChessItems(run) {
  const candidates = ['board', 'bench'].flatMap(zone => run[zone].map((unit, index) => ({ zone, index, unit })));
  if (!run.items.length || !candidates.length) {
    openInfoDialog('Túi vật phẩm', `<p>${run.items.length ? 'Mua một Vị Linh để trang bị.' : 'Thắng vòng quái để nhận linh kiện.'}</p><p>Hai linh kiện tương thích trên cùng một quân sẽ tự ghép. Mỗi quân mang tối đa ba món.</p>`);
    return;
  }
  const dialog = openInfoDialog('Túi vật phẩm', `<div class="challenge-pickers">
    <label>Vị Linh<select data-chess-gear-unit>${candidates.map(({ zone, index, unit }) =>
      `<option value="${zone}:${index}">${escapeHtml(unit.display_name)} · ${unit.star}★ · ${zone === 'board' ? 'Trên bàn' : 'Ghế'}</option>`).join('')}</select></label>
    <label>Linh kiện<select data-chess-gear-item>${run.items.map((id, index) =>
      `<option value="${index}">${CHESS_ITEMS[id].icon} ${CHESS_ITEMS[id].name}</option>`).join('')}</select></label>
    </div><p data-chess-item-detail aria-live="polite"></p><button class="button" data-chess-equip>Trang bị</button>`);
  const unitPicker = dialog.querySelector('[data-chess-gear-unit]');
  const itemPicker = dialog.querySelector('[data-chess-gear-item]');
  const description = dialog.querySelector('[data-chess-item-detail]');
  const equip = dialog.querySelector('[data-chess-equip]');
  if (runtime.selectedBoard !== null) unitPicker.value = 'board:' + runtime.selectedBoard;
  else if (runtime.selectedBench !== null) unitPicker.value = 'bench:' + runtime.selectedBench;
  function selection() {
    const [zone, index] = unitPicker.value.split(':');
    return { zone, index: Number(index), item: Number(itemPicker.value) };
  }
  function update() {
    const { zone, index, item } = selection();
    const unit = run[zone][index];
    const placement = chessItemPlacement(unit, run.items[item]);
    const held = (unit.items ?? []).map(id => CHESS_ITEMS[id].name).join(', ');
    equip.disabled = !placement;
    const names = { atk: 'ATK', def: 'DEF', maxHp: 'HP' };
    const stats = placement ? Object.entries(CHESS_ITEMS[placement.id].stats).map(([key, value]) => '+' + value + ' ' + names[key]).join(' · ') : '';
    description.textContent = (held ? 'Đang mang ' + held + '. ' : '') + (!placement ? 'Đã đủ ba món.'
      : placement.id === run.items[item] ? stats : 'Ghép thành ' + CHESS_ITEMS[placement.id].name + ' · ' + stats);
  }
  dialog.addEventListener('change', update);
  equip.addEventListener('click', () => {
    const { zone, index, item } = selection();
    dialog.close();
    updateChess(() => equipChessItem(runtime.chess, zone, index, item));
  });
  update();
}

function showChessScout(opponent, hex = false) {
  if (!opponent) return;
  const tiles = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7;
    const row = Math.floor(index / 7);
    const y = hex ? row : 3 - row;
    const unit = opponent.units.find(item => item.x === x && item.y === y);
    return `<div class="chess-scout-cell ${hex && row % 2 === 0 ? 'hex-offset' : ''}" ${unit ? `title="${escapeAttr(unit.display_name)} · ${unit.star}★"` : 'aria-hidden="true"'}>${unit ? `${chessPortrait(unit)}<b>${unit.star}★</b>${chessEquipmentMarker(unit)}` : ''}</div>`;
  });
  const roster = opponent.units.map(unit => `<li><strong>${escapeHtml(unit.display_name)}</strong><span>${unit.star}★ · ${unit.hp} HP · ${unit.atk} ATK
    ${unit.items?.length ? ' · ' + escapeHtml(unit.items.map(id => CHESS_ITEMS[id]?.name).filter(Boolean).join(', ')) : ''}</span></li>`);
  openInfoDialog(opponent.neutral ? opponent.name : `Do thám đối thủ ${opponent.id}`, `<p>${opponent.neutral ? 'Vượt vòng để nhận linh kiện' : opponent.hp + ' HP chỉ huy'} · Hàng cuối gần đội bạn nhất</p>
    <div class="chess-scout-grid ${hex ? 'chess-hex' : ''}" aria-label="Nửa bàn 7 cột, 4 hàng của đối thủ">${tiles.join('')}</div><ul class="chess-scout-roster">${roster.join('')}</ul>`);
}

function chessPortrait(unit) {
  return `<img class="chess-portrait" src="${escapeAttr(cardArt({ character_id: unit.id }))}" alt="">`;
}

function startChessReplay(combat) {
  runtime.chessReplay = new ChessReplay(combat, spriteRenderer, app.dataset.motion === 'reduced');
  runtime.chessReplayPaused = false;
  runtime.chessReplaySpeed = 1;
}

function drawChessReplay(delta) {
  const canvas = app.querySelector('#chess-replay');
  if (!canvas || !runtime.chessReplay) return;
  if (runtime.chessReplayPaused) return;
  const replay = runtime.chessReplay;
  const ended = replay.advance(delta * runtime.chessReplaySpeed, event => runtime.audio.handle(event));
  replay.draw(canvas);
  app.querySelector('[data-chess-replay-progress]').value = Math.min(1, replay.elapsed / replay.duration);
  if (ended) {
    runtime.chessReplay = null;
    if (runtime.chess.result?.won) runtime.audio.play('sfx_victory');
    renderChess();
  }
}

function onChessCell(coordinates) {
  const [x, y] = coordinates.split(',').map(Number);
  const source = selectedChessSource();
  if (source) updateChess(() => arrangeChessUnit(runtime.chess, source, { zone: 'board', x, y }));
  else {
    const index = runtime.chess.board.findIndex(unit => unit.x === x && unit.y === y);
    if (index >= 0) { runtime.selectedBoard = index; renderChess(); }
  }
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

function renderSynergies(counts, traits) {
  return `<div class="synergy-list">${traits.map(([element, trait]) => {
    const count = counts.get(element) ?? 0;
    return `<div class="synergy-row ${count >= 2 ? 'active' : ''}"><i class="element-dot" style="background:${elementColors[element] ?? '#b59660'}"></i><div><strong>${trait.name}</strong><small>${trait.detail}</small></div><b>${Math.min(2, count)}/2</b></div>`;
  }).join('')}</div>`;
}

const SPIRIT_TABS = { info: 'Thông tin', skills: 'Kỹ năng', gear: 'Trang bị', bond: 'Quan hệ' };
const SPIRIT_ROLES = { fighter: 'Đấu sĩ', mage: 'Pháp sư', support: 'Hỗ trợ', guardian: 'Hộ vệ', assassin: 'Sát thủ' };

function renderRoster() {
  const { save } = runtime;
  const member = save.roster.find(actor => actor.id === runtime.rosterId) ?? save.roster[0];
  const profile = spiritProfile(save, member.id);
  const battleActive = Boolean(runtime.adventure.battle);
  const name = characterNames[member.id];
  const title = `Hệ ${ELEMENT_NAMES[member.element]} · ${SPIRIT_ROLES[member.role]}`;
  shell(`${pageHeader('Phiêu lưu', 'Hồ sơ Vị Linh', '', 'adventure')}
    <section class="panel spirit-profile">
      <div class="spirit-portrait" style="--unit-color:${elementColors[member.element]}">
        <img src="${escapeAttr(actorArt(member.id))}" alt="">
        <div class="spirit-portrait-label"><span>${title}</span><h2>${escapeHtml(name)}</h2></div>
      </div>
      <div class="spirit-detail">
        <div class="spirit-tabs" role="group" aria-label="Mục hồ sơ">${Object.entries(SPIRIT_TABS).map(([id, label]) =>
          `<button class="button light" data-spirit-tab="${id}" aria-pressed="${runtime.rosterTab === id}">${label}</button>`).join('')}</div>
        <div class="spirit-tab-body">${renderSpiritTab(member, profile, battleActive)}</div>
        ${battleActive && runtime.rosterTab !== 'skills' ? '<p class="muted-copy">Kết thúc trận Adventure để nâng cấp, đổi trang bị hoặc tặng quà.</p>' : ''}
        ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      </div>
      <div class="spirit-picker" role="group" aria-label="Chọn Vị Linh">${save.roster.map(actor =>
        `<button class="spirit-choice" data-spirit-choice="${escapeAttr(actor.id)}" aria-pressed="${actor.id === member.id}">
          <img src="${escapeAttr(actorArt(actor.id))}" alt=""><span>${escapeHtml(characterNames[actor.id])}</span></button>`).join('')}</div>
    </section>`);
  app.querySelectorAll('[data-spirit-choice], [data-spirit-tab]').forEach(button => button.addEventListener('click', () => {
    const { spiritChoice, spiritTab } = button.dataset;
    if (spiritChoice) runtime.rosterId = spiritChoice;
    if (spiritTab) runtime.rosterTab = spiritTab;
    runtime.notice = '';
    renderRoster();
    app.querySelector(`[data-${spiritChoice ? 'spirit-choice' : 'spirit-tab'}="${CSS.escape(spiritChoice ?? spiritTab)}"]`)?.focus({ preventScroll: true });
  }));
  app.querySelectorAll('[data-spirit-action]').forEach(button => button.addEventListener('click', () => {
    const { spiritAction: type, gearId } = button.dataset;
    try {
      runtime.save = changeSpiritProgress(runtime.save, { type, id: member.id, gearId }, Boolean(runtime.adventure.battle));
      saveNow();
      runtime.audio.play('sfx_ui_confirm');
      runtime.notice = ({ rank: 'Đã nâng cấp Vị Linh.', craft: 'Đã chế tác và đưa vào kho.', equip: 'Đã trang bị.', unequip: 'Đã đưa trang bị về kho.', gift: 'Mức quan hệ đã tăng.' })[type];
    } catch (error) {
      runtime.notice = error.message;
    }
    renderRoster();
    app.querySelector('[data-spirit-tab][aria-pressed="true"]')?.focus({ preventScroll: true });
  }));
}

function renderSpiritTab(member, profile, battleActive) {
  const { save } = runtime;
  if (runtime.rosterTab === 'skills') {
    const skill = adventureBalance.ultimates[member.id];
    return `<div class="spirit-skill"><img src="${effectArt(member.element, 'impact')}" alt=""><div><h3>${skill.name}</h3>
      <p>${skill.description}</p><small>100 năng lượng · hồi ${adventureBalance.ultimateCooldown / ADVENTURE_TICK_RATE} giây</small></div></div>
      <p class="muted-copy">Đòn thường tự dùng trong tầm. Chạm tuyệt kỹ của Vị Linh trong trận khi đã nạp đủ năng lượng.</p>`;
  }
  if (runtime.rosterTab === 'gear') {
    const { ownedGear, profiles } = save.adventure.spirits;
    return `<h3>Kho trang bị · ${ownedGear.length}/${Object.keys(SPIRIT_GEAR).length}</h3>
      <div class="spirit-gear-grid">${Object.entries(SPIRIT_GEAR).map(([id, gear]) => {
        const owner = save.roster.find(actor => profiles[actor.id]?.equipped.includes(id));
        let action = 'craft';
        let label = 'Chế tác · ' + spiritCostLabel(gear.cost);
        let disabled = battleActive || !canAffordSpiritCost(save.player, gear.cost);
        if (ownedGear.includes(id)) {
          action = owner?.id === member.id ? 'unequip' : 'equip';
          label = action === 'unequip' ? 'Tháo' : owner ? 'Đang dùng' : 'Trang bị';
          disabled = battleActive || Boolean(owner && owner.id !== member.id);
        }
        return `<div class="spirit-gear-item"><span aria-hidden="true">${gear.symbol}</span><div><small>${gear.slot}</small><strong>${gear.name}</strong><small>${gear.detail}${owner ? ' · ' + escapeHtml(characterNames[owner.id]) : ''}</small></div>
          <button class="button light" data-spirit-action="${action}" data-gear-id="${id}" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
      }).join('')}</div>`;
  }
  if (runtime.rosterTab === 'bond') {
    const essence = SPIRIT_GIFTS[profile.bond];
    return `<h3>${SPIRIT_BONDS[profile.bond]}</h3>
      <progress max="${SPIRIT_GIFTS.length}" value="${profile.bond}" aria-label="Mức quan hệ"></progress>
      <p>${profile.bond >= 2 ? escapeHtml(SPIRIT_MEMORIES[member.id]) : 'Tặng quà để mở ký ức khi đạt mức Tin cậy.'}</p>
      ${essence ? `<button class="button" data-spirit-action="gift" ${battleActive || save.player.essence < essence ? 'disabled' : ''}>Tặng quà · ${essence} ✦</button>` : ''}`;
  }
  const stats = adventureSpiritStats(member, profile);
  const cost = SPIRIT_RANKS[profile.rank - 1];
  const next = cost ? adventureSpiritStats(member, profile, profile.rank + 1) : stats;
  const values = [['HP tối đa', stats.maxHp, next.maxHp], ['ATK', stats.atk, next.atk], ['DEF', stats.def, next.def],
    ['Tốc độ/giây', Math.round(stats.speed * ADVENTURE_TICK_RATE), Math.round(next.speed * ADVENTURE_TICK_RATE)]];
  return `<div class="spirit-rank"><strong>Cấp ${profile.rank}/${MAX_SPIRIT_RANK}</strong><progress max="${MAX_SPIRIT_RANK}" value="${profile.rank}" aria-label="Cấp Vị Linh"></progress></div>
    <dl class="spirit-stats">${values.map(([label, current, upgraded]) => `<div><dt>${label}</dt><dd><b>${current.toLocaleString('vi')}</b>${upgraded > current ? ` <small>→ ${upgraded.toLocaleString('vi')}</small>` : ''}</dd></div>`).join('')}</dl>
    ${cost ? `<button class="button" data-spirit-action="rank" ${battleActive || !canAffordSpiritCost(save.player, cost) ? 'disabled' : ''}>Nâng cấp · ${spiritCostLabel(cost)}</button>` : '<p>Đã đạt cấp tối đa.</p>'}`;
}

function spiritCostLabel(cost) { return `${cost.gold} ◈ + ${cost.essence} ✦`; }

function renderSettings() {
  const settings = runtime.save.settings;
  const guestActions = runtime.cloud ? '' : '<div class="action-row"><button class="button light" data-page="title">Về màn hình bắt đầu</button><button class="button danger" data-reset-save>Khởi tạo lại tiến trình</button></div>';
  const cloudPanel = runtime.cloud ? `<section class="settings-list panel cloud-panel"><h2>Tài khoản ${escapeHtml(runtime.account.username)}</h2><p>Tiến trình luyện tập lưu trên máy chủ.</p><p role="status" data-cloud-status></p><div class="action-row"><button class="button light" data-cloud-action="retry" hidden>Thử lưu lại</button><button class="button light" data-cloud-action="reload" hidden>Tải bản trên máy chủ</button><button class="button light" data-cloud-action="reauth" hidden>Đăng nhập lại</button><button class="button danger" data-cloud-action="logout">Lưu và đăng xuất</button></div></section>` : '';
  shell(`${pageHeader(runtime.cloud ? 'Tài khoản' : 'Thiết bị này', 'Cài đặt', '', 'home')}<section class="settings-list panel">${[['music', 'Nhạc'], ['sfx', 'Hiệu ứng'], ['ambience', 'Môi trường']].map(([key, label]) => `<label class="setting-row"><span>${label}</span><input type="range" min="0" max="100" value="${settings[key]}" data-setting="${key}"><b>${settings[key]}%</b></label>`).join('')}<label class="setting-row"><span>Giảm chuyển động</span><input type="checkbox" data-setting-motion ${settings.reducedMotion ? 'checked' : ''}><b>${settings.reducedMotion ? 'Bật' : 'Tắt'}</b></label>${guestActions}</section>${cloudPanel}`);
  app.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('input', () => { runtime.save.settings[input.dataset.setting] = Number(input.value); input.nextElementSibling.textContent = `${input.value}%`; runtime.audio.setSettings(runtime.save.settings); saveNow(); }));
  app.querySelector('[data-setting-motion]')?.addEventListener('change', (event) => { runtime.save.settings.reducedMotion = event.target.checked; syncMotion(); saveNow(); renderSettings(); });
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
  if (event.target?.matches?.('input, select, textarea') || app.querySelector('dialog[open]')) return;
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
  if (key === 'f') app.querySelector('[data-lantern-ward]')?.click();
  if (key === 'r') app.querySelector('[data-tide-retreat]')?.click();
  if (key === 'p') app.querySelector('[data-battle-pause]')?.click();
});
window.addEventListener('keyup', (event) => runtime.heldKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => {
  runtime.heldKeys.clear();
  runtime.worldStick = null;
});
window.addEventListener('focus', () => { if (runtime.page === 'home') void checkForContentUpdate(); });

let lastFrame = 0;
function animate(now) {
  const delta = Math.min(.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  if (runtime.page === 'adventure' && runtime.animations) drawAdventureFrame(delta);
  if (runtime.page === 'chess') {
    if (runtime.chessReplay) drawChessReplay(delta);
    else updateChessClock(delta);
  }
  if (runtime.page === 'tcg' || (runtime.page === 'chess' && !runtime.chessReplay)) {
    const reducedMotion = app.dataset.motion === 'reduced';
    boardSprites.paint(app, delta, now, reducedMotion);
    if (runtime.page === 'tcg') {
      duelEffects.paint(app.querySelector('.duel-effects'), runtime.tcg?.battleId, now, reducedMotion,
        event => runtime.audio.handle(event.type === 'tcg_support_resolved'
          ? { ...event, type: event.payload.kind === 'shield' ? 'shield_applied' : 'heal_resolved' } : event));
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

if (import.meta.env?.MODE) {
  import('./shell/webStage.ts').then(({ mountWebStage }) => {
    webStage = mountWebStage(stageHost);
    syncMotion();
    syncStage();
  }).catch((error) => console.warn('Không mở được cảnh Phaser.', error));
}

systemMotion.addEventListener('change', syncMotion);
syncMotion();
syncStage();
render();
