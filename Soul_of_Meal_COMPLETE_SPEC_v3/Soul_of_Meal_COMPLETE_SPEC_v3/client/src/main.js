import { adventureCheckpoint, createAdventureState, interactAdventure, claimAdventurePuzzle, findBattleTarget, nearestInteraction, availableAdventureInteractions, purchaseAdventureSupplies, setAdventureInput, stepAdventure, activateUltimate, activateLanternWard, retreatFromTide, activateBossCounter, beginAdventureChallenge, beginBattle, resolveMapSpawn, transitionMap, bossTelegraphTargets, focusBossStove, claimBattleResult, adventureBattleReward, leaveAdventureDefeat, WORLD } from './modes/adventure.js';
import { createTcgChallenge, createTcgMatch, playTcgCard, passTcgPriority, stepTcgResponse, tcgResponsePending, tcgCanStrike, tcgCanRotate, tcgActiveUnit, rotateTcgActive, attackTcg, assignTcgBlockers, declaredTcgAttackers, endTcgTurn, mulliganTcg, surrenderTcg, validateDeck, tcgCardIssue, tcgEffectText, tcgTableDeck, tcgTableDraft, tcgSpellTargets, strikeTcg, tcgStrikePreview, tcgStrikeTargets, decideTcgTrap, tcgExposedDamage, tcgTrapAnchor, TCG_DIFFICULTIES } from './modes/tcg.js';
import { tcgCanAttack, tcgCanBlock, tcgUnitAttack } from './modes/tcgStrategy.js';
import { tcgCardCost, tcgEffectBadge, tcgRecipeFor, TCG_RECIPES, tcgBoardLimit, tcgTrapLimit, tcgTrapSlot, tcgOpenTrapSlots, tcgHandLimit, tcgCommanderMax, usesTcgTable, TCG_TABLE_VERSION, TCG_TABLE_DECK_SIZE, TCG_KEYWORDS } from './modes/tcgCards.js';
import { TCG_TRAP_LABELS, tcgAttackLanes, tcgTrapArmed, tcgTrapOptions, tcgTrapRule } from './modes/tcgTraps.js';
import { advanceChessRound, chooseChessLoot, arrangeChessUnit, benchChessUnit, buyChessOffer, chessBenchSlots, chessDropState, createChessRun, nextChessOpponent, refreshChessShop, sellChessUnit, startChessCombat, toggleChessLock, buyChessExperience, canBuyChessOffer, chessRoundInfo, chessStandings, chessXpNeeded, equipChessItem, chessTraits, CHESS_PREPARATION_SECONDS, CHESS_TRAITS } from './modes/autoChess.js';
import { CHESS_ITEMS, chessItemPlacement } from './modes/chessItems.js';
import { gameEvents } from './core/events.js';
import { loadSave, migrateSave, persistSave, SAVE_KEY } from './core/save.js';
import { AnimationAdapter } from './render/animationAdapter.js';
import { findAdventurePath, hasClearLine, safeAdventurePosition } from './modes/adventureNavigation.js';
import { ADVENTURE_MAP_KEYS, createAdventureMapRegistry, getAdventureMap } from './modes/mapCatalog.js';
import { spriteRenderer } from './render/spriteRenderer.js';
import { actorArt, cardBackdrop, chapterArt, combatArt, cutinArt, effectArt, ELEMENT_ART, HERO_ID, HERO_NAMES as characterNames, itemArt, originalCardArt, preloadGameAssets, propArt, sceneArt, TCG_COMMANDER_ART, TRAVEL_HERO } from './render/spriteAssets.js';
import { drawEffectTexture, drawElementEffect } from './render/elementEffects.js';
import { drawCombatAccent, drawCombatTrail } from './render/combatVfx.js';
import { ADVENTURE_TICK_RATE, COMBAT_PLAYBACK_RATE, adventureBalance, adventureEncounters } from './modes/adventureBalance.js';
import { adventureSpiritStats, canAffordSpiritCost, changeSpiritProgress, MAX_SPIRIT_RANK, SPIRIT_AWAKENING, SPIRIT_BONDS, SPIRIT_GEAR, SPIRIT_GIFTS, SPIRIT_MEMORIES, SPIRIT_RANKS, spiritProfile } from './modes/spiritProgress.js';
import { BattleEffects } from './render/battleEffects.js';
import { BattleRigClock, loadSpiritRigs } from './render/spiritRig.js';
import { adventureCamera, battleCamera, adventureViewport, battleActorPoint, SPIRIT_RIG_SCALE } from './render/adventureStage.js';
import { GameAudio } from './core/audio.js';
import { resolveSoundScene } from './core/soundScenes.js';
import { ADVENTURE_CHALLENGE_TIERS, adventureChallenge, adventureChallenges } from './modes/adventureChallenges.js';
import { ADVENTURE_PUZZLES, createAdventurePuzzle, playAdventurePuzzle } from './modes/adventurePuzzle.js';
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
import { adventureParty, BANNERS, changeParty, drawSpirits, finishOnboarding, META, onboardingName, recruitSpirit, rollStarters, SPIRITS, starterSpirits } from './modes/metaProgress.js';
import { ADVENTURE_OFFERS, CRAFTED_GEAR_SLOTS, GEAR_SLOTS, adventureGearFor, changeAdventureInventory } from './modes/adventureStore.js';
import { gachaHistory, gachaOdds, gachaPanel, inventoryRows, renderOnboarding, renderStarterReveal, revealGacha, spiritImage, storeDetail } from './shell/metaPanels.js';
import { playGachaCinematic } from './shell/gachaCinematicDialog.js';
import { openStoryDialog } from './shell/storyDialog.js';
import { bindSceneNavigation } from './shell/sceneNavigation.js';

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
  shopConfig: null, tcg: null, chess: null, selectedSpell: null, tcgAttackers: null, tcgStrike: null, selectedBench: null, selectedChessItem: null, mulligan: new Set(),
  deckDrafts: new Map(), deckSlot: null, chessUpgrade: null,
  account: null, cloud: null, cloudStatus: 'saved', cloudError: null, deckFilters: { search: '', type: '', element: '', view: 'all' },
  selectedBoard: null, chessLock: null, chessReplayPaused: false, chessReplaySpeed: 1, notice: '', lastSavedLocation: 0, heldKeys: new Set(), tcgImpacts: new Map(),
  rosterId: HERO_ID, rosterTab: 'info', rosterFilter: 'owned', bannerId: 'featured_bunbo_001', gachaPayment: 'ticket',
  pendingDraw: null, settlingDraw: null, storeTab: 'all', storeMember: null, showMinimap: true, worldStick: null, rigClocks: new Map(), tcgReveal: null, tcgCutIn: null,
};
runtime.adventure = createAdventureState(runtime.save);
runtime.tcg = runtime.save.modes.tcg;
runtime.chess = runtime.save.modes.chess;
runtime.effects = new BattleEffects(spriteRenderer);
const boardSprites = new BoardSprites(spriteRenderer);
const duelEffects = new DuelEffects(spriteRenderer);
const tcgCardMotion = new TcgCardMotion();
let tcgPresentationTurn = 0;
runtime.audio = new GameAudio(runtime.save.settings);
void runtime.audio.loadSoundtracks();
window.addEventListener('click', () => runtime.audio.unlock(), { capture: true });
window.addEventListener('keydown', () => runtime.audio.unlock(), { capture: true });
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
  const { type, payload, battle_id: matchId, action_seq: actionSeq, target_id: targetId } = detail;
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
  if (type === 'tcg_unit_changed') {
    const impact = { element, matchId, actionSeq, text: payload.label, style: 'support', contact: now, expires: now + 850 };
    runtime.tcgImpacts.set(targetId, impact);
    runtime.tcgImpacts.set(tcgLaneId(target_player, target_lane), impact);
    runtime.audio.handle({ type: 'spell_launched', payload: { element } });
    return true;
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
    runtime.tcgImpacts.set(tcgTrapAnchor(payload.player_index, payload.slot), {
      element, matchId, text: 'Lật bẫy', style: 'trap', contact: now, expires: now + 850,
    });
    runtime.audio.handle({ type: 'spell_launched', payload: { element } });
    return true;
  }
  const command = TCG_CUT_IN[type];
  if (command && !payload.revived) {
    const current = runtime.tcgCutIn;
    const isSameExchange = current?.matchId === matchId && current.turn === tcgPresentationTurn;
    if (!isSameExchange || (payload.player_index === 0 && current.player_index !== 0) || type === 'tcg_ultimate_resolved') {
      runtime.tcgCutIn = { ...payload, ...command, matchId, turn: tcgPresentationTurn, expires: now + (reduced ? 760 : 1160) };
    }
  }
  if (type === 'tcg_ultimate_resolved' || type === 'tcg_spell_resolved') {
    runtime.audio.handle({ type: 'cast_started', payload: { element } });
    return true;
  }
  if (type === 'tcg_attack_ordered') return true;
  if (type === 'card_played') {
    runtime.audio.handle({ type: 'spell_launched', payload: { element } });
    return true;
  }
  if (type === 'unit_summoned' || type === 'tcg_cards_drawn' || type === 'tcg_trap_disarmed') {
    const label = type === 'tcg_cards_drawn' ? `Rút ${payload.amount} lá`
      : type === 'tcg_trap_disarmed' ? 'Gỡ bẫy' : payload.revived ? 'Hồi sinh' : 'Vào sân';
    const impact = { element, matchId, actionSeq, text: label, style: type === 'unit_summoned' ? 'summon' : 'support', contact: now, expires: now + 720 };
    runtime.tcgImpacts.set(targetId, impact);
    runtime.audio.handle(type === 'unit_summoned' ? detail : { type: 'spell_launched', payload: { element } });
    return true;
  }
  const support = type === 'tcg_support_resolved';
  if (type !== 'hit_resolved' && !support) return false;
  const melee = payload.source_kind === 'tcg_combat';
  const clip = ultimate ? 'ultimate_01' : melee ? (actionSeq % 2 === 0 ? 'attack_a' : 'attack_b') : undefined;
  const contact = duelEffects.queue(app.querySelector('.duel-field'), detail, now, reduced);
  if (melee) {
    runtime.audio.handle({ type: 'attack_started', payload: { element, clip_id: clip } });
  }
  const prior = runtime.tcgImpacts.get(targetId);
  const sameAction = prior?.matchId === matchId && prior?.actionSeq === actionSeq && prior.style === 'damage';
  const damage = (sameAction ? prior.damage ?? 0 : 0) + (payload.hp_damage ?? payload.damage ?? 0);
  const style = support ? payload.kind : damage === 0 && payload.absorbed ? 'guard' : 'damage';
  const fallen = defeated && targetId && app.querySelector(`[data-duel-id="${CSS.escape(targetId)}"] .tcg-unit-avatar img`)?.getAttribute('src');
  const impact = {
    element, matchId, actionSeq, damage, style, contact, expires: contact + 670,
    text: support ? `+${payload.amount} ${payload.label}` : style === 'guard' ? 'Chặn' : null,
    fallen,
  };
  runtime.tcgImpacts.set(targetId, impact);
  if (Number.isInteger(target_lane)) runtime.tcgImpacts.set(tcgLaneId(target_player, target_lane), impact);
  return true;
}

function handleAdventureRigEvent({ type, payload, source_id }, battle, clock) {
  const strike = (type === 'hit_resolved' && !payload.travel_ticks && payload.source_kind !== 'enemy_skill')
    || type === 'enemy_skill_released';
  const support = type === 'support_cast_released';
  if (!strike && !support && type !== 'projectile_spawned') return;
  const actor = battle.actors.find(item => item.actor_id === source_id);
  if (!actor || !clock.contact(battle, payload.clip_id)) return;
  const { x, y } = battleActorPoint(actor, 1, battle.bossTelegraph?.safeX);
  const point = clock.rig.effectPoint(payload.clip_id, x, y, actor.direction, SPIRIT_RIG_SCALE,
    app.dataset.motion === 'reduced');
  if (strike) {
    runtime.effects.add('strike', payload.element, .24, { ...point, angle: actor.direction === 'W' ? Math.PI : 0 });
    if (['basic', 'enemy_attack'].includes(payload.source_kind)) runtime.audio.handle({ type: 'attack_started', payload });
  } else if (support) {
    runtime.effects.add('cast', payload.element, .36, point);
  }
  return point;
}

const iconMap = { store: '◈', gacha: '✦', adventure: '⌖', tcg: '▤', chess: '▦', roster: '✿', settings: '⚙' };
const elementColors = { fire: '#dd684a', water: '#428eac', wood: '#548d56', light: '#b8923c', shadow: '#75627e' };

const contentFiles = [
  'cards/cards.catalog.json', 'cards/starter_deck.json',
  'auto_chess/units.json', 'auto_chess/shop_odds.json',
  ...ADVENTURE_MAP_KEYS.map(key => 'maps/' + key + '.json'),
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
  const position = safeAdventurePosition(runtime.adventure.map, runtime.adventure, runtime.maps);
  runtime.adventure.x = position.x;
  runtime.adventure.y = position.y;
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
  if (runtime.save.meta.profile) saveNow();
  navigate(profileScene());
}

function replaceProfile(save) {
  runtime.save = save;
  runtime.pendingDraw = null;
  runtime.settlingDraw = null;
  runtime.rosterFilter = 'owned';
  runtime.storeMember = null;
  runtime.adventure = createAdventureState(save, runtime.maps);
  runtime.tcg = save.modes.tcg;
  runtime.chess = save.modes.chess;
  runtime.chessReplay = null;
  runtime.chessLock = null;
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

function mergeServerMeta(save, meta) {
  if (!meta) return;
  save.meta.serverOwned = true;
  save.meta.profile = meta.profile;
  save.meta.wallet = meta.wallet;
  save.meta.pity = meta.pity;
  save.meta.history = meta.history;
  const earned = meta.duplicateEssence - (save.meta.appliedDuplicateEssence ?? 0);
  save.player.essence += Math.max(0, earned);
  save.meta.appliedDuplicateEssence = meta.duplicateEssence;
  if (meta.profile) save.player.name = meta.profile.name;
  for (const id of meta.owned) if (Object.hasOwn(SPIRITS, id)) recruitSpirit(save, id);
}

function applyCloudProfile({ account, practiceSave, meta }) {
  runtime.account = account;
  runtime.cloud = createCloudSave(accountApi, account.id, practiceSave, updateCloudStatus);
  let save = migrateSave(practiceSave.snapshot);
  if (!save.meta.profile && starterSpirits(meta?.profile).length) save = finishOnboarding(save, meta.profile);
  mergeServerMeta(save, meta);
  replaceProfile(save);
  updateCloudStatus('saved');
  if (save.meta.profile) saveNow();
}

function profileScene() {
  if (!runtime.save.meta.profile) return 'onboarding';
  return runtime.save.meta.starterRevealPending ? 'starter-summon' : 'home';
}

async function enterAccount(bootstrap, report) {
  runtime.audio.unlock();
  if (!runtime.animations) await loadContent(report);
  applyCloudProfile(bootstrap);
  navigate(profileScene());
}

function showOnboarding() {
  const username = runtime.account?.username;
  renderOnboarding(app, /^(guest|google)_/.test(username ?? '') ? '' : username, async input => {
    const name = onboardingName(input);
    const { cloud, account, save } = runtime;
    let next;
    if (cloud) {
      let meta;
      try {
        meta = await accountApi.createPlayer(account.id, name);
      } catch (error) {
        throw new Error(accountErrorMessage(error));
      }
      if (runtime.cloud !== cloud) return;
      next = finishOnboarding(save, meta.profile);
      mergeServerMeta(next, meta);
    } else {
      const create = () => {
        const existing = loadSave();
        if (existing.meta.profile) return existing;
        const created = rollStarters(save, name);
        persistSave(created);
        return created;
      };
      next = navigator.locks ? await navigator.locks.request(SAVE_KEY, create) : create();
      if (runtime.cloud) return;
    }
    replaceProfile(next);
    if (cloud) saveNow();
    if (runtime.page === 'onboarding') {
      runtime.audio.play('sfx_ui_confirm');
      navigate(profileScene(), { replace: true });
    }
  });
}

function finishStarterReveal(page) {
  const save = runtime.save;
  save.meta.starterRevealPending = false;
  try {
    saveNow();
  } catch (error) {
    save.meta.starterRevealPending = true;
    throw error;
  }
  if (page === 'gacha') {
    navigate('home', { replace: true });
    navigate('gacha');
  } else {
    navigate('adventure', { replace: true });
  }
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
        navigate(profileScene());
      } else {
        openAccountDialog(app, accountApi, async (confirmed) => {
          applyCloudProfile(confirmed);
          navigate(profileScene());
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

function sceneHasLiveMatch(page = runtime.page) {
  if (page === 'adventure') return runtime.adventure.battle?.phase === 'battle_running';
  if (page === 'tcg') return Boolean(runtime.tcg && !runtime.tcg.result);
  return page === 'chess' && (runtime.chessReplay || runtime.chessLock !== null);
}

function closeSceneOverlay() {
  const dialog = [...app.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) {
    if (dialog.requestClose) dialog.requestClose();
    else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    return true;
  }
  const menu = app.querySelector('.match-menu[open]');
  if (!menu) return false;
  menu.open = false;
  menu.querySelector('summary').focus();
  return true;
}

function confirmSceneExit(page, proceed) {
  if (!['title', 'home'].includes(page) || !sceneHasLiveMatch()) return false;
  const dialog = openInfoDialog('Về sảnh?', '<p>Trận hiện tại sẽ chờ tại vị trí đang chơi.</p><button type="button" class="button" data-confirm-exit>Về sảnh</button>');
  dialog.querySelector('[data-confirm-exit]').addEventListener('click', () => { dialog.close(); proceed(); }, { once: true });
  return true;
}

const sceneNavigation = bindSceneNavigation({
  current: () => runtime.page,
  show: showScene,
  closeOverlay: closeSceneOverlay,
  confirmExit: confirmSceneExit,
});

function navigate(page, options) {
  const show = () => sceneNavigation.go(page, options);
  if (!confirmSceneExit(page, show)) show();
}

function showScene(page) {
  if (page !== 'tcg') clearTimeout(tcgResponseTimer);
  tcgTargetResize?.disconnect();
  tcgTargetResize = null;
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
    runtime.selectedSpell = null;
    runtime.tcgStrike = null;
    runtime.selectedChessItem = null;
    tcgCardMotion.clear();
  }
  runtime.page = page;
  runtime.notice = '';
  syncStage();
  render();
  if (!app.querySelector('dialog[open]')) app.querySelector('main h1')?.focus({ preventScroll: true });
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
  if (button.closest('.match-menu')) button.textContent = label;
  button.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
}

document.addEventListener('fullscreenchange', syncFullscreenButton);

let tcgTargetResize;

function shell(content) {
  tcgTargetResize?.disconnect();
  tcgTargetResize = null;
  if (runtime.page !== 'settings') runtime.audio.setScene(resolveSoundScene(runtime.page, runtime.adventure, runtime.tcg, runtime.chess));
  const player = runtime.save.player;
  const lobby = runtime.page === 'home';
  const playScene = ['adventure', 'puzzle', 'tcg', 'chess'].includes(runtime.page);
  const sameScreen = app.querySelector('.shell')?.dataset.screen === runtime.page;
  const scrollTop = sameScreen ? app.querySelector('.main').scrollTop : 0;
  const handScroll = sameScreen ? app.querySelector('.hand-row')?.scrollLeft : undefined;
  const rosterScroll = sameScreen ? app.querySelector('.meta-roster-picker')?.scrollLeft : undefined;
  const previousFocus = document.activeElement;
  const focusKey = sameScreen && app.contains(previousFocus)
    ? ['data-puzzle-cell', 'data-chess-item', 'data-card', 'data-tcg-pass', 'data-tcg-end', 'data-bench', 'data-cell', 'data-buy'].find(key => previousFocus.hasAttribute(key))
    : null;
  const focusValue = focusKey ? previousFocus.getAttribute(focusKey) : null;
  const gold = escapeHtml(player.gold);
  const essence = escapeHtml(player.essence);
  app.innerHTML = `
    <div class="shell" data-screen="${runtime.page}" data-gameplay="${playScene}">
      ${playScene ? '' : `<header class="game-bar">${lobby ? '' : '<button class="shell-icon" type="button" data-scene-back aria-label="Quay lại">←</button>'}
        <button class="brand" data-page="home" aria-label="Về sảnh Soul of Meal">SOUL <em>OF</em> MEAL</button>
        <div class="profile-chip"><img class="profile-avatar" src="${actorArt(runtime.save.meta.profile?.avatar ?? HERO_ID)}" alt=""><div class="profile-copy">${escapeHtml(player.name)}<small>Cấp ${escapeHtml(player.level)}</small></div></div>
        <div class="game-resources">
          <span title="Vàng" aria-label="${gold} vàng"><i aria-hidden="true">◈</i> ${gold}</span>
          <span title="Tinh hoa" aria-label="${essence} tinh hoa"><i aria-hidden="true">✦</i> ${essence}</span>
        </div>
        ${runtime.cloud ? '<button class="cloud-badge" data-page="settings" title="Trạng thái lưu trên máy chủ"></button>' : ''}
        ${lobby ? '<button class="shell-icon" data-page="guide" aria-label="Hướng dẫn">?</button>' : ''}
        ${document.fullscreenEnabled ? '<button class="shell-icon" type="button" data-fullscreen>⛶</button>' : ''}
      </header>`}
      <main class="main">${content}</main>
      ${lobby ? `<nav class="game-dock" aria-label="Chế độ chơi">
        ${navButton('adventure', 'Phiêu lưu')}${navButton('tcg', runtime.tcg && !runtime.tcg.result ? 'TCG · Tiếp' : 'TCG')}${navButton('chess', runtime.chess?.phase === 'prepare' && runtime.chess.round > 1 ? 'Cờ · ' + chessRoundInfo(runtime.chess).label : 'Auto Chess')}${navButton('gacha', 'Gacha')}${navButton('roster', 'Vị Linh')}${navButton('store', 'Cửa hàng')}${navButton('settings', 'Cài đặt')}
      </nav>` : ''}
      <p class="shell-status" data-shell-status role="status"></p>
    </div>`;
  const viewport = app.querySelector('main');
  viewport.scrollTop = scrollTop;
  const hand = viewport.querySelector('.hand-row');
  if (hand && handScroll !== undefined) hand.scrollLeft = handScroll;
  const picker = viewport.querySelector('.meta-roster-picker');
  if (picker && rosterScroll !== undefined) picker.scrollLeft = rosterScroll;
  if (focusKey) app.querySelector(`[${focusKey}="${CSS.escape(focusValue)}"]:not([disabled])`)?.focus({ preventScroll: true });
  if (!sameScreen) viewport.querySelector('.topline')?.classList.add('scene-enter');
  const heading = viewport.querySelector('h1');
  if (heading) heading.tabIndex = -1;
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  app.querySelectorAll('[data-fullscreen]').forEach(button => button.addEventListener('click', toggleFullscreen));
  app.querySelectorAll('[data-scene-back]').forEach(button => button.addEventListener('click', () => sceneNavigation.back('home')));
  app.querySelector('[data-scene-settings]')?.addEventListener('click', openSceneSettings);
  syncFullscreenButton();
  const menu = viewport.querySelector('.match-menu');
  if (menu) {
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      runtime.heldKeys.clear();
      runtime.worldStick = null;
    });
    viewport.addEventListener('click', event => {
      if (!menu.contains(event.target) || event.target.closest('.match-menu button')) menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }
  if (runtime.cloud) updateCloudStatus(runtime.cloudStatus, runtime.cloudError);
}

function pageHeader(kicker, title, description) {
  return `<div class="topline"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description ? `<p class="subtitle">${description}</p>` : ''}</div><button class="button light compact" data-scene-back aria-label="Quay lại">←</button></div>`;
}

function renderHome() {
  const { save } = runtime;
  const companion = save.roster.find(member => member.id === save.settings.homeCompanion)
    ?? save.roster.find(member => member.id === META.mascot) ?? save.roster[0];
  const companionName = SPIRITS[companion.id].name;
  const journal = adventureJournal(save);
  const headline = journal.completedCampaign ? 'Đã hoàn thành Hành Trình Vị Linh'
    : journal.labels[journal.step]?.title ?? journal.nextChapterLabel ?? 'Trở lại Làng Ẩm Thực';
  shell(`
    <section class="lobby lobby-world">
      <h1 class="sr-only">Hành Trình Vị Linh</h1>
      <button type="button" class="lobby-companion" data-lobby-companion aria-label="Xem hồ sơ ${escapeAttr(companionName)}">
        ${boardChibi(companion.id, 'lobby:' + companion.id, 'E', spiritImage(companion.id, true))}
        <span>${escapeHtml(companionName)}</span>
      </button>
      <button type="button" class="lobby-quest" data-lobby-journal aria-haspopup="dialog"><small>Nhiệm vụ</small><strong>${escapeHtml(headline)}</strong></button>
      ${pinnedRelease ? `<div class="release-update" data-content-update hidden>
        <p role="status">Có bản phát hành khác sẵn sàng.</p>
        <button type="button" class="button light" data-apply-release>Cập nhật</button>
      </div>` : ''}
    </section>`);
  app.querySelector('[data-lobby-journal]').addEventListener('click', () => renderAdventureJournal(true));
  app.querySelector('[data-lobby-companion]').addEventListener('click', () => {
    runtime.audio.play('sfx_ui_confirm', { gain: .6 });
    runtime.rosterId = companion.id;
    runtime.rosterFilter = 'owned';
    runtime.rosterTab = 'info';
    navigate('roster');
  });
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
  const actionLabel = target?.label ?? '';
  const actorRows = adventureParty(save).map((member, index) => {
    const actor = battle?.actors.find((candidate) => candidate.actor_id === member.id) ?? adventureSpiritStats(member, spiritProfile(save, member.id), undefined, save);
    const skill = adventureBalance.ultimates[actor.id];
    return `<div class="combatant skill-card" data-actor="${actor.id}" data-primed="${actor.energy >= 100}">
      <span class="party-avatar">${spiritImage(actor.id)}</span>
      <div class="skill-info"><strong>${escapeHtml(SPIRITS[actor.id]?.name)}</strong>
        <div class="meter" aria-label="Sinh lực"><i data-hp style="width:${actor.hp / actor.maxHp * 100}%"></i></div>
        <div class="meter energy" aria-label="Năng lượng"><i data-energy style="width:${actor.energy}%"></i></div>
      </div>
      ${battle ? `<button class="button skill-button" data-ultimate="${actor.id}" title="${escapeAttr(skill.description)}" disabled>
        <span class="key-tag" aria-hidden="true">${index + 1}</span><img class="skill-art" src="${effectArt(actor.element, 'impact')}" alt="">
        <span class="skill-name">${escapeHtml(skill.name)}</span><small data-charge>${actor.energy}%</small>
      </button>` : ''}
    </div>`;
  }).join('');
  const battleReward = battle && (challenge ?? adventureBattleReward(save, battle.encounter ?? 'forest'));
  const resultPanel = battle?.phase === 'battle_end' ? `<div class="result-box ${battle.result}">
    <strong>${battle.result === 'victory' ? 'Chiến thắng' : 'Đội hình đã gục'}</strong>
    <p>${battle.result === 'victory'
      ? challenge && !firstClear ? `Thời gian khiêu chiến · ${(battle.tick / ADVENTURE_TICK_RATE).toFixed(1)} giây`
        : `Phần thưởng · ${battleReward.gold} vàng · ${battleReward.essence} tinh hoa${battleReward.material ? ' · ' + ADVENTURE_OFFERS[battleReward.material].name : ''}`
      : 'Đội hình có thể vào trận lại.'}</p>
    <div class="action-row"><button class="button" data-battle-result>${battle.result === 'victory' ? challenge && !firstClear ? 'Ghi thành tích' : 'Nhận thưởng' : 'Thử lại'}</button>
      ${battle.result === 'defeat' ? '<button class="button light" data-adventure-prepare>Chuẩn bị đội hình</button>' : ''}</div></div>` : '';
  const battleControls = battle?.phase === 'battle_running' ? `
    <button class="button light compact" data-battle-pause></button>
    <button class="button light compact" data-battle-speed aria-label="Tăng tốc trận đấu" aria-pressed="false">2×</button>
    <button class="button light compact" data-auto-ultimate aria-pressed="${Boolean(save.settings.autoAdventureUltimate)}">Tự dùng tuyệt kỹ</button>` : '';
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
    <div class="adventure-layout ${battle ? 'in-battle' : ''}">
      <section class="world-panel" aria-label="${battle ? 'Chiến trường' : 'Thế giới'}">
        <div class="canvas-wrap"><canvas id="adventure-canvas" width="960" height="540" aria-label="${battle ? 'Trận đánh' : 'Bản đồ phiêu lưu tương tác'}"></canvas></div>
      </section>
      <header class="adventure-heading">
        <div><small class="world-phase">${battle ? challenge ? 'Khiêu chiến' : `Đợt ${battle.wave + 1}/${encounter.waves.length}` : 'Phiêu lưu'}</small><h1>${escapeHtml(mapTitle)}</h1></div>
        ${sceneMenu(battle ? '' : `<button type="button" data-recover-position>Về điểm vào bản đồ</button>${save.adventure.chestOpened ? '<button type="button" data-open-farm>Khu thu thập</button>' : ''}`)}
      </header>
      ${battle ? '' : `<div class="minimap-widget">
        <button class="map-toggle" type="button" data-map-toggle aria-pressed="${runtime.showMinimap}">Bản đồ</button>
        <canvas id="world-minimap" width="180" height="102" aria-hidden="true" ${runtime.showMinimap ? '' : 'hidden'}></canvas>
      </div><div class="world-stick" data-world-stick aria-hidden="true"><i></i></div>
      <button class="button adventure-interact" type="button" data-interact ${target ? '' : 'hidden'}>${escapeHtml(actionLabel)}</button>
      <button class="button light adventure-party-toggle" type="button" data-explore-party>Đội hình · ${adventureParty(save).length}/5</button>
      <p class="adventure-message controls-hint" data-adventure-message role="status">${escapeHtml(adventure.lastMessage)}</p>`}
      <aside class="adventure-context">
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
        </section>` : `<section class="quest-hud">
          <button type="button" data-open-journal aria-haspopup="dialog"><small>${escapeHtml(journal.title)}</small>
            <strong>${escapeHtml(journal.labels[journal.step]?.title ?? journal.nextChapterLabel ?? (journal.completedCampaign ? 'Hành Trình Vị Linh đã hoàn thành' : 'Chương đã hoàn thành'))}</strong></button>
          ${inRoom ? '<button class="button light" data-leave-room>Ra quảng trường</button>'
            : guideAction ? '<button class="button light" data-guide-objective>Dẫn đường</button>' : ''}
        </section>`}
      </aside>${battle ? party : ''}${resultPanel ? `<section class="adventure-result-inline" aria-label="Kết quả phiêu lưu">${resultPanel}</section>` : ''}
    </div>
  `);
  app.querySelector('[data-interact]')?.addEventListener('click', doAdventureInteract);
  app.querySelector('[data-recover-position]')?.addEventListener('click', () => {
    Object.assign(adventure, resolveMapSpawn(adventure.map, runtime.maps), {
      walkPath: [], walkTarget: null, tapInteraction: null, walkBlockedFor: 0,
      lastMessage: 'Đã trở về điểm vào bản đồ.',
    });
    runtime.heldKeys.clear();
    setAdventureInput(adventure, 0, 0);
    saveNow();
    renderAdventure();
  });
  app.querySelector('[data-open-farm]')?.addEventListener('click', openAdventureFarm);
  app.querySelector('[data-open-journal]')?.addEventListener('click', () => renderAdventureJournal(true));
  app.querySelector('[data-explore-party]')?.addEventListener('click', () => navigate('roster'));
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
  app.querySelector('[data-auto-ultimate]')?.addEventListener('click', event => {
    save.settings.autoAdventureUltimate = !save.settings.autoAdventureUltimate;
    event.currentTarget.setAttribute('aria-pressed', String(save.settings.autoAdventureUltimate));
    saveNow();
  });
  app.querySelector('[data-battle-speed]')?.addEventListener('click', () => {
    battle.speed = battle.speed === 2 ? 1 : 2;
    updateBattleHud(battle);
  });
  app.querySelector('[data-battle-result]')?.addEventListener('click', claimAdventureBattle, { once: true });
  app.querySelector('[data-adventure-prepare]')?.addEventListener('click', () => {
    if (leaveAdventureDefeat(adventure)) navigate('roster');
  });
  const canvas = app.querySelector('#adventure-canvas');
  canvas?.addEventListener('pointerdown', onWorldPointer);
  app.querySelector('[data-map-toggle]')?.addEventListener('click', event => {
    runtime.showMinimap = !runtime.showMinimap;
    event.currentTarget.setAttribute('aria-pressed', String(runtime.showMinimap));
    app.querySelector('#world-minimap').hidden = !runtime.showMinimap;
  });
  runtime.minimapObjective = guideAction;
  const stick = app.querySelector('[data-world-stick]');
  if (stick) bindWorldStick(stick, input => {
    runtime.worldStick = input;
    adventure.walkPath = [];
    adventure.walkTarget = null;
    adventure.tapInteraction = null;
  });
  if (battle) updateBattleHud(battle);
}

function openAdventureFarm() {
  const { adventure, save, maps } = runtime;
  if (adventure.battle || !save.adventure.chestOpened) return;
  const stages = Object.entries(adventureEncounters).filter(([, encounter]) => encounter.field);
  const dialog = openInfoDialog('Khu thu thập', `<div class="farm-stage-list">${stages.map(([id, encounter]) => {
    const map = getAdventureMap(maps, encounter.scene);
    const reward = adventureBattleReward(save, id);
    const cleared = save.adventure.rewardClaims.includes(encounter.claimId);
    return `<button class="farm-stage button light" type="button" data-farm-stage="${id}">
      <img src="${sceneArt(encounter.scene)}" alt="">
      <span><strong>${escapeHtml(map.display_name)}</strong><small>${cleared ? 'Tái đấu' : 'Thưởng lần đầu'} · ${reward.gold} vàng · ${reward.essence} tinh hoa · ${ADVENTURE_OFFERS[reward.material].name}</small></span>
    </button>`;
  }).join('')}</div>`);
  dialog.querySelectorAll('[data-farm-stage]').forEach(button => button.addEventListener('click', () => {
    const encounter = adventureEncounters[button.dataset.farmStage];
    const next = transitionMap(adventure, runtime.save, encounter.scene, maps);
    runtime.save = next.save;
    adventure.lastMessage = 'Chạm đội tuần tra để chiến đấu và thu thập tài nguyên.';
    dialog.close();
    saveNow();
    renderAdventure();
  }));
}

function renderAdventureJournal(asOverlay = false) {
  const { save, adventure } = runtime;
  const journal = adventureJournal(save);
  const guideAction = journal.action ?? journal.nextChapterAction;
  const chronicle = adventureChronicle(save);
  const statusText = { done: 'Hoàn thành', current: 'Mục tiêu hiện tại', upcoming: 'Sắp tới' };
  const journalContent = `
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
        ${asOverlay ? '<button class="button light" data-open-chronicle>Manga hành trình</button>' : ''}
        ${asOverlay ? '' : '<button class="button light" data-scene-back>Về bản đồ</button>'}
      </div>
    </section>
    ${asOverlay ? '' : `<section class="panel chronicle-panel" aria-label="Manga Hành Trình Vị Linh">
      <h2>Manga Hành Trình Vị Linh</h2>
      <div class="chronicle-grid">${chronicle.map(chapter => `<article class="chronicle-entry ${chapter.scenes.length ? '' : 'locked'}">
        ${chapter.scenes.length ? `<img loading="lazy" src="${chapterArt(chapter.number)}" alt="">` : ''}
        <div class="chronicle-copy"><span>Chương ${chapter.number}${chapter.scenes.length ? '' : ' · Chưa mở'}</span><h3>${chapter.title}</h3>
          ${chapter.scenes.map(scene => `<button class="button light compact" data-story-replay="${scene}">${CHAPTER_DIALOGUES[scene].title}</button>`).join('')}
        </div></article>`).join('')}</div>
    </section>`}`;
  let dialog;
  if (asOverlay) {
    dialog = openInfoDialog('Nhật ký hành trình', journalContent);
    dialog.classList.add('quest-dialog');
  } else shell(pageHeader('Phiêu lưu', 'Nhật ký hành trình', '') + journalContent);
  const host = dialog ?? app;
  host.querySelector('[data-guide-objective]')?.addEventListener('click', () => { dialog?.close(); guideToObjective(guideAction); });
  host.querySelector('[data-adventure-challenges]')?.addEventListener('click', () => { dialog?.close(); openAdventureChallenges(); });
  host.querySelector('[data-open-chronicle]')?.addEventListener('click', () => {
    dialog.close();
    navigate('journey');
    app.querySelector('.chronicle-panel')?.scrollIntoView({ block: 'start' });
  });
  host.querySelectorAll('[data-story-replay]').forEach(button => {
    button.addEventListener('click', () => openStoryDialog(app, button.dataset.storyReplay));
  });
}

const GUIDE_PAGES = { world: 'Thế giới', adventure: 'Phiêu lưu', tcg: 'Thẻ chiến thuật', autochess: 'Auto Chess', effects: 'Hiệu ứng', update: 'Cập nhật game' };
const EFFECT_PREVIEWS = {
  spell: 'Tụ phép và phóng đạn', slash: 'Đòn cận chiến', cast: 'Tuyệt kỹ', shield: 'Hộ thuẫn',
  heal: 'Hồi phục', trap: 'Lật bẫy', defeat: 'Gục ngã',
};

function renderGuide() {
  const guide = runtime.guidePage ?? 'adventure';
  shell(pageHeader('Hướng dẫn', guide === 'effects' ? 'Xem thử hiệu ứng' : 'Đọc truyện tranh hướng dẫn', '') + `
    <div class="guide-reader">
      <nav class="meta-banner-tabs" aria-label="Mục hướng dẫn">${Object.entries(GUIDE_PAGES).map(([id, label]) =>
        `<button class="button light" data-guide-page="${id}" aria-pressed="${guide === id}">${label}</button>`).join('')}</nav>
      ${guide === 'effects' ? `<div class="effect-gallery">
        <canvas width="760" height="280" data-effect-preview aria-label="Sân thử hiệu ứng nguyên tố"></canvas>
        <div class="action-row effect-preview-controls">
          <label>Nguyên tố<select data-effect-element>${Object.entries(ELEMENT_NAMES).map(([id, label]) =>
            `<option value="${id}">${label}</option>`).join('')}</select></label>
          <label>Hoạt ảnh<select data-effect-kind>${Object.entries(EFFECT_PREVIEWS).map(([id, label]) =>
            `<option value="${id}">${label}</option>`).join('')}</select></label>
          <button type="button" class="button" data-effect-play>Phát hiệu ứng</button>
        </div>
      </div>` : `<img class="guide-comic" src="./assets/original/guides/${guide}.webp" alt="Truyện tranh hướng dẫn · ${GUIDE_PAGES[guide]}">`}
    </div>`);
  const play = app.querySelector('[data-effect-play]');
  if (play) {
    const show = () => {
      runtime.effectPreview = {
        element: app.querySelector('[data-effect-element]').value,
        kind: app.querySelector('[data-effect-kind]').value,
        start: performance.now(),
      };
    };
    play.addEventListener('click', show);
    show();
  }
  app.querySelectorAll('[data-guide-page]').forEach(button => button.addEventListener('click', () => {
    runtime.guidePage = button.dataset.guidePage;
    renderGuide();
    app.querySelector('[data-guide-page][aria-pressed="true"]')?.focus({ preventScroll: true });
  }));
}

function paintEffectPreview(now, reducedMotion) {
  const canvas = app.querySelector('[data-effect-preview]');
  if (!canvas || !runtime.effectPreview) return;
  const preview = runtime.effectPreview;
  const { element, kind, start } = preview;
  const progress = reducedMotion ? .73 : (now - start) / 1350;
  if (preview.reducedMotion === reducedMotion && (preview.finished || reducedMotion)) return;
  preview.reducedMotion = reducedMotion;
  preview.finished = progress > 1;
  const width = 760, height = 280;
  const context = canvasContext(canvas, canvasResolution(canvas, width, height, true), width, height);
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const at = { x: width / 2, y: height * .61 };
  const from = { x: 166, y: at.y }, to = { x: width - 166, y: at.y };
  if (preview.finished) return;
  if (kind === 'spell' && progress < .28) {
    drawCombatAccent(context, spriteRenderer, { element, kind: 'charge', ...from, size: 112, progress: progress / .28 });
  } else if (kind === 'spell' && progress < .65) {
    drawCombatTrail(context, spriteRenderer, { element, from, to, progress: (progress - .28) / .37, size: 96, arc: 58 });
  } else {
    const point = kind === 'spell' ? to : at;
    drawCombatAccent(context, spriteRenderer, { element, kind: kind === 'spell' ? 'hit' : kind, ...point,
      size: 148, progress: kind === 'spell' ? (progress - .65) / .35 : progress, reducedMotion });
  }
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
  if (result.changed || result.dialogue || result.service || result.puzzle) {
    runtime.heldKeys.clear();
    setAdventureInput(runtime.adventure, 0, 0);
    runtime.adventure.walkPath = [];
    runtime.adventure.walkTarget = null;
    runtime.adventure.tapInteraction = null;
  }
  if (result.changed) saveNow();
  if (result.puzzle) {
    runtime.adventurePuzzle = createAdventurePuzzle(result.puzzle);
    runtime.puzzleSelection = null;
    runtime.puzzleNote = '';
    return navigate('puzzle');
  }
  if (result.service) return openVillageService(result.service, result.offer);
  render();
  if (result.dialogue && !runtime.adventure.battle) openStoryDialog(app, result.dialogue);
}

const PUZZLE_INGREDIENTS = [
  ['Ớt', 'fire'], ['Giọt sương', 'water'], ['Lá thơm', 'wood'], ['Mật ong', 'light'], ['Nấm', 'shadow'],
];

function renderAdventurePuzzle() {
  const puzzle = runtime.adventurePuzzle;
  if (!puzzle) return navigate('adventure', { replace: true });
  const spec = ADVENTURE_PUZZLES[puzzle.id];
  const slide = spec.kind === 'slide';
  shell(`<section class="adventure-puzzle" aria-labelledby="puzzle-title">
    <div class="puzzle-copy"><h1 id="puzzle-title">${spec.title}</h1>
      <p>${spec.instructions}</p>
      <p class="puzzle-score">${slide ? `${puzzle.moves} lượt trượt` : `Đã ghép ${puzzle.score}/${spec.goal} · Còn ${spec.moves - puzzle.moves} lượt`}</p>
      ${spec.reward ? `<p>Thưởng: ${spec.reward.gold} vàng, ${spec.reward.essence} tinh hoa và mở Cổng Rừng Nguyên Liệu.</p>` : ''}
      <p class="puzzle-note" role="status">${puzzle.status === 'won' ? 'Đã giải được thử thách.' :
        puzzle.status === 'lost' ? 'Đã hết lượt. Thử lại để tiếp tục.' : runtime.puzzleNote}</p>
      <div class="action-row">
        <button class="button light" data-puzzle-back>Quay lại</button>
        ${puzzle.status === 'won' ? `<button class="button" data-puzzle-claim>${spec.reward ? 'Nhận thưởng' : 'Tiếp tục nhiệm vụ'}</button>`
          : puzzle.moves || puzzle.status === 'lost' ? '<button class="button light" data-puzzle-reset>Chơi lại</button>' : ''}
      </div>
    </div>
    <div class="puzzle-board ${slide ? 'sliding-board' : ''}" role="group" aria-label="Bàn giải đố">
      ${puzzle.board.map((value, index) => {
        const [name, element] = slide ? [value ? 'Mảnh ' + value : 'Ô trống', 'light'] : PUZZLE_INGREDIENTS[value];
        return `<button class="puzzle-tile element-${element}" data-puzzle-cell="${index}"
          aria-label="${name}, ô ${index + 1}" ${slide ? '' : `aria-pressed="${runtime.puzzleSelection === index}"`}
          ${puzzle.status !== 'playing' || (slide && !value) ? 'disabled' : ''}>
          ${slide ? value || '' : `<img src="${effectArt(element, 'impact')}" alt=""><small>${name}</small>`}
        </button>`;
      }).join('')}
    </div>
  </section>`);
  const back = () => sceneNavigation.back();
  app.querySelector('[data-puzzle-back]').addEventListener('click', back);
  app.querySelector('[data-puzzle-reset]')?.addEventListener('click', () => {
    runtime.adventurePuzzle = createAdventurePuzzle(puzzle.id, puzzle.seed);
    runtime.puzzleSelection = null;
    runtime.puzzleNote = '';
    renderAdventurePuzzle();
  });
  app.querySelector('[data-puzzle-claim]')?.addEventListener('click', () => {
    const result = claimAdventurePuzzle(runtime.adventure, runtime.save, runtime.maps, puzzle);
    runtime.save = result.save;
    runtime.adventurePuzzle = null;
    if (result.changed) saveNow();
    back();
  });
  for (const button of app.querySelectorAll('[data-puzzle-cell]')) button.addEventListener('click', () => {
    const index = Number(button.dataset.puzzleCell);
    const selected = runtime.puzzleSelection;
    if (slide || (selected !== null && selected !== index)) {
      const next = slide ? playAdventurePuzzle(puzzle, index, puzzle.board.indexOf(0)) : playAdventurePuzzle(puzzle, selected, index);
      runtime.adventurePuzzle = next;
      runtime.puzzleSelection = !slide && next === puzzle ? index : null;
      runtime.puzzleNote = next !== puzzle ? '' : slide ? 'Chọn mảnh cạnh ô trống.' : 'Hãy đổi hai ô kề nhau để tạo một bộ ba.';
      if (next !== puzzle) runtime.audio.play('sfx_ui_confirm', { gain: .5 });
    } else {
      runtime.puzzleSelection = selected === index ? null : index;
      runtime.puzzleNote = '';
    }
    renderAdventurePuzzle();
    if (runtime.adventurePuzzle.status === 'won') app.querySelector('[data-puzzle-claim]').focus();
  });
}

function openVillageService(service, offer) {
  if (service === 'gear') {
    runtime.storeTab = 'gear';
    return navigate('store');
  }
  if (service === 'journal') return renderAdventureJournal(true);
  if (service !== 'supplies' || !offer) return;
  runtime.storeTab = 'all';
  navigate('store');
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
  if (app.querySelector('dialog[open], .match-menu[open]')) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const battle = runtime.adventure.battle;
  const view = adventureSceneCamera(canvas);
  const x = view.left + (event.clientX - rect.left) / rect.width * view.width;
  const y = view.top + (event.clientY - rect.top) / rect.height * view.height;
  if (battle) {
    const stove = battle.stoves.find(target => target.alive
      && Math.abs(target.x - x) <= 39 && y >= target.y - 73 && y <= target.y + 10);
    if (stove) selectBossStove(stove.actor_id);
    return;
  }
  const { adventure, save, maps } = runtime;
  const withinTap = item => Math.hypot(item.x - x, item.y - y) < 35;
  const target = availableAdventureInteractions(adventure.map, save, maps).find(withinTap);
  canvas.dataset.pathLength = String(queueWorldPath(target ?? { x, y }, target?.action));
  if (!target && adventure.map === 'village') {
    const locked = getAdventureMap(maps, adventure.map).interactables.find(item => item.kind === 'portal' && withinTap(item));
    if (locked?.action === 'portal') adventure.lastMessage = 'Mở rương trong làng để mở lối vào Rừng Nguyên Liệu.';
    if (locked?.action === 'harbor_route') adventure.lastMessage = 'Hoàn thành chương 2 để mở đường đến Hải Vực.';
  }
}

function queueWorldPath(destination, action = null) {
  const adventure = runtime.adventure;
  const radius = getAdventureMap(runtime.maps, adventure.map)?.world.player_radius;
  Object.assign(adventure, safeAdventurePosition(adventure.map, adventure, runtime.maps));
  const path = findAdventurePath(adventure.map, adventure, destination, radius, runtime.maps);
  adventure.walkBlockedFor = 0;
  if (!path.length) {
    adventure.walkPath = [];
    adventure.walkTarget = null;
    adventure.tapInteraction = null;
    adventure.lastMessage = 'Không tìm được đường đi tới điểm đó.';
    return 0;
  }
  adventure.walkPath = path;
  adventure.walkTarget = path.at(-1);
  adventure.tapInteraction = action;
  if (!action && Math.hypot(adventure.walkTarget.x - destination.x, adventure.walkTarget.y - destination.y) > 3) {
    adventure.lastMessage = 'Vật cản phía trước. Đang đi đến điểm gần nhất.';
  }
  return path.length;
}

function adventureSceneCamera(canvas) {
  const { adventure, maps } = runtime;
  if (adventure.battle) {
    const arena = adventureViewport(true, compactBattle.matches, portraitBattle.matches);
    return battleCamera(arena, canvas.clientWidth, canvas.clientHeight);
  }
  return adventureCamera(adventure, getAdventureMap(maps, adventure.map)?.world ?? WORLD,
    canvas.clientWidth, canvas.clientHeight);
}

function drawAdventureFrame(deltaSeconds, modalOpen) {
  const canvas = app.querySelector('#adventure-canvas');
  if (!canvas) return;
  const adventure = runtime.adventure;
  if (!modalOpen && adventure.walkPath?.length && !adventure.battle && runtime.heldKeys.size === 0 && !runtime.worldStick) {
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
  if (modalOpen || adventure.battle) setAdventureInput(adventure, 0, 0);
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
  const playbackDelta = adventure.battle?.paused ? 0 : deltaSeconds * (adventure.battle ? adventure.battle.speed * COMBAT_PLAYBACK_RATE : 1);
  if (!modalOpen) stepAdventure(adventure, runtime.save, playbackDelta, runtime.maps);
  if (!adventure.battle && !modalOpen && adventure.walkPath?.length) {
    const moved = Math.hypot(adventure.x - oldX, adventure.y - oldY);
    adventure.walkBlockedFor = moved > .01 ? 0 : (adventure.walkBlockedFor ?? 0) + deltaSeconds;
    if (adventure.walkBlockedFor >= .4) {
      const goal = adventure.walkTarget;
      const radius = getAdventureMap(runtime.maps, adventure.map)?.world.player_radius;
      const canReach = goal && hasClearLine(adventure.map, adventure, goal, radius, runtime.maps);
      if (canReach && adventure.walkPath.length > 1) {
        adventure.walkPath = [goal];
      } else {
        adventure.walkPath = [];
        adventure.walkTarget = null;
        adventure.tapInteraction = null;
        setAdventureInput(adventure, 0, 0);
        adventure.lastMessage = 'Đường bị chắn. Chọn hướng khác hoặc dùng Về điểm vào bản đồ trong menu.';
      }
      adventure.walkBlockedFor = 0;
    }
  }
  const view = adventureSceneCamera(canvas);
  const resolution = canvasResolution(canvas, view.width, view.height);
  const context = canvasContext(canvas, resolution, view.width, view.height, view.left, view.top);
  if (!context) return;
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
  if (message && message.textContent !== adventure.lastMessage) message.textContent = adventure.lastMessage;
  const target = nearestInteraction(adventure, runtime.save, runtime.maps);
  const interactButton = app.querySelector('[data-interact]');
  if (interactButton && !adventure.battle) {
    interactButton.hidden = !target;
    if (target && interactButton.textContent !== target.label) interactButton.textContent = target.label;
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
  context.fillStyle = '#1b3028';
  context.fillRect(view.left, view.top, view.width, view.height);
  if (adventure.battle) drawBattleScene(context, adventure.battle, view);
  else {
    drawWorldScene(context, adventure, runtime.save, moved > .25);
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
  const drawHero = () => {
    context.fillStyle = '#251b185c';
    context.beginPath();
    context.ellipse(adventure.x, adventure.y, 15, 4, 0, 0, Math.PI * 2);
    context.fill();
    drawPlayer(context, adventure.x, adventure.y, runtime.animations.getActorState(HERO_ID)?.animation);
  };
  drawMapVisuals(context, map, save, adventure.y, drawHero);
}

function drawMapVisuals(context, map, save, feetY, drawHero) {
  const depth = visual => visual.depth ?? visual.y + (visual.height ?? (visual.kind === 'tree' ? 26 : 10));
  const visuals = [...(map?.visuals ?? []), ...(map?.layers?.occlusion ?? []), { kind: 'hero', depth: feetY }];
  const activeIds = new Set(availableAdventureInteractions(map?.runtime_key, save, runtime.maps).map(item => item.id));
  for (const visual of visuals.sort((a, b) => depth(a) - depth(b))) {
    const { x, y } = visual;
    if (visual.kind === 'hero') drawHero();
    else if (visual.points) {
      if (feetY >= visual.depth) continue;
      context.save();
      context.beginPath();
      context.moveTo(...visual.points[0]);
      for (const point of visual.points.slice(1)) context.lineTo(...point);
      context.closePath();
      context.clip();
      spriteRenderer.drawImage(context, sceneArt(map.runtime_key), 0, 0, map.world.width, map.world.height);
      context.restore();
    } else if (visual.kind === 'house') {
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
      const { quest, chapterTwo } = save.adventure;
      const questStage = quest === 'completed' ? chapterTwo.stage : quest;
      if (['not_started', 'ready_to_claim'].includes(questStage)) drawMapLabel(context, '!', x, y - 60);
    } else if (['guide', 'resident', 'field_encounter'].includes(visual.kind)
        && (visual.kind !== 'field_encounter' || activeIds.has(visual.id))) {
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
      if (!visual.painted) drawFitted(context, propArt('portal'), x, y + 16, 78, 89);
      else if (open) drawElementEffect(context, spriteRenderer, 'wood', 'impact', { x, y, size: 38, opacity: .55 });
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
  const encounter = adventureEncounters[battle.encounter ?? 'forest'];
  context.fillStyle = '#283f33';
  context.fillRect(0, 0, 960, 540);
  spriteRenderer.drawImage(context, sceneArt(encounter.battleScene ?? encounter.scene ?? 'arena'), 0, 0, 960, 540);
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
    const action = actor.action;
    if (!actor.alive || action?.sourceKind !== 'enemy_skill' || battle.tick >= action.launchTick) continue;
    const target = findBattleTarget(battle, action.targetId);
    const aim = action.aim ?? (target?.alive && battleActorPoint(target, blend, battle.bossTelegraph?.safeX));
    if (!aim) continue;
    const opacity = .45 + .5 * (1 - (action.launchTick - battle.tick) / action.windup);
    context.save();
    context.globalAlpha = opacity;
    context.fillStyle = '#9d241c70';
    context.strokeStyle = '#ff986e';
    context.lineWidth = 2;
    context.setLineDash([7, 5]);
    if (action.radius) {
      context.beginPath();
      context.ellipse(aim.x, aim.y, action.radius, action.radius * .5, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      for (const ally of actors) {
        if (ally.actor.team !== 'player' || !ally.actor.alive
            || Math.hypot(ally.actor.x - aim.x, ally.actor.y - aim.y) > action.radius) continue;
        context.beginPath();
        context.ellipse(ally.x, ally.y, 21, 8, 0, 0, Math.PI * 2);
        context.stroke();
      }
    } else {
      context.beginPath();
      context.moveTo(x, y - 38);
      context.lineTo(aim.x, aim.y - 18);
      context.stroke();
    }
    context.restore();
    drawMapLabel(context, action.name, x, y - (actor.boss ? 144 : 105));
  }
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
  runtime.effects.draw(context, battle, reducedMotion, view, fraction, blend, runtime.save.settings.effectsLimited);
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
    const charging = actor.action?.sourceKind === 'enemy_skill' || animation?.requestedClipId === 'skill_01';
    const pose = app.dataset.motion === 'reduced' ? 0 : Math.sin((animation?.motionPhase ?? 0) * Math.PI);
    if (charging) drawElementEffect(context, spriteRenderer, actor.element, 'impact', {
      x, y: y - 54, size: 150 + pose * 24, opacity: .35 + pose * .20,
    });
    drawFitted(context, propArt(actor.artId ?? actor.id), x, y - (charging ? pose * 5 : 0), 150, 129);
  } else if (!drawn) {
    const pose = placeholderPose(animation);
    const art = actorArt(actor.id);
    if (art) {
      context.save();
      context.translate(x, 0);
      if (actor.direction === 'W' && actor.id.startsWith('chr_som_')) context.scale(-1, 1);
      drawFitted(context, art, 0, y + pose.offsetY,
        (actor.boss ? 150 : 77) * pose.scaleX, (actor.boss ? 128 : 78) * pose.scaleY);
      context.restore();
    }
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
const TCG_CUT_IN = {
  unit_summoned: { kind: 'summon', title: 'Triệu hồi Vị Linh', quote: 'Ký ức của hương vị, hãy thức tỉnh!' },
  tcg_attack_ordered: { kind: 'attack', title: 'Lệnh tấn công', quote: 'Vị Linh, tiến lên!' },
  tcg_spell_resolved: { kind: 'cast', title: 'Thi triển bí thuật' },
  tcg_ultimate_resolved: { kind: 'ultimate', title: 'Tuyệt kỹ Vị Linh' },
};

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

function startTcg(seed, difficulty = 'normal', opponentPreset = '', challengeId = '', frontline = false) {
  runtime.mulligan.clear();
  runtime.selectedSpell = null;
  runtime.tcgAttackers = null;
  runtime.tcgStrike = null;
  runtime.tcgReveal = null;
  runtime.tcgCutIn = null;
  runtime.tcgRecipeFlash = null;
  runtime.tcgImpacts.clear();
  duelEffects.clear();
  tcgCardMotion.clear();
  if (challengeId) return createTcgChallenge(runtime.cards, playerDeck(), seed, challengeId, frontline);
  const preset = opponentPreset || tcgDefaultPreset(difficulty);
  return createTcgMatch(runtime.cards, playerDeck(), seed, tcgTableDeck(runtime.cards, preset), difficulty, TCG_TABLE_VERSION, frontline);
}

function tcgPresets() {
  return [{ id: 'starter', name: 'Khởi đầu', description: 'Phối hợp Vị Linh và phép của cả năm hệ.' },
    ...runtime.cards.presets, ...(runtime.cards.table_presets ?? [])];
}

function tcgChallenge(match) {
  return runtime.cards.table_challenges?.find(item => item.id === match.challengeId);
}

function cardArt(card) {
  const dedicated = originalCardArt(card.card_id);
  const entry = card.card_id && runtime.cards.cards.find((candidate) => candidate.card_id === card.card_id);
  if (dedicated) return dedicated;
  if (card.art_prop) return propArt(card.art_prop);
  if (card.art_effect) return combatArt(card.art_effect);
  return actorArt(card.character_id ?? entry?.character_id)
    ?? originalCardArt(card.art_card ?? card.card_id)
    ?? effectArt(card.element ?? entry?.element, card.type === 'fast_spell' ? 'trail' : 'impact');
}

function matchCardArt(card) {
  const artwork = originalCardArt(card.card_id);
  if (artwork) return artwork;
  if (Object.hasOwn(characterNames, card.requires_character)) return cutinArt(card.requires_character);
  return Object.hasOwn(characterNames, card.character_id) ? cutinArt(card.character_id)
    : cardArt(card);
}

function matchHeader(title, controls) {
  return `<header class="match-header"><h1>${title}</h1><small class="rotate-hint">Xoay ngang để mở rộng sân</small>
    ${sceneMenu(controls)}</header>`;
}

function sceneMenu(controls = '') {
  return `<details class="match-menu"><summary aria-label="Menu game">☰</summary><div>${controls}
    <button type="button" data-page="guide">Hướng dẫn</button>
    <button type="button" data-scene-settings>Cài đặt</button>
    ${document.fullscreenEnabled ? '<button type="button" data-fullscreen>Toàn màn hình</button>' : ''}
    <button type="button" data-page="home">Về sảnh</button>
    </div></details>`;
}

function tcgCommander(match, index, targets, strikes) {
  const player = match.players[index];
  const friendly = index === 0;
  const targeting = targets.some(target => target.player === index && target.id === 'commander');
  const deckTarget = friendly && targets.some(target => target.id === 'deck');
  const canStrike = !friendly && strikes.some(target => target.id === 'commander');
  const id = friendly ? 'commander:p0' : 'commander:p1';
  const challenge = tcgChallenge(match);
  const preset = tcgPresets().find(item => 'deck_' + item.id === match.botDeckId);
  const name = friendly ? 'Người Kết Vị' : challenge?.name ?? (preset?.id !== 'starter' ? preset?.name : null) ?? 'Chủ soái đối thủ';
  const hp = `<b>${player.hp}</b><small>HP</small>${tcgImpact(id)}`;
  return `<div class="${friendly ? 'duel-bottom' : 'duel-top'}">
    <span class="duel-crest" aria-hidden="true">${friendly ? `<img src="${TCG_COMMANDER_ART}" alt="">` : '◆'}</span>
    <div class="duel-identity"><strong>${escapeHtml(name)}</strong><small>${player.mana}/${player.maxMana} mana${friendly ? '' : ` · ${player.hand.length} lá tay`}</small></div>
    <div class="tcg-piles" aria-label="${friendly ? 'Bộ bài của bạn' : 'Bộ bài đối thủ'}">
      ${deckTarget ? `<button type="button" class="tcg-deck-target spell-target" data-tcg-deck data-spell-target="deck">Bộ ${player.deck.length}</button>`
        : `<span class="tcg-deck-target" ${friendly ? 'data-tcg-deck' : ''} title="Bài còn trong bộ">Bộ ${player.deck.length}</span>`}
      ${friendly && player.graveyard.length ? `<button type="button" class="tcg-deck-target"
        data-tcg-graveyard>Mộ ${player.graveyard.length}</button>`
        : `<span class="tcg-deck-target" title="Số lá trong mộ bài">Mộ ${player.graveyard.length}</span>`}
    </div>
    ${tcgTrapSlots(match, index, targets)}
    ${canStrike ? `<button type="button" class="commander-hp enemy-hp strike-target" data-duel-id="${id}" data-tcg-strike-target="commander" aria-label="Tấn công ${escapeAttr(name)} · ${player.hp} HP">${hp}</button>`
      : targeting
      ? `<button type="button" class="commander-hp ${friendly ? '' : 'enemy-hp'} spell-target" data-duel-id="${id}" data-spell-target="commander" aria-label="${escapeAttr(name)} · ${player.hp} HP">${hp}</button>`
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
  openInfoDialog(cardName(card), `<div class="inspect-tcg"><div class="card-illustration" style="--card-backdrop:url('${cardBackdrop(card.element)}')"><img src="${escapeAttr(matchCardArt(card))}" alt=""></div>
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
  if (!id || (!spriteRenderer.rigs.has(id) && !spriteRenderer.sheets.get(id)?.loaded)) return fallback;
  return `<canvas class="board-chibi" width="${BOARD_SPRITE.width}" height="${BOARD_SPRITE.height}" aria-hidden="true" data-chibi-id="${escapeAttr(id)}"
    data-chibi-key="${escapeAttr(key)}" data-chibi-facing="${direction}"></canvas>`;
}

function tcgLaneId(player, lane) { return `lane:p${player}:${lane}`; }

function tcgImpact(id) {
  const impact = runtime.tcgImpacts.get(id);
  if (!impact || impact.matchId !== runtime.tcg.battleId || impact.expires <= performance.now()) return '';
  const delay = Math.round(impact.contact - performance.now());
  const texture = impact.style === 'shield' || impact.style === 'guard' ? combatArt('shield_bubble') : effectArt(impact.element, 'impact');
  const color = (ELEMENT_ART[impact.element] ?? ELEMENT_ART.light).color;
  return `<span class="tcg-hit" data-effect="${impact.style}" style="--contact-delay:${delay}ms;--impact-color:${color}" aria-hidden="true">
    <i class="tcg-contact-ring"></i><img class="tcg-impact" src="${texture}" alt="">
    <span class="tcg-damage tcg-${impact.style}">${escapeHtml(impact.text ?? '−' + impact.damage)}</span></span>`;
}

function renderTcg() {
  if (!runtime.tcg) runtime.tcg = startTcg(41);
  const match = runtime.tcg;
  for (const [id, impact] of runtime.tcgImpacts) {
    if (impact.matchId !== match.battleId || impact.expires <= performance.now()) runtime.tcgImpacts.delete(id);
  }
  const [user, bot] = match.players;
  const table = usesTcgTable(match);
  const challenge = tcgChallenge(match);
  if (challenge && match.result && match.winner === 0) {
    const records = runtime.save.tcgChallengeBests ??= {};
    records[challenge.id] = Math.min(records[challenge.id] ?? Infinity, match.round);
  }
  const opening = match.mulliganDone === false && match.round === 1 && match.eventSeq === 0;
  const canPlay = !opening && !match.result && ['action', 'reaction'].includes(match.phase) && match.priority === 0;
  const spell = canPlay ? user.hand.find(card => card.instance_id === runtime.selectedSpell && !tcgCardIssue(match, 0, card)) : null;
  const targets = spell ? tcgPlayTargets(match, spell) : [];
  const canStrike = table && !opening && !spell && !match.result && match.activePlayer === 0 && match.priority === 0 && ['action', 'combat', 'round_end'].includes(match.phase);
  const attacker = canStrike ? user.units.find(unit => unit.instance_id === runtime.tcgStrike?.attacker && tcgCanStrike(match, 0, unit)) : null;
  if (!attacker) runtime.tcgStrike = null;
  const strikes = attacker ? tcgStrikeTargets(match, 0) : [];
  const ready = user.units.filter(unit => tcgCanStrike(match, 0, unit)).length;
  const targetIds = new Set(targets.map(target => target.id));
  if (!spell) runtime.selectedSpell = null;
  const hand = user.hand.map((card) => {
    const reason = opening ? '' : tcgCardIssue(match, 0, card);
    const cost = tcgCardCost(match, 0, card);
    const selected = opening ? runtime.mulligan.has(card.instance_id) : spell?.instance_id === card.instance_id;
    const detail = card.type === 'unit' ? `${card.atk}/${card.max_def}`
      : card.type === 'trap' ? TCG_TRAP_LABELS[card.trigger?.when] : tcgEffectBadge(card);
    return `<div class="hand-card"><button class="playing-card element-${card.element} ${selected ? 'selected' : ''} ${card.requires_character ? 'ultimate-card' : ''}" data-card="${escapeAttr(card.instance_id)}" ${opening || table || card.type.endsWith('_spell') ? `aria-pressed="${selected}"` : ''} ${reason ? `disabled title="${escapeAttr(reason)}"` : ''}>
      <span class="card-cost ${cost < card.cost ? 'resonant' : ''}" aria-label="${cost} mana${cost < card.cost ? ', đã giảm 1 nhờ Cộng hưởng' : ''}">${cost}</span><span class="card-thumb card-illustration" style="--card-backdrop:url('${cardBackdrop(card.element)}')"><img src="${escapeAttr(matchCardArt(card))}" alt=""></span>
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
  const strikeControls = attacker ? `<div class="tcg-strike-controls">
    <div role="status"><strong>${escapeHtml(cardName(attacker))}</strong>
    <small data-tcg-strike-hint>${match.frontline && strikes.some(target => target.unit) ? 'Chạm Vị Linh chủ chiến để tấn công.' : strikes.some(target => target.unit?.keywords?.includes('guard')) ? 'Bấm Hộ vệ để tấn công.' : 'Bấm Vị Linh địch hoặc chủ soái để tấn công.'}</small></div>
    <button class="button light" data-tcg-cancel-strike>Hủy</button></div>` : '';
  const recipe = spell && TCG_RECIPES[tcgRecipeFor(match, 0, spell)];
  const targetHint = spell?.type === 'trap' ? 'Bấm ô bẫy sáng để đặt.'
    : targets.some(target => target.fallen) ? 'Chọn Vị Linh cần hồi sinh.'
    : 'Bấm mục tiêu đang sáng để thi triển.';
  const spellControls = spell ? `<div class="tcg-target-prompt">
    <div role="status"><strong>${escapeHtml(cardName(spell))}</strong><small>${targetHint}</small></div>
    ${recipe ? `<small class="tcg-recipe-hint" title="${escapeAttr(recipe.reward)}">Combo · ${recipe.name}</small>` : ''}
    <button class="button light" data-tcg-cancel-spell>Hủy</button>
  </div>` : '';
  const graveChoices = targets.filter(target => target.fallen);
  const action = match.result ? ''
    : tcgResponsePending(match) ? '<small role="status">Đang xử lý lượt đối thủ…</small>'
    : opening ? `<button class="button" data-tcg-mulligan>${runtime.mulligan.size ? 'Đổi ' + runtime.mulligan.size + ' lá' : 'Giữ bài và vào trận'}</button>`
    : spell ? spellControls
    : attacker ? strikeControls
    : table && canStrike ? `${tcgCanRotate(match, 0) ? '<button class="button light" data-tcg-rotate>Đổi chủ chiến</button>' : ''}<button class="button" data-tcg-end>Kết thúc lượt</button>`
    : canPlay ? `<button class="button" data-tcg-pass>${match.phase === 'reaction' ? 'Bỏ phản ứng' : 'Bỏ ưu tiên'}</button>`
    : showCombat ? `<button class="button" data-tcg-attack>${selected ? `Tấn công · ${selected} Vị Linh` : 'Bỏ tấn công'}</button>${selected ? '<button class="button light" data-tcg-skip>Bỏ tấn công</button>' : ''}`
    : match.phase === 'round_end' && match.activePlayer === 0 ? '<button class="button" data-tcg-end>Kết thúc lượt</button>' : '';
  shell(`
    ${matchHeader('Thẻ chiến thuật', `
      <button type="button" data-tcg-log>Nhật ký</button><button type="button" data-page="deck">Sửa bộ bài</button>
      <button type="button" data-tcg-rules>Luật nhanh</button>
      <button type="button" data-tcg-challenges>Thử thách</button>
      <button type="button" data-tcg-restart>Ván mới · Bot ${TCG_DIFFICULTIES[match.difficulty] ?? TCG_DIFFICULTIES.normal}</button>
      ${match.result ? '' : '<button type="button" data-tcg-surrender>Đầu hàng</button>'}`)}
    <div class="match-layout tcg-match" data-mulligan="${opening}" data-match-result="${Boolean(match.result)}" data-tcg-phase="${match.phase}" style="--tcg-columns:${tcgBoardLimit(match)}" ${table ? 'data-direct' : ''}>
      <section class="duel-field" aria-label="Bàn đấu thẻ" ${opening ? 'inert' : ''}>
        ${tcgCommander(match, 1, targets, strikes)}
        ${tcgRow(bot.units, 1, targets, declared, blocked, targetIds, defending, canStrike, strikes)}
        <div class="duel-mid"><div class="stack-strip">
          <b>${opening ? 'Vòng 1' : 'Vòng ' + match.round + ' · ' + phaseLabel}</b>
          ${opening || match.result ? '' : `<span>${match.activePlayer === 0 ? 'Lượt bạn' : 'Lượt đối thủ'} · ${match.priority === 0 ? 'Bạn ưu tiên' : 'Bot ưu tiên'}</span>
            ${match.activePlayer === 0 ? `<span>${table ? ready + ' quân sẵn sàng' : user.attackUsedRound === match.round ? 'Đã đánh' : 'Còn lượt đánh'}</span>` : ''}`}
        </div>
        ${match.stack.length ? tcgStackControl(match, targets) : ''}</div>
        ${tcgRow(user.units, 0, targets, declared, blocked, targetIds, defending, canStrike, strikes)}
        ${tcgCommander(match, 0, targets, strikes)}
        <canvas class="duel-effects" aria-hidden="true" hidden></canvas>
        ${tcgStageBanners(match)}
        ${runtime.tcgRecipeFlash?.matchId === match.battleId && runtime.tcgRecipeFlash.expires > performance.now() ? `<span class="tcg-recipe-flash" role="status">Combo · ${runtime.tcgRecipeFlash.name}</span>` : ''}
      </section>
      ${match.result ? '' : `<section class="match-command tcg-hand-dock" aria-label="${opening ? 'Đổi bài đầu trận' : 'Điều khiển đấu thẻ'}">
        ${trapChoice ? tcgTrapPanel(match) : defending ? tcgDefensePanel(incoming) : `
          <div class="hand-heading"><strong>${opening ? table ? 'Đổi bài · Chọn tối đa 3 lá' : 'Chọn lá muốn đổi' : 'Bài trên tay'}</strong><span>${!opening && user.chainElement && !user.resonanceUsed ? `Cộng hưởng ${ELEMENT_NAMES[user.chainElement]} · ` : ''}${user.hand.length}/${tcgHandLimit(match)} lá</span></div>
          <div class="hand-row" ${graveChoices.length ? 'aria-label="Chọn Vị Linh trong mộ bài"' : ''}>${graveChoices.length
            ? graveChoices.map(({ id, fallen }) => `<button type="button" class="tcg-grave-card spell-target" data-spell-target="${escapeAttr(id)}">
              <img src="${escapeAttr(matchCardArt(fallen))}" alt=""><span>${escapeHtml(cardName(fallen))}</span></button>`).join('')
            : hand || '<p class="empty-message">Không còn bài trên tay.</p>'}</div>
          ${showCombat && selected ? '<p class="match-hint">Chạm Vị Linh để chọn quân tấn công.</p>' : ''}
          ${action ? `<div class="match-actions tcg-actions">${action}</div>` : ''}`}
        ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      </section>`}
    </div>
  `);
  if (match.result) showBattleResult('Kết quả đấu thẻ', `<div class="result-box ${match.winner === 0 ? 'victory' : match.winner === null ? 'draw' : 'defeat'}">
    <strong>${phaseLabel}</strong><p>${escapeHtml(match.log.find(entry => entry.type === 'match_finished')?.text ?? phaseLabel)}
    ${challenge && match.winner === 0 ? ` Kỷ lục thử thách: vòng ${runtime.save.tcgChallengeBests[challenge.id]}.` : ''}</p>
    <div class="action-row"><button class="button" data-tcg-new>Ván mới</button></div></div>`);
  else tcgCardMotion.render(app, user.hand, app.dataset.motion === 'reduced');
  scheduleTcgResponse();
  app.querySelector('[data-tcg-log]').addEventListener('click', () => openInfoDialog('Nhật ký trận', renderTextLog(match.log)));
  app.querySelector('[data-tcg-rules]').addEventListener('click', showTcgRules);
  app.querySelector('[data-tcg-challenges]').addEventListener('click', () => openTcgSetup(match, true));
  for (const button of app.querySelectorAll('[data-tcg-stack]')) button.addEventListener('click', () => showTcgStack(match));
  app.querySelector('[data-tcg-hand]')?.addEventListener('click', () => {
    const cards = user.hand.map(card => `<li><strong>${escapeHtml(cardName(card))} · ${card.cost} mana</strong><small>${escapeHtml(tcgCardRule(card))}</small></li>`);
    openInfoDialog('Bài trên tay', cards.length ? `<ul class="tcg-graveyard">${cards.join('')}</ul>` : '<p>Không còn bài trên tay.</p>');
  });
  app.querySelectorAll('[data-view-tcg-card]').forEach(button => button.addEventListener('click', () => showTcgCard(button.dataset.viewTcgCard, button.dataset.inspectInstance)));
  app.querySelectorAll('[data-tcg-slot]').forEach(button => button.addEventListener('click', () => {
    const [owner, slot] = button.dataset.tcgSlot.split(':').map(Number);
    showTcgTrapSlot(match, owner, slot);
  }));
  app.querySelector('[data-tcg-graveyard]')?.addEventListener('click', () => showTcgGraveyard(user.graveyard));
  app.querySelector('[data-tcg-surrender]')?.addEventListener('click', () => {
    const dialog = openInfoDialog('Đầu hàng ván đấu này?', '<button type="button" class="button danger" data-confirm-surrender>Đầu hàng</button>');
    dialog.querySelector('[data-confirm-surrender]').addEventListener('click', () => {
      dialog.close();
      actTcg(() => surrenderTcg(runtime.tcg, 0));
    }, { once: true });
  });
  const spellButtons = [...app.querySelectorAll('[data-spell-target]')];
  for (const button of spellButtons) button.addEventListener('click', () => playTcgFromHand(spell, button.dataset.spellTarget));
  app.querySelector('[data-tcg-cancel-spell]')?.addEventListener('click', () => {
    runtime.selectedSpell = null;
    renderTcg();
    app.querySelector(`[data-card="${CSS.escape(spell.instance_id)}"]`)?.focus({ preventScroll: true });
  });
  app.querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.card;
    if (opening) {
      if (!runtime.mulligan.delete(id) && (!table || runtime.mulligan.size < 3)) runtime.mulligan.add(id);
      renderTcg();
      app.querySelector(`[data-card="${CSS.escape(id)}"]`)?.focus();
      return;
    }
    const card = user.hand.find(item => item.instance_id === id);
    if (!card || tcgCardIssue(match, 0, card)) return;
    if (card.type === 'unit') {
      playTcgFromHand(card);
      return;
    }
    selectTcgCard(card, runtime.selectedSpell !== id);
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
  const strikeButtons = [...app.querySelectorAll('[data-tcg-strike-target]')];
  for (const button of strikeButtons) {
    button.addEventListener('click', () => actTcg(() => strikeTcg(runtime.tcg, 0, attacker.instance_id, button.dataset.tcgStrikeTarget)));
  }
  if (spell) bindTcgAim(app.querySelector(`[data-card="${CSS.escape(spell.instance_id)}"]`), spellButtons);
  if (attacker) {
    const hint = app.querySelector('[data-tcg-strike-hint]');
    const defaultHint = hint.textContent;
    bindTcgAim(app.querySelector(`[data-tcg-attacker="${CSS.escape(attacker.instance_id)}"]`), strikeButtons, button => {
      const target = strikes.find(item => item.id === button?.dataset.tcgStrikeTarget);
      const preview = target && tcgStrikePreview(attacker, target.unit, bot.hp);
      hint.textContent = preview
        ? `${target.label} · −${preview.damage} ${target.unit ? 'DEF' : 'HP'}${preview.absorbed ? ` · Khiên chặn ${preview.absorbed}` : ''}${target.unit ? ` · Phản đòn −${preview.counter} DEF` : ''}${preview.spill ? ` · Xuyên −${preview.spill} HP` : ''}`
        : defaultHint;
    });
  }
  app.querySelector('[data-tcg-cancel-strike]')?.addEventListener('click', () => { runtime.tcgStrike = null; renderTcg(); });
  if (table && !opening && !match.result) bindTcgDrag(match, canStrike);
  app.querySelector('[data-tcg-attack]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [...runtime.tcgAttackers])));
  if (defending) bindTcgDefense();
  if (trapChoice) bindTcgTrapPanel(match);
  app.querySelector('[data-tcg-skip]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [])));
  app.querySelector('[data-tcg-rotate]')?.addEventListener('click', () => {
    const active = tcgActiveUnit(match, 0);
    const choices = user.units.filter(unit => unit.current_def > 0 && unit.instance_id !== active.instance_id);
    const dialog = openInfoDialog('Đổi chủ chiến · 1 mana', `<div class="action-row">${choices.map(unit =>
      `<button type="button" class="button light" data-tcg-active="${escapeAttr(unit.instance_id)}">${escapeHtml(cardName(unit))}</button>`).join('')}</div>`);
    dialog.querySelectorAll('[data-tcg-active]').forEach(button => button.addEventListener('click', () => {
      dialog.close();
      actTcg(() => rotateTcgActive(match, 0, button.dataset.tcgActive));
    }));
  });
  app.querySelector('[data-tcg-end]')?.addEventListener('click', () => actTcg(() => endTcgTurn(runtime.tcg, 0)));
  app.querySelector('[data-tcg-new]')?.addEventListener('click', () => {
    const result = app.querySelector('.battle-result-dialog');
    const setup = openTcgSetup(match);
    setup?.addEventListener('close', () => result?.querySelector('[data-tcg-new]')?.focus(), { once: true });
  });
  app.querySelector('[data-tcg-restart]')?.addEventListener('click', () => openTcgSetup(match));
  saveNow();
}

function bindTcgAim(origin, buttons, describe) {
  if (!origin || !buttons.length) return;
  const field = app.querySelector('.duel-field');
  const line = document.createElement('span');
  line.className = 'tcg-target-line';
  line.setAttribute('aria-hidden', 'true');
  line.hidden = true;
  field.append(line);
  let target;
  const paint = () => {
    line.hidden = !target;
    if (!target) return;
    const base = field.getBoundingClientRect();
    const start = origin.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const y = Math.min(start.top + start.height / 2, base.bottom - 2);
    const dx = end.left + end.width / 2 - x;
    const dy = end.top + end.height / 2 - y;
    line.style.left = x - base.left + 'px';
    line.style.top = y - base.top + 'px';
    line.style.width = Math.hypot(dx, dy) + 'px';
    line.style.rotate = Math.atan2(dy, dx) + 'rad';
  };
  const aim = button => { target = button; describe?.(button); paint(); };
  for (const button of buttons) {
    button.addEventListener('pointerenter', () => aim(button));
    button.addEventListener('pointerleave', () => aim(document.activeElement === button ? button : null));
    button.addEventListener('focus', () => aim(button));
    button.addEventListener('blur', () => aim(null));
  }
  tcgTargetResize = new ResizeObserver(paint);
  tcgTargetResize.observe(field);
}

function selectTcgCard(card, selected = true) {
  runtime.tcgStrike = null;
  runtime.selectedSpell = selected ? card.instance_id : null;
  renderTcg();
  const focus = selected && app.querySelector('[data-spell-target]');
  (focus || app.querySelector(`[data-card="${CSS.escape(card.instance_id)}"]`))?.focus({ preventScroll: true });
}

function tcgPlayTargets(match, card) {
  if (card.type === 'unit') return [];
  if (card.type === 'trap') return tcgOpenTrapSlots(match, 0).map(slot =>
    ({ id: 'set:' + slot, player: 0, slot, label: 'Ô bẫy ' + (slot + 1) }));
  return tcgSpellTargets(match, 0, card);
}

function playTcgFromHand(card, target) {
  if (!card) return;
  runtime.tcgPlayingCard = card;
  try {
    actTcg(() => playTcgCard(runtime.tcg, 0, card.instance_id, target));
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
        if (card && !tcgCardIssue(match, 0, card)) return { card, targets: tcgPlayTargets(match, card) };
      } else if (canStrike) {
        const unit = match.players[0].units.find(item => item.instance_id === element.dataset.tcgAttacker);
        if (unit && tcgCanAttack(unit)) return { unit, targets: tcgStrikeTargets(match, 0) };
      }
    },
    locate(source, element) {
      const anchor = element?.closest('[data-tcg-stack-id], [data-tcg-deck], [data-duel-id], [data-tcg-row], [data-spell-target="row"]');
      if (!anchor) return null;
      const row = Number(anchor.closest('[data-tcg-row]')?.dataset.tcgRow);
      const id = anchor.dataset.duelId;
      if (source.card?.type === 'unit' && row === 0) return { element: anchor.closest('[data-tcg-row]'), state: 'valid' };
      if (source.card?.effect?.kind === 'raise_ally' && row === 0) return { element: anchor, state: 'valid', chooseGrave: true };
      const target = source.targets.find(item => {
        if (source.unit) return item.id === (id === 'commander:p1' ? 'commander' : id);
        if (item.id === 'commander') return id === 'commander:p' + item.player;
        if (item.id === 'deck') return anchor.hasAttribute('data-tcg-deck');
        if (item.id === 'row') return row === item.player;
        if (item.item) return anchor.dataset.tcgStackId === String(item.item.id);
        if (item.slot !== undefined) return id === tcgTrapAnchor(item.player, item.slot);
        return item.id === id;
      });
      return { element: anchor, state: target ? 'valid' : 'blocked', target };
    },
    drop(source, { target, chooseGrave }) {
      if (chooseGrave) {
        selectTcgCard(source.card);
        return;
      }
      if (source.card) return playTcgFromHand(source.card, target?.id);
      actTcg(() => strikeTcg(runtime.tcg, 0, source.unit.instance_id, target.id));
    },
    preview({ card, unit }, ghost) {
      paintTableGhost(ghost, matchCardArt(card ?? unit), cardName(card ?? unit));
    },
    inspect({ card, unit }) {
      const selected = card ?? unit;
      showTcgCard(selected.card_id, selected.instance_id);
    },
    reject({ card, unit }) {
      runtime.notice = unit ? 'Chọn mục tiêu đang được đánh dấu.'
        : card.type === 'unit' ? 'Thả Vị Linh lên hàng của bạn hoặc bấm lá để triệu hồi.'
        : card.type === 'trap' ? 'Thả lá bẫy vào ô bẫy của bạn.' : 'Chọn mục tiêu hợp lệ cho lá bài.';
      renderTcg();
    },
  });
}

function openTcgSetup(match, challenges = false) {
  const presets = tcgPresets();
  const encounters = runtime.cards.table_challenges ?? [];
  const dialog = openInfoDialog('Ván đấu thẻ mới', `
    <div class="challenge-pickers tcg-new-options">
      <label>Chế độ<select data-tcg-format>
        <option value="duel">Đấu tự do</option><option value="frontline" ${match.frontline && !challenges ? 'selected' : ''}>Chủ chiến và dự bị</option><option value="challenge" ${challenges ? 'selected' : ''}>Thử thách</option>
      </select></label>
      <label data-tcg-setup-duel>Độ khó bot<select data-tcg-difficulty>${Object.entries(TCG_DIFFICULTIES).map(([id, label]) =>
        `<option value="${id}" ${(match.difficulty ?? 'normal') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label data-tcg-setup-duel>Bộ bài bot<select data-tcg-opponent><option value="">Theo độ khó</option>${presets.map(preset =>
        `<option value="${escapeAttr(preset.id)}">${escapeHtml(preset.name)}</option>`).join('')}</select></label>
      <label data-tcg-setup-challenge>Đối thủ<select data-tcg-challenge>${encounters.map(encounter => {
        const best = runtime.save.tcgChallengeBests?.[encounter.id];
        return `<option value="${escapeAttr(encounter.id)}">${escapeHtml(encounter.name)}${best ? ' · Kỷ lục vòng ' + best : ''}</option>`;
      }).join('')}</select></label>
    </div>
    <p data-tcg-difficulty-detail></p><p data-tcg-opponent-detail></p>
    ${match.result ? '' : '<p>Ván hiện tại sẽ kết thúc khi bắt đầu ván mới.</p>'}
    <button type="button" class="button" data-tcg-start-match>Bắt đầu ván mới</button>`);
  const format = dialog.querySelector('[data-tcg-format]');
  const picker = dialog.querySelector('[data-tcg-difficulty]');
  const opponent = dialog.querySelector('[data-tcg-opponent]');
  const challenge = dialog.querySelector('[data-tcg-challenge]');
  const difficulty = dialog.querySelector('[data-tcg-difficulty-detail]');
  const detail = dialog.querySelector('[data-tcg-opponent-detail]');
  const details = {
    normal: 'Bot triển khai quân sớm và tấn công khi có mục tiêu.',
    hard: 'Bot cân nhắc mục tiêu phép, giữ quân và chọn trao đổi có lợi.',
    extreme: 'Bot tính sát thương, phản đòn và ưu tiên cơ hội kết thúc ván.',
  };
  function update() {
    const challengeMode = format.value === 'challenge';
    for (const label of dialog.querySelectorAll('[data-tcg-setup-duel]')) label.hidden = challengeMode;
    dialog.querySelector('[data-tcg-setup-challenge]').hidden = !challengeMode;
    if (challengeMode) {
      const encounter = encounters.find(item => item.id === challenge.value);
      difficulty.textContent = `${TCG_DIFFICULTIES[encounter.difficulty]} · ${encounter.commander_hp} HP chủ soái`;
      detail.textContent = encounter.description;
    } else {
      difficulty.textContent = details[picker.value];
      const preset = presets.find(item => item.id === (opponent.value || tcgDefaultPreset(picker.value)));
      detail.textContent = format.value === 'frontline'
        ? 'Một Vị Linh chủ chiến, bốn vị trí dự bị. Đổi chủ chiến tốn 1 mana, một lần mỗi lượt.'
        : `${preset.name} · ${preset.description}`;
    }
  }
  for (const control of [format, picker, opponent, challenge]) control.addEventListener('change', update);
  dialog.querySelector('[data-tcg-start-match]').addEventListener('click', () => {
    runtime.tcg = startTcg(Date.now() % 999_983, picker.value, opponent.value, format.value === 'challenge' ? challenge.value : '', format.value === 'frontline');
    runtime.notice = '';
    dialog.close();
    saveNow();
    renderTcg();
  });
  update();
  return dialog;
}

let tcgResponseTimer;

function scheduleTcgResponse() {
  clearTimeout(tcgResponseTimer);
  if (runtime.page !== 'tcg' || !tcgResponsePending(runtime.tcg)) return;
  const match = runtime.tcg;
  tcgResponseTimer = setTimeout(() => {
    if (runtime.page !== 'tcg' || runtime.tcg !== match) return;
    if (document.hidden || app.querySelector('dialog[open], .match-menu[open]')) {
      scheduleTcgResponse();
      return;
    }
    actTcg(() => stepTcgResponse(match));
  }, match.priority === 0 ? 350 : 800);
}

function actTcg(action) {
  try {
    tcgPresentationTurn++;
    runtime.tcg = action();
    runtime.selectedSpell = null;
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
    const trap = traps.find((trap, index) => tcgTrapSlot(trap, index) === slot);
    const id = tcgTrapAnchor(owner, slot);
    const target = targets.find(target => target.player === owner && target.slot === slot);
    if (!trap && owner === 1) return `<span class="tcg-trap-slot empty" data-duel-id="${id}" aria-label="Ô bẫy địch trống">${tcgImpact(id)}</span>`;
    const visible = trap && (owner === 0 || !trap.faceDown);
    const concealed = trap && (usesTcgTable(match) ? trap.faceDown : !visible);
    const armed = trap && tcgTrapArmed(match, trap);
    const label = !trap ? 'Ô bẫy ' + (slot + 1) + ' còn trống'
      : (visible ? cardName(trap.card) : 'Bẫy địch đang úp') + (armed ? ' · Sẵn sàng' : ' · Chờ đổi lượt');
    return `<button type="button" class="tcg-trap-slot ${trap ? 'set' : 'empty'} ${concealed ? 'tcg-card-back' : ''} ${armed ? 'armed' : ''} ${target ? 'spell-target' : ''}"
      data-duel-id="${id}" aria-label="${escapeAttr(label)}" ${target ? `data-spell-target="${escapeAttr(target.id)}"` : `data-tcg-slot="${owner}:${slot}"`}>
      ${concealed ? '<span aria-hidden="true">◆</span>' : visible ? `<img src="${escapeAttr(cardArt(trap.card))}" alt="">` : '+'}${tcgImpact(id)}
    </button>`;
  }).join('')}</div>`;
}

function showTcgTrapSlot(match, owner, slot) {
  const trap = match.players[owner].traps.find((trap, index) => tcgTrapSlot(trap, index) === slot);
  if (trap) {
    if (owner === 0 || !trap.faceDown) showTcgCard(trap.card.card_id);
    else openInfoDialog('Bẫy địch đang úp', `<p>${tcgTrapArmed(match, trap) ? 'Bẫy đã sẵn sàng.' : 'Bẫy sẵn sàng khi đổi lượt.'} Bạn có thể dùng phép Soi Dấu Bẫy để biết danh tính hoặc Phá Ấn Thất Vị để gỡ.</p>`);
    return;
  }
  const hand = match.players[0].hand.filter(card => card.type === 'trap');
  const options = hand.map(card => `<button type="button" class="button light" data-place-trap="${escapeAttr(card.instance_id)}" ${tcgCardIssue(match, 0, card) || match.mulliganDone === false && match.eventSeq === 0 ? 'disabled' : ''}>${escapeHtml(cardName(card))} · ${card.cost} mana</button>`).join('');
  const dialog = openInfoDialog('Đặt bẫy úp', hand.length ? `<div class="action-row">${options}</div>` : `<p>Chọn bẫy trên tay rồi bấm ô sáng khi đến lượt triển khai. Bạn có ${tcgTrapLimit(match)} ô bẫy.</p>`);
  dialog.querySelectorAll('[data-place-trap]').forEach(button => button.addEventListener('click', () => {
    dialog.close();
    playTcgFromHand(hand.find(card => card.instance_id === button.dataset.placeTrap), 'set:' + slot);
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
    <div class="trap-options" role="group" aria-label="Chọn bẫy">${options.map(({ card }) =>
      `<button type="button" class="trap-option element-${card.element}" data-tcg-trap-option="${escapeAttr(card.instance_id)}" title="${escapeAttr(tcgTrapRule(card))}">
        <img src="${escapeAttr(cardArt(card))}" alt=""><span>${escapeHtml(cardName(card))}</span>
      </button>`).join('')}</div>
    <div class="match-actions trap-actions"><span>Bấm lá để lật bẫy.</span>
      <button type="button" class="button light" data-tcg-hold-trap>Giữ bẫy</button></div>
  </section>`;
}

function bindTcgTrapPanel(match) {
  for (const button of app.querySelectorAll('[data-tcg-trap-option]')) {
    button.addEventListener('click', () => actTcg(() => decideTcgTrap(match, 0, button.dataset.tcgTrapOption)));
  }
  app.querySelector('[data-tcg-hold-trap]').addEventListener('click', () => actTcg(() => decideTcgTrap(runtime.tcg, 0)));
}

function showTcgRules() {
  openInfoDialog('Luật nhanh', `<ul class="tcg-quick-rules">
    <li>Triển khai bằng mana. Hai lá lộ hệ liên tiếp cùng hệ giảm 1 mana cho lá sau, một lần mỗi lượt. Úp bẫy ngắt chuỗi.</li>
    ${usesTcgTable(runtime.tcg)
      ? `<li>Bộ 24 lá. Đặt tối đa ${tcgBoardLimit(runtime.tcg)} Vị Linh và ${tcgTrapLimit(runtime.tcg)} bẫy. Bấm Vị Linh để tự vào ô trống đầu tiên. Chọn phép hoặc bẫy rồi bấm mục tiêu sáng.</li><li>Mỗi Vị Linh sẵn sàng đánh một lần trong lượt. Rê chuột hoặc đặt tiêu điểm để xem sát thương. Bấm mục tiêu để đánh. Hộ vệ phải bị đánh trước. Hai Vị Linh giao chiến sẽ đánh trả đồng thời.</li>`
      : '<li>Chọn quân đánh. Khi phòng thủ, chạm quân địch rồi chạm đồng minh để chặn. Quân bị trói không thể đánh hoặc chặn.</li>'}
    <li>Phép trong hàng chờ xử lý từ lá mới nhất. Tốc chú và Tức chú có thể phản ứng. Tức chú xử lý ngay.</li>
    ${runtime.tcg.frontline ? '<li>Vị Linh chủ chiến đỡ đòn thường và là quân duy nhất có thể tấn công. Đổi chủ chiến tốn 1 mana, một lần mỗi lượt.</li>' : ''}
    <li>Bẫy sẵn sàng sau khi đổi lượt. Khi đúng điều kiện, chọn kích hoạt hoặc giữ lại. Đối thủ có thể phản ứng với bẫy đã lật.</li>
    ${usesTcgTable(runtime.tcg) ? '<li>Triệu hồi Vị Linh rồi dùng phép tương ứng ngay sau đó để kích hoạt combo. Mỗi combo dùng một lần trong lượt.</li>' : ''}
    <li>Tuyệt kỹ yêu cầu Vị Linh tương ứng còn trên bàn khi xử lý.</li></ul>`);
}

function tcgStackControl(match, targets) {
  return `<div class="tcg-stack-controls" aria-label="Thứ tự xử lý phản ứng">
    ${[...match.stack].reverse().map(({ id, card, owner }, order) => {
      const direct = targets.find(target => target.item?.id === id);
      const label = `${order + 1}. ${cardName(card)} · ${owner === 0 ? 'Của bạn' : 'Đối thủ'}`;
      return `<button type="button" data-tcg-stack-id="${escapeAttr(id)}"
        class="tcg-stack-button ${card.type === 'trap' ? 'has-trap' : ''} ${direct ? 'spell-target' : ''}"
        title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"
        ${direct ? `data-spell-target="${escapeAttr(direct.id)}"` : 'data-tcg-stack'}>
        <small>${order + 1}</small><img src="${escapeAttr(matchCardArt(card))}" alt=""><b>${escapeHtml(cardName(card))}</b>
      </button>`;
    }).join('')}
  </div>`;
}

function showTcgStack(match) {
  openInfoDialog('Hàng chờ phản ứng', `<ol class="tcg-stack-list">${[...match.stack].reverse().map(({ card, owner }, index) => {
    return `<li><img src="${escapeAttr(cardArt(card))}" alt=""><div><strong>${escapeHtml(cardName(card))}</strong>
      <small>${owner === 0 ? 'Của bạn' : 'Đối thủ'}${index === 0 ? ' · Xử lý trước' : ''}</small><p>${escapeHtml(tcgCardRule(card))}</p></div>
      </li>`;
  }).join('')}</ol>`);
}

function tcgStageBanners(match) {
  const now = performance.now();
  const reveal = runtime.tcgReveal;
  const cut = runtime.tcgCutIn;
  const card = cut?.matchId === match.battleId && cut.expires > now && runtime.cards.cards.find(card => card.card_id === cut.card_id);
  const trap = reveal?.matchId === match.battleId && reveal.expires > now && runtime.cards.cards.find(card => card.card_id === reveal.card_id);
  const commander = cut?.quote && cut.player_index === 0;
  const art = commander ? TCG_COMMANDER_ART : card && matchCardArt(card);
  return `${trap ? `<div class="tcg-trap-flash element-${trap.element}" role="status" style="--flash-duration:${Math.round(reveal.expires - now)}ms">
    <img src="${escapeAttr(cardArt(trap))}" alt=""><span><small>${reveal.trigger === 'scout' ? 'Lộ bẫy' : 'Lật bẫy'}</small><b>${escapeHtml(cardName(trap))}</b></span></div>` : ''}
  ${card ? `<div class="tcg-cutin element-${card.element}" data-invocation="${cut.kind}" data-owner="${cut.player_index}" role="status"
      style="--flash-duration:${Math.round(cut.expires - now)}ms">
    <img class="tcg-cutin-art" src="${escapeAttr(art)}" alt="">
    <div><small>${cut.player_index === 1 ? 'Đối thủ · ' : ''}${cut.title}</small><strong>${escapeHtml(cardName(card))}</strong>
      ${cut.quote ? `<span>“${cut.quote}”</span>` : ''}</div>
    ${commander ? `<img class="tcg-cutin-card" src="${escapeAttr(matchCardArt(card))}" alt="">` : ''}
  </div>` : ''}`;
}

function tcgRow(units, player, targets, ...options) {
  const row = targets.find(target => target.id === 'row' && target.player === player);
  return `<div class="unit-row ${player === 0 ? 'friendly' : 'enemy'}-row ${row ? 'tcg-row-target' : ''}" data-tcg-row="${player}">
    ${tcgLanes(units, player === 0, ...options)}
    ${row ? `<button type="button" class="tcg-row-action spell-target" data-spell-target="row">${escapeHtml(row.label)}</button>` : ''}
  </div>`;
}

function tcgLanes(units, friendly, declared, blocked, targetIds, defending, canStrike, strikes) {
  const player = friendly ? 0 : 1;
  return Array.from({ length: tcgBoardLimit(runtime.tcg) }, (_, lane) => {
    const laneId = tcgLaneId(player, lane);
    const unit = units.find((candidate) => candidate.lane === lane);
    if (!unit) {
      const impact = runtime.tcgImpacts.get(laneId);
      const fallen = impact?.matchId === runtime.tcg.battleId && impact.expires > performance.now() ? impact.fallen : null;
      return `<div class="empty-slot" data-duel-id="${laneId}" aria-label="Vị trí ${lane + 1} trống">
        ${fallen ? `<span class="tcg-unit-avatar tcg-fallen" style="--contact-delay:${Math.round(impact.contact - performance.now())}ms"><img src="${escapeAttr(fallen)}" alt=""></span>` : ''}
        ${tcgImpact(laneId)}</div>`;
    }
    const selectable = friendly && (canStrike || runtime.tcgAttackers) && tcgCanStrike(runtime.tcg, player, unit);
    const selected = Boolean(selectable && (runtime.tcgStrike?.attacker === unit.instance_id || runtime.tcgAttackers?.has(unit.instance_id)));
    const guard = unit.keywords?.includes('guard');
    const attacking = declared.has(unit.instance_id);
    const blocking = blocked.has(unit.instance_id);
    const badge = unit.rootedUntil ? 'Trói' : selected || attacking ? 'Tấn công' : blocking ? 'Chặn' : unit.ready ? 'Sẵn sàng' : 'Nghỉ';
    const frontline = runtime.tcg.frontline && tcgActiveUnit(runtime.tcg, player)?.instance_id === unit.instance_id;
    const mark = badge === 'Tấn công' ? '⚔' : badge === 'Chặn' ? '◆' : badge;
    const css = `tcg-unit element-${unit.element} ${friendly ? 'friendly' : ''} ${selected || attacking ? 'tcg-attacking' : ''} ${blocking ? 'tcg-blocking' : ''}`;
    const portrait = `<img src="${escapeAttr(matchCardArt(unit))}" alt="" draggable="false">`;
    const impact = runtime.tcgImpacts.get(unit.instance_id);
    const timing = impact?.style === 'damage' ? `style="--splash-hit-delay:${Math.round(impact.contact - performance.now())}ms"` : '';
    const identity = `data-duel-id="${escapeAttr(unit.instance_id)}" data-ready="${tcgCanAttack(unit)}" data-rooted="${Boolean(unit.rootedUntil)}" ${guard ? 'data-guard' : ''} ${frontline ? 'data-frontline' : ''} ${timing}`;
    const atk = tcgUnitAttack(unit);
    const shield = unit.shield ? `<span class="lane-shield" title="Hộ thuẫn ${unit.shield}">+${unit.shield}</span>` : '';
    const content = `<span class="tcg-unit-avatar card-illustration" style="--card-backdrop:url('${cardBackdrop(unit.element)}')">${portrait}</span><b>${escapeHtml(cardName(unit))}</b>
      <span class="lane-stats" aria-label="${atk} tấn công, ${unit.current_def} phòng thủ${unit.shield ? ', ' + unit.shield + ' hộ thuẫn' : ''}"><b class="${unit.attackBuff < 0 ? 'lane-weakened' : unit.attackBuff > 0 ? 'lane-boost' : ''}">${atk}</b> / <b>${unit.current_def}</b>${shield}</span>
      <small class="lane-state" title="${badge}" aria-label="${badge}">${mark}</small>${frontline ? '<span class="tcg-frontline-label">Chủ chiến</span>' : ''}${guard ? '<span class="lane-guard" title="Hộ vệ" aria-label="Hộ vệ">◆</span>' : ''}${tcgImpact(unit.instance_id)}`;
    if (targetIds.has(unit.instance_id)) {
      return `<button type="button" class="${css} spell-target" ${identity} data-spell-target="${escapeAttr(unit.instance_id)}">${content}</button>`;
    }
    if (strikes.some(target => target.id === unit.instance_id)) {
      return `<button type="button" class="${css} strike-target" ${identity} data-tcg-strike-target="${escapeAttr(unit.instance_id)}">${content}</button>`;
    }
    if (defending && !friendly && attacking) return `<button type="button" class="${css}" ${identity} data-tcg-incoming="${lane}" aria-pressed="false">${content}</button>`;
    if (defending && friendly && tcgCanBlock(unit)) return `<button type="button" class="${css}" ${identity} data-tcg-defender="${escapeAttr(unit.instance_id)}" aria-pressed="false">${content}</button>`;
    return selectable
      ? `<button type="button" class="${css}" ${identity} data-tcg-attacker="${escapeAttr(unit.instance_id)}" aria-pressed="${selected}">${content}</button>`
      : `<div class="${css}" ${identity}>${content}</div>`;
  }).join('');
}

function tcgDefensePanel(attackers) {
  return `<section class="tcg-defense" aria-label="Chọn quân chặn">
    <div class="tcg-defense-header"><strong>Chọn quân chặn</strong><span data-tcg-exposed role="status"></span></div>
    <div class="tcg-block-grid">${attackers.map(unit => `<button type="button" class="button light" data-tcg-block-lane="${unit.lane}" aria-pressed="false">
      ${escapeHtml(cardName(unit))} · ${tcgUnitAttack(unit)} ATK
    </button>`).join('')}</div>
    <div class="tcg-defense-actions">
      <button type="button" class="button" data-tcg-confirm-block>Chốt phòng thủ</button>
      <button type="button" class="button light" data-tcg-hand>Bài trên tay</button>
    </div>
  </section>`;
}

function bindTcgDefense() {
  const exposed = app.querySelector('[data-tcg-exposed]');
  const incoming = [...app.querySelectorAll('[data-tcg-incoming], [data-tcg-block-lane]')];
  const defenders = [...app.querySelectorAll('[data-tcg-defender]')];
  const incomingLane = button => Number(button?.dataset.tcgIncoming ?? button?.dataset.tcgBlockLane);
  const assignments = new Map();
  let lane = incomingLane(incoming[0]);
  const blocks = () => [...assignments].map(([lane, blockerId]) => ({ lane, blockerId }));
  function updateBlocks() {
    for (const button of incoming) button.setAttribute('aria-pressed', String(incomingLane(button) === lane));
    for (const button of defenders) {
      const assigned = blocks().find(block => block.blockerId === button.dataset.tcgDefender);
      button.setAttribute('aria-pressed', String(Boolean(assigned)));
      button.dataset.blockLane = assigned ? String(assigned.lane + 1) : '';
    }
    const damage = tcgExposedDamage(declaredTcgAttackers(runtime.tcg), runtime.tcg.players[0].units, blocks());
    exposed.textContent = `Chủ soái dự kiến nhận ${damage} sát thương`;
  }
  for (const button of incoming) button.addEventListener('click', () => { lane = incomingLane(button); updateBlocks(); });
  for (const button of defenders) button.addEventListener('click', () => {
    if (!Number.isInteger(lane)) return;
    const id = button.dataset.tcgDefender;
    const same = assignments.get(lane) === id;
    for (const [otherLane, blockerId] of assignments) if (blockerId === id) assignments.delete(otherLane);
    if (!same) assignments.set(lane, id);
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
  const presets = tcgPresets();
  const library = [...runtime.cards.cards].sort((a, b) => a.cost - b.cost || a.display_name.localeCompare(b.display_name, 'vi'));
  shell(`${pageHeader('Thẻ chiến thuật', 'Bộ bài của bạn', 'Chọn 24 lá, tối đa hai bản sao mỗi lá.')}
    <section class="panel deck-editor">
      <div class="deck-workbench">
        <div class="deck-summary" data-deck-drop><div><strong>${count}/${TCG_TABLE_DECK_SIZE} lá</strong><small>${totals.unit} Vị Linh · ${totals.spell} phép · ${totals.trap} bẫy</small><small>Kéo thẻ vào đây để thêm.</small></div>
        <div class="deck-curve" role="group" aria-label="Phân bố mana">${curve.map((amount, index) =>
          `<span title="${amount} lá giá ${index === 5 ? '5+' : index} mana" aria-label="${index} mana, ${amount} lá"><i style="--card-share:${amount / Math.max(1, ...curve) * 100}%"></i><b>${index === 5 ? '5+' : index}</b></span>`).join('')}</div></div>
        <div class="action-row"><label class="tcg-setup">Ô bộ bài<select data-deck-slot>${slots.map((deck, index) =>
          `<option value="${index}" ${index === slot ? 'selected' : ''}>Bộ ${index + 1}${index === activeSlot ? ' · Đang dùng' : !deck ? ' · Trống' : ''}</option>`).join('')}</select></label>
          <button class="button" data-deck-save ${count === TCG_TABLE_DECK_SIZE ? '' : 'disabled'}>Lưu và dùng</button>
          <label class="tcg-setup"><span>Bộ mẫu</span><select data-deck-preset>${presets.map(preset => `<option value="${escapeAttr(preset.id)}">${escapeHtml(preset.name)}</option>`).join('')}</select></label>
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
        return `<article class="deck-card element-${card.element}" style="--card-backdrop:url('${cardBackdrop(card.element)}')" data-deck-entry="${card.card_id}"><img data-deck-drag="${card.card_id}" src="${escapeAttr(matchCardArt(card))}" alt="" loading="lazy"><div><button class="deck-card-name" type="button" data-view-tcg-card="${escapeAttr(card.card_id)}">${escapeHtml(cardName(card))}</button><small>${card.requires_character ? 'Tuyệt kỹ' : CARD_TYPES[card.type]} · ${card.cost} mana</small></div><div class="deck-count"><button class="button light" data-deck-id="${card.card_id}" data-change="-1" aria-label="Bớt ${escapeAttr(cardName(card))}" ${copies === 0 ? 'disabled' : ''}>−</button><b>${copies}</b><button class="button light" data-deck-id="${card.card_id}" data-change="1" aria-label="Thêm ${escapeAttr(cardName(card))}" ${copies === 2 || count >= TCG_TABLE_DECK_SIZE ? 'disabled' : ''}>+</button></div></article>`;
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
  runtime.heldKeys.clear();
  runtime.worldStick = null;
  if (menu) menu.open = false;
  const dialog = document.createElement('dialog');
  const titleId = 'game-info-' + crypto.randomUUID();
  dialog.className = 'game-info-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<header class="story-heading"><h2 id="${titleId}">${escapeHtml(title)}</h2>
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

function showBattleResult(title, content) {
  const dialog = openInfoDialog(title, content);
  dialog.classList.add('battle-result-dialog');
  dialog.querySelector('[data-close-info]').remove();
  dialog.querySelector('.result-box').insertAdjacentHTML('beforeend',
    '<div class="action-row"><button type="button" class="button light" data-result-home>Về sảnh</button></div>');
  dialog.querySelector('[data-result-home]').addEventListener('click', () => { dialog.close(); navigate('home'); }, { once: true });
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.querySelector('.result-box button')?.focus({ preventScroll: true });
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
  const activeItem = run.items?.[runtime.selectedChessItem];
  const probabilities = runtime.shopConfig.probabilities_percent[String(run.level)] ?? [];
  const odds = probabilities.map((chance, index) => [runtime.shopConfig.cost_tiers[index], chance]);
  const oddsLabel = odds.map(([cost, chance]) => `${cost} vàng: ${chance}%`).join(' · ');
  const itemTarget = unit => activeItem && unit && chessItemPlacement(unit, activeItem);
  const itemHint = unit => {
    const placement = itemTarget(unit);
    return placement ? (placement.id === activeItem ? 'Trang bị ' : 'Ghép thành ') + CHESS_ITEMS[placement.id].name : '';
  };
  const activeTraits = Object.entries(CHESS_TRAITS).filter(([id]) => run.lobby || Object.hasOwn(ELEMENT_NAMES, id));
  const activeSynergies = activeTraits.filter(([id]) => traits.get(id) >= 2).length;
  const synergies = renderSynergies(traits, activeTraits);
  const boardCells = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7; const y = 3 - Math.floor(index / 7);
    const unitIndex = run.board.findIndex((unit) => unit.x === x && unit.y === y);
    const unit = run.board[unitIndex];
    const chibi = unit ? boardChibi(unit.id, `chess:${run.seed}:p:${unitIndex}:${unit.id}`, 'E', chessPortrait(unit)) : '';
    return `<button class="chess-cell ${run.lobby && y % 2 ? 'hex-offset' : ''} ${unit ? 'occupied element-' + unit.element : ''} ${runtime.selectedBench !== null && (unit || run.board.length < run.level) ? 'place-target' : ''} ${runtime.selectedBoard === unitIndex && unit ? 'selected' : ''} ${itemTarget(unit) ? 'place-target' : ''}" title="${escapeAttr(itemHint(unit))}" data-cell="${x},${y}" ${preparing && unit ? `data-chess-board-index="${unitIndex}"` : ''} ${preparing ? '' : 'disabled'} aria-label="Ô ${x + 1}, ${y + 1}${unit ? ', ' + escapeAttr(unit.display_name) : ''}">${unit ? `${chibi}${chessStars(unit, x, y)}${chessEquipmentMarker(unit)}` : ''}</button>`;
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
    return unit ? `<button class="bench-unit element-${unit.element} ${runtime.selectedBench === index ? 'selected' : ''} ${itemTarget(unit) ? 'place-target' : ''}" title="${escapeAttr(itemHint(unit))}" data-bench="${index}" ${position} aria-label="${escapeAttr(unit.display_name)} · ${unit.star} sao">${chessPortrait(unit)}${chessStars(unit, null, null, slot)}${chessEquipmentMarker(unit)}</button>`
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
  const selectionHint = activeItem ? CHESS_ITEMS[activeItem].name + ' · Chọn quân sáng' : runtime.selectedBench !== null && run.board.length >= run.level ? 'Đổi với quân đang trên bàn'
    : runtime.selectedBench !== null || runtime.selectedBoard !== null ? 'Chọn vị trí để chuyển hoặc đổi quân'
    : run.bench.length ? 'Kéo quân hoặc chạm để xếp đội' : 'Mua quân để xếp đội';
  const result = run.phase === 'finished'
    ? `<div class="result-box ${run.result === 'victory' ? 'victory' : 'defeat'}"><strong>${run.placement ? run.placement === 1 ? 'Vô địch đấu trường' : 'Hạng ' + run.placement + '/8'
      : run.result === 'victory' ? remaining ? 'Thắng lượt chơi' : 'Vô địch đấu trường' : 'Lượt chơi đã kết thúc'}</strong><p>${run.wins} trận thắng · ${run.losses} trận thua · ${run.hp} HP chỉ huy còn lại.</p><button class="button" data-chess-new>Bắt đầu lượt chơi mới</button></div>`
    : run.result && !replaying ? `<div class="result-box ${run.result.won ? 'victory' : run.result.draw ? 'draw' : 'defeat'}">
      <strong>${run.result.won ? 'Chiến thắng' : run.result.draw ? 'Hòa' : 'Thất bại'}</strong>
      <p>${run.result.won ? opponent?.neutral ? 'Đã vượt vòng quái.' : `Đối thủ mất ${run.result.enemyDamage ?? 12} HP.`
        : run.result.draw ? 'Hai chỉ huy giữ nguyên HP.' : `Mất ${run.result.damage} HP.`} · +${run.result.income} vàng${run.result.payout ? ` (${run.result.payout.base} cơ bản · ${run.result.payout.win} thắng · ${run.result.payout.interest} lãi · ${run.result.payout.streak} chuỗi)` : ''}</p>
      ${run.result.lootChoices ? `<div class="chess-loot-options" role="group" aria-label="Chọn một linh kiện">${run.result.lootChoices.map(id =>
        `<button type="button" class="button light" data-chess-loot="${id}">${escapeHtml(CHESS_ITEMS[id].name)}</button>`).join('')}</div>` : ''}
      ${run.result.rewardItem ? `<p>Nhặt được <b>${CHESS_ITEMS[run.result.rewardItem].name}</b>. Trang bị từ băng ghế ở vòng sau.</p>` : ''}
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
      <div title="Lãi +${Math.min(Math.floor(run.gold / 10), 5)} vàng"><small>Vàng</small><b class="chess-gold">◈ ${run.gold}</b></div>
      <div><small>${locking ? 'Đã khóa' : preparing ? 'Chuẩn bị' : replaying ? 'Giao tranh' : 'Kết quả'}</small>
        ${preparing ? `<b class="${run.preparationSeconds <= 5 ? 'clock-urgent' : ''}" data-chess-clock role="timer">${Math.ceil(run.preparationSeconds)} s</b>` : `<b>${run.wins}T · ${run.losses}B</b>`}</div>
    </div>
    <div class="match-layout chess-match" data-chess-phase="${preparing ? 'prep' : replaying ? 'combat' : locking ? 'locking' : 'result'}"><section class="chess-stage" aria-label="Bàn cờ">
      ${replaying ? '<div class="chess-replay-stage"><canvas class="chess-replay" id="chess-replay" width="760" height="480" aria-label="Giao tranh Auto Chess"></canvas></div>'
        : !preparing ? '<div class="chess-result-stage" aria-hidden="true"></div>' : `<div class="chess-board-fit"><div class="chess-formation ${run.lobby ? 'chess-hex' : ''}">
          <div class="formation-label rival-label">${escapeHtml(opponentName)}${opponent ? `${opponent.neutral ? '' : ` <span>${opponent.hp} HP</span>`}<span class="rival-lineup" aria-hidden="true">${opponent.units.map(chessPortrait).join('')}</span>` : ''}</div>
          <div class="chess-grid enemy-formation" role="group" aria-label="Nửa bàn đối thủ">${enemyCells}</div>
          <div class="formation-divider" aria-hidden="true"><i>◆</i></div>
          <div class="chess-grid player-formation" role="group" aria-label="Nửa bàn của bạn, 7 cột 4 hàng">${boardCells}</div>
          <div class="formation-label">Đội hình <span>${run.board.length}/${run.level} quân</span></div>
        </div></div>`}
      ${preparing ? `<div class="chess-bench"><div class="bench-heading"><strong>Băng ghế · ${run.bench.length}/9</strong>${run.lobby ? renderChessItemBelt(run) : ''}</div><div class="bench-row" data-chess-bench-zone>${bench}</div></div>` : ''}
    </section>${preparing || replaying || locking ? `<section class="match-command chess-controls" aria-label="Điều khiển đấu cờ">
      ${replaying ? '<div class="replay-controls"><progress data-chess-replay-progress max="1" value="0" aria-label="Tiến độ giao tranh"></progress><div class="match-actions"><button class="button light" data-chess-pause>Tạm dừng</button><button class="button light" data-chess-speed aria-pressed="false">2×</button><button class="button" data-chess-skip>Bỏ qua</button></div></div>' : ''}
      ${preparing ? `<div class="shop-heading"><strong>Cửa hàng</strong><span>${activeItem || hasSelection ? escapeHtml(selectionHint) : `<span class="chess-odds" title="${escapeAttr(oddsLabel)}" aria-label="Tỷ lệ cửa hàng. ${escapeAttr(oddsLabel)}">${odds.map(([cost, chance]) => `<b data-shop-tier="${cost}">${chance}%</b>`).join('')}</span>`}</span></div>
      <div class="shop-row">${shop}</div><div class="chess-shop-actions"><div class="match-actions shop-tools">
        <button class="button light" data-chess-refresh ${run.gold < 2 || run.shopLocked ? 'disabled' : ''}>Làm mới · 2 ◈</button>
        <button class="button light" data-chess-xp ${run.gold < 4 || run.level >= 9 ? 'disabled' : ''}>${run.lobby ? '+4 XP' : 'Nâng cấp'} · 4 ◈</button>
        <button class="button light" data-chess-lock aria-pressed="${run.shopLocked}">${run.shopLocked ? 'Mở khóa' : 'Khóa chợ'}</button>
      </div>
      <div class="match-actions chess-ready ${runtime.selectedBoard !== null ? 'has-board-selection' : ''}">
        ${hasSelection ? `${runtime.selectedBoard !== null ? `<button class="button light" data-chess-bench ${run.bench.length >= 9 ? 'disabled' : ''}>Rút về ghế</button>` : ''}
          <button class="button danger" data-chess-sell data-chess-sell-zone>Bán quân</button>` : `<button type="button" class="button light" data-chess-synergy>Hiệp lực · ${activeSynergies}</button><span class="chess-sell-zone" data-chess-sell-zone>Kéo để bán</span>`}
        <button class="button" data-chess-fight ${!run.board.length || !opponent ? 'disabled' : ''}>Chiến đấu</button>
      </div></div>` : ''}
      ${locking ? '<p class="match-hint" role="status">Đang vào giao tranh…</p>' : ''}
      ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
    </section>` : ''}</div>
  `);
  if (result) showBattleResult('Kết quả đấu cờ', result);
  app.querySelector('[data-chess-log]').addEventListener('click', () => openInfoDialog('Nhật ký đấu trường', renderTextLog(run.log)));
  app.querySelector('[data-chess-standings]').addEventListener('click', () => showChessStandings(run));
  for (const button of app.querySelectorAll('[data-chess-item]')) button.addEventListener('click', () => {
    const index = Number(button.dataset.chessItem);
    runtime.selectedChessItem = runtime.selectedChessItem === index ? null : index;
    runtime.selectedBench = runtime.selectedBoard = null;
    renderChess();
  });
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
    runtime.chessReplay.draw(app.querySelector('#chess-replay'), runtime.save.settings.effectsLimited);
  }
  app.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => updateChess(() => buyChessOffer(runtime.chess, Number(button.dataset.buy)))));
  app.querySelectorAll('[data-chess-bench-slot]').forEach(button => button.addEventListener('click', () => {
    if (runtime.selectedChessItem !== null) {
      if (button.hasAttribute('data-bench')) placeChessItem(run, runtime.selectedChessItem, 'bench', Number(button.dataset.bench));
      return;
    }
    const slot = Number(button.dataset.chessBenchSlot);
    const source = selectedChessSource();
    if (source) updateChess(() => arrangeChessUnit(run, source, { zone: 'bench', slot }));
    else if (button.hasAttribute('data-bench')) { runtime.selectedBench = Number(button.dataset.bench); renderChess(); }
  }));
  app.querySelector('[data-chess-inspect]')?.addEventListener('click', () => showChessUnit(run, selectedChessSource()));
  app.querySelectorAll('[data-cell]').forEach(button => button.addEventListener('click', () => {
    if (runtime.selectedChessItem === null) return onChessCell(button.dataset.cell);
    if (button.hasAttribute('data-chess-board-index')) placeChessItem(run, runtime.selectedChessItem, 'board', Number(button.dataset.chessBoardIndex));
  }));
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
  app.querySelectorAll('[data-chess-loot]').forEach(button => button.addEventListener('click', () => {
    app.querySelector('.battle-result-dialog')?.close();
    updateChess(() => chooseChessLoot(run, button.dataset.chessLoot));
  }));
  app.querySelector('[data-chess-next]')?.addEventListener('click', () => updateChess(() => advanceChessRound(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-new]')?.addEventListener('click', startNewChessRun);
  saveNow();
}

function startNewChessRun() {
  runtime.chess = createChessRun(runtime.units, runtime.shopConfig, Date.now() % 999_983);
  runtime.chessUpgrade = null;
  runtime.selectedBench = null;
  runtime.selectedBoard = null;
  runtime.selectedChessItem = null;
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
  if (run?.phase !== 'prepare' || document.hidden || app.querySelector('dialog[open], .match-menu[open]')) return;
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
    sources: '[data-chess-board-index], [data-bench], [data-buy]:enabled, [data-chess-item]',
    read(element) {
      const { chessBoardIndex, bench, buy, chessItem } = element.dataset;
      if (chessItem !== undefined) return { zone: 'items', index: Number(chessItem) };
      if (buy !== undefined) return { zone: 'shop', index: Number(buy) };
      return chessBoardIndex !== undefined ? { zone: 'board', index: Number(chessBoardIndex) } : { zone: 'bench', index: Number(bench) };
    },
    locate(source, element) {
      const destination = element?.closest('[data-cell], [data-chess-bench-slot], [data-chess-sell-zone]');
      if (!destination) return null;
      if (source.zone === 'items') {
        const { chessBoardIndex, bench } = destination.dataset;
        const zone = chessBoardIndex !== undefined ? 'board' : 'bench';
        const index = Number(chessBoardIndex ?? bench);
        const unit = run[zone][index];
        const valid = unit && chessItemPlacement(unit, run.items[source.index]);
        return { element: destination, zone, index, state: valid ? 'valid' : 'blocked' };
      }
      if (destination.hasAttribute('data-chess-sell-zone')) return { element: destination, zone: 'sell', state: source.zone === 'shop' ? 'blocked' : 'sell' };
      const { cell, chessBenchSlot } = destination.dataset;
      const [x, y] = cell?.split(',').map(Number) ?? [];
      const place = cell ? { zone: 'board', x, y } : { zone: 'bench', slot: Number(chessBenchSlot) };
      return { element: destination, state: chessDropState(run, source, place), ...place };
    },
    drop(source, destination) {
      if (source.zone === 'items') return placeChessItem(run, source.index, destination.zone, destination.index);
      if (source.zone === 'shop') return updateChess(() => buyChessOffer(run, source.index, destination));
      updateChess(() => destination.zone === 'sell' ? sellChessUnit(run, source.zone, source.index) : arrangeChessUnit(run, source, destination));
    },
    inspect(source) {
      if (source.zone === 'items') {
        const item = CHESS_ITEMS[run.items[source.index]];
        openInfoDialog(item.name, `<p>${chessItemStats(item)}. Hai linh kiện tương thích tự ghép khi đặt lên cùng một quân.</p>`);
      } else showChessUnit(run, source);
    },
    preview(source, ghost) {
      if (source.zone === 'items') return paintTableGhost(ghost, null, CHESS_ITEMS[run.items[source.index]].name);
      const unit = run[source.zone][source.index];
      paintTableGhost(ghost, cardArt({ character_id: unit.id }), unit.display_name + ' ' + '★'.repeat(unit.star ?? 1));
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
  if (source.zone === 'shop') {
    openInfoDialog(unit.display_name, `<div class="inspect-tcg">${chessPortrait(unit)}<div><strong>${unit.cost} vàng · Hệ ${ELEMENT_NAMES[unit.element]}</strong>
      <p>Chạm để mua vào băng ghế hoặc kéo vào một ô trống trên bàn.</p></div></div>`);
    return;
  }
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

function chessItemStats(item) {
  const names = { atk: 'ATK', def: 'DEF', maxHp: 'HP' };
  return Object.entries(item.stats).map(([key, value]) => `+${value} ${names[key]}`).join(' · ');
}

function renderChessItemBelt(run) {
  if (!run.items?.length) return '<small class="chess-item-empty">Thắng vòng quái để nhận linh kiện</small>';
  return `<div class="chess-item-belt" aria-label="Linh kiện">
    ${run.items.map((id, index) => {
      const item = CHESS_ITEMS[id];
      const label = item.name + ' · ' + chessItemStats(item);
      return `<button type="button" class="chess-item-chip" data-chess-item="${index}" data-item-kind="${id}"
        aria-pressed="${runtime.selectedChessItem === index}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${item.icon}</button>`;
    }).join('')}</div>`;
}

function placeChessItem(run, itemIndex, zone, unitIndex) {
  const unit = run[zone][unitIndex];
  if (!unit || !chessItemPlacement(unit, run.items[itemIndex])) {
    runtime.notice = 'Quân này đã đủ ba món và không có công thức ghép phù hợp.';
    return renderChess();
  }
  updateChess(() => equipChessItem(run, zone, unitIndex, itemIndex));
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
  const ended = replay.advance(delta * runtime.chessReplaySpeed * COMBAT_PLAYBACK_RATE, event => runtime.audio.handle(event));
  replay.draw(canvas, runtime.save.settings.effectsLimited);
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
  try { runtime.chess = action(); runtime.selectedBench = null; runtime.selectedBoard = null; runtime.selectedChessItem = null; runtime.notice = ''; saveNow(); }
  catch (error) { runtime.notice = error.message; }
  render();
}

function renderSynergies(counts, traits) {
  return `<div class="synergy-list">${traits.map(([element, trait]) => {
    const count = counts.get(element) ?? 0;
    return `<div class="synergy-row ${count >= 2 ? 'active' : ''}"><i class="element-dot" style="background:${elementColors[element] ?? '#b59660'}"></i><div><strong>${trait.name}</strong><small>${trait.detail}</small></div><b>${Math.min(2, count)}/2</b></div>`;
  }).join('')}</div>`;
}

function showGachaReceipt(receipt, cinematic = false) {
  const dialog = openInfoDialog('Kết quả giao ước', '');
  dialog.classList.add('meta-reveal-dialog');
  const reducedMotion = () => runtime.save.settings.reducedSummonMotion || app.dataset.motion === 'reduced';
  const showResults = () => revealGacha(dialog, receipt, {
    reducedMotion: true,
    onProfile: id => {
      runtime.rosterId = id;
      runtime.rosterFilter = 'owned';
      runtime.rosterTab = 'info';
      navigate('roster');
    },
  });
  if (cinematic && !reducedMotion()) {
    playGachaCinematic(dialog, receipt, {
      renderer: spriteRenderer, reducedMotion, onComplete: showResults,
      playCue: (id, options) => runtime.audio.play(id, options),
    });
  } else {
    if (cinematic) runtime.audio.play('sfx_ui_confirm');
    showResults();
  }
}

function renderGacha() {
  const { save, bannerId, gachaPayment, pendingDraw } = runtime;
  shell(`${pageHeader('Gacha', 'Giao Ước Vị Linh', '')}
    ${gachaPanel(save, bannerId, gachaPayment)}
    ${runtime.settlingDraw ? '<p class="notice" role="status">Đang xử lý triệu hồi…</p>'
      : pendingDraw ? '<div class="action-row"><button class="button" data-gacha-retry>Thử lại giao dịch</button></div>' : ''}
    ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}`);
  app.querySelectorAll('[data-gacha-banner]').forEach(button => button.addEventListener('click', () => {
    runtime.bannerId = button.dataset.gachaBanner;
    runtime.notice = '';
    renderGacha();
  }));
  app.querySelector('[data-gacha-payment]').addEventListener('change', event => {
    runtime.gachaPayment = event.target.value;
    renderGacha();
    app.querySelector('[data-gacha-payment]').focus();
  });
  app.querySelector('[data-gacha-motion]').addEventListener('change', event => {
    runtime.save.settings.reducedSummonMotion = event.target.checked;
    saveNow();
  });
  app.querySelector('[data-gacha-odds]').addEventListener('click', () =>
    openInfoDialog('Tỷ lệ triệu hồi', gachaOdds(runtime.save, BANNERS[bannerId])));
  app.querySelector('[data-gacha-history]').addEventListener('click', () => {
    const dialog = openInfoDialog('Lịch sử triệu hồi', gachaHistory(runtime.save));
    dialog.querySelectorAll('[data-gacha-receipt]').forEach(button => button.addEventListener('click', () => {
      dialog.close();
      showGachaReceipt(runtime.save.meta.history[Number(button.dataset.gachaReceipt)]);
    }));
  });
  app.querySelector('[data-gacha-retry]')?.addEventListener('click', () => settleGachaDraw(pendingDraw));
  app.querySelectorAll('[data-gacha-draw]').forEach(button => {
    if (pendingDraw) button.disabled = true;
    button.addEventListener('click', () => {
      const count = Number(button.dataset.gachaDraw);
      const price = gachaPayment === 'gem' ? count * META.gemCost : count;
      const dialog = openInfoDialog('Xác nhận triệu hồi', `<p>Dùng <strong>${price} ${gachaPayment === 'gem' ? 'Tinh Thạch' : 'vé'}</strong> cho ${count} lượt tại ${BANNERS[bannerId].name}?</p>
        <button type="button" class="button" data-confirm-draw>Triệu hồi</button>`);
      dialog.querySelector('[data-confirm-draw]').addEventListener('click', () => {
        dialog.close();
        void settleGachaDraw({ bannerId, count, payment: gachaPayment, key: crypto.randomUUID() });
      }, { once: true });
    });
  });
}

async function settleGachaDraw(request) {
  if (runtime.settlingDraw) return;
  const shellElement = app.querySelector('.shell');
  const { cloud, account } = runtime;
  const settlement = {};
  shellElement.inert = true;
  app.querySelector('[data-shell-status]').textContent = 'Đang xử lý triệu hồi…';
  runtime.pendingDraw = request;
  runtime.settlingDraw = settlement;
  let receipt;
  try {
    if (cloud) {
      if (!await cloud.flush()) throw runtime.cloudError ?? new Error('Tiến trình chưa được lưu.');
      if (runtime.settlingDraw !== settlement) return;
      const result = await accountApi.draw(account.id, request);
      if (runtime.settlingDraw !== settlement) return;
      mergeServerMeta(runtime.save, result.meta);
      receipt = result.receipt;
    } else {
      const result = drawSpirits(runtime.save, request);
      runtime.save = result.save;
      receipt = result.receipt;
    }
    runtime.pendingDraw = null;
    runtime.notice = '';
    saveNow();
  } catch (error) {
    if (runtime.settlingDraw !== settlement) return;
    receipt = null;
    if (!cloud || (error.status && error.status !== 401 && error.status < 500)) runtime.pendingDraw = null;
    runtime.notice = cloud ? accountErrorMessage(error) : error.message;
  } finally {
    shellElement.inert = false;
    if (runtime.settlingDraw === settlement) {
      runtime.settlingDraw = null;
      if (runtime.page === 'gacha') {
        renderGacha();
        if (receipt) showGachaReceipt(receipt, true);
      }
    }
  }
}

function handleInventoryAction(action, member, redraw) {
  try {
    runtime.save = changeAdventureInventory(runtime.save, { ...action, characterId: member.id,
      expectedRevision: runtime.save.adventure.inventory.revision }, Boolean(runtime.adventure.battle));
    saveNow();
    runtime.notice = ({ buy: 'Đã mua và đưa vào túi.', sell: 'Đã bán vật phẩm.', use: 'Vị Linh đã hồi HP.',
      equip: 'Đã trang bị.', unequip: 'Đã tháo trang bị.', lock: 'Đã cập nhật khóa.', upgrade: 'Đã tinh luyện.' })[action.type];
    runtime.audio.play('sfx_ui_confirm');
  } catch (error) {
    runtime.notice = error.message;
  }
  redraw();
}

function bindInventoryActions(member, redraw) {
  app.querySelectorAll('[data-store-action]').forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.storeAction;
    const id = button.dataset.item;
    if (type !== 'sell') return handleInventoryAction({ type, id }, member, redraw);
    const item = runtime.save.adventure.inventory.gear[id]?.item ?? id;
    const dialog = openInfoDialog('Bán vật phẩm', `<p>Bán ${ADVENTURE_OFFERS[item].name} để nhận ${Math.floor(ADVENTURE_OFFERS[item].price / 2)} vàng?</p>
      <button class="button" data-sell-confirm>Bán</button>`);
    dialog.querySelector('[data-sell-confirm]').addEventListener('click', () => {
      dialog.close();
      handleInventoryAction({ type, id }, member, redraw);
    }, { once: true });
  }));
}

function renderStore() {
  const { save, storeTab } = runtime;
  const member = save.roster.find(spirit => spirit.id === runtime.storeMember) ?? adventureParty(save)[0];
  const tabs = { all: 'Tất cả', consumable: 'Hồi phục', gear: 'Trang bị', material: 'Vật liệu', bag: 'Túi đồ' };
  const inBattle = Boolean(runtime.adventure.battle);
  const counter = nearestInteraction(runtime.adventure, save, runtime.maps);
  const supplies = runtime.adventure.map === 'village_merchant' && counter?.id === 'supplies' ? counter.offer : null;
  shell(`${pageHeader('Làng Ẩm Thực', 'Cửa hàng Adventure', '')}
    <section class="meta-store"><div class="store-shopkeeper" aria-label="Tiệm Nguyên Liệu">
      <img src="${actorArt('npc_lilia')}" alt=""><div><small>Tiệm Nguyên Liệu</small><strong>Lilia</strong></div>
    </div><div class="store-workspace"><div class="meta-banner-tabs" role="group" aria-label="Mục cửa hàng">
    ${Object.entries(tabs).map(([id, label]) => `<button class="button light" data-store-tab="${id}" aria-pressed="${id === storeTab}">${label}</button>`).join('')}</div>
    ${storeTab === 'bag' ? `<label>Vị Linh <select data-store-member>${save.roster.map(spirit => `<option value="${escapeAttr(spirit.id)}"
      ${spirit.id === member.id ? 'selected' : ''}>${escapeHtml(SPIRITS[spirit.id]?.name)}</option>`).join('')}</select></label>` : ''}
    ${inBattle ? '<p class="notice">Kết thúc trận Adventure để mua, dùng hoặc đổi trang bị.</p>' : ''}
    <fieldset class="meta-shop-body" ${inBattle ? 'disabled' : ''}><legend class="sr-only">Vật phẩm</legend>
    ${supplies && storeTab === 'all' ? `<div class="store-exchange"><span>Đổi ${supplies.gold} vàng lấy ${supplies.essence} tinh hoa</span>
      <button class="button light" type="button" data-buy-supplies ${save.player.gold < supplies.gold ? 'disabled' : ''}>Đổi tinh hoa</button></div>` : ''}
    ${storeTab === 'bag' ? inventoryRows(save, member) : `<div class="meta-offers">${Object.entries(ADVENTURE_OFFERS)
      .filter(([, offer]) => storeTab === 'all' || offer.category === storeTab).map(([id, offer]) =>
        `<article><div class="store-item-summary"><img src="${itemArt(id)}" alt=""><div><h2>${offer.name}</h2><p>${storeDetail(offer)}</p></div></div>
          <form class="store-buy-row" data-store-offer="${id}"><label class="store-quantity">SL <input name="quantity" type="number" aria-label="Số lượng ${offer.name}" min="1" max="${Math.max(1, Math.min(10, Math.floor(save.player.gold / offer.price)))}" value="1" required></label>
          <button class="button" type="submit" ${save.player.gold < offer.price ? 'disabled' : ''}>Mua · ${offer.price} ◈</button></form></article>`).join('')}</div>`}</fieldset>
    ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}</div></section>`);
  app.querySelectorAll('[data-store-tab]').forEach(button => button.addEventListener('click', () => {
    runtime.storeTab = button.dataset.storeTab;
    runtime.notice = '';
    renderStore();
  }));
  app.querySelector('[data-store-member]')?.addEventListener('change', event => {
    runtime.storeMember = event.target.value;
    renderStore();
    app.querySelector('[data-store-member]').focus();
  });
  app.querySelector('[data-buy-supplies]')?.addEventListener('click', () => {
    const purchase = purchaseAdventureSupplies(runtime.adventure, runtime.save, runtime.maps);
    if (!purchase.purchased) return;
    runtime.save = purchase.save;
    runtime.notice = `Đã nhận ${supplies.essence} tinh hoa.`;
    runtime.audio.play('sfx_ui_confirm');
    saveNow();
    renderStore();
  });
  app.querySelectorAll('[data-store-offer]').forEach(form => {
    const id = form.dataset.storeOffer;
    const offer = ADVENTURE_OFFERS[id];
    form.elements.quantity.addEventListener('input', () => {
      form.querySelector('button').textContent = 'Mua · ' + (offer.price * (form.elements.quantity.valueAsNumber || 0)) + ' ◈';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      handleInventoryAction({ type: 'buy', id, quantity: form.elements.quantity.valueAsNumber }, member, renderStore);
    });
  });
  bindInventoryActions(member, renderStore);
}

const SPIRIT_TABS = { info: 'Thông tin', skills: 'Kỹ năng', gear: 'Trang bị', bond: 'Quan hệ', stars: 'Thức tỉnh' };
const SPIRIT_ROLES = { fighter: 'Đấu sĩ', mage: 'Pháp sư', support: 'Hỗ trợ', guardian: 'Hộ vệ', assassin: 'Sát thủ', healer: 'Hồi phục', ranged: 'Xạ thủ', controller: 'Khống chế' };

function renderRoster() {
  const { save } = runtime;
  const fromTeam = adventureParty(save).map(actor => actor.id);
  const available = META.characters.filter(spirit => runtime.rosterFilter === 'owned'
    ? save.roster.some(member => member.id === spirit.id) : runtime.rosterFilter === 'team' ? fromTeam.includes(spirit.id)
      : runtime.rosterFilter === 'all' || [spirit.rarity, spirit.element, spirit.role].includes(runtime.rosterFilter));
  const definition = available.find(spirit => spirit.id === runtime.rosterId) ?? available[0];
  const member = save.roster.find(actor => actor.id === definition.id);
  const profile = member && spiritProfile(save, member.id);
  const battleActive = Boolean(runtime.adventure.battle);
  const { name, rarity, element, role } = definition;
  const title = `${ELEMENT_NAMES[element]} · ${SPIRIT_ROLES[role]}`;
  const model = boardChibi(definition.id, 'roster:' + definition.id, 'E', '');
  const party = adventureParty(save);
  const deployed = party.some(actor => actor.id === member?.id);
  const from = available.findIndex(spirit => spirit.id === definition.id);
  shell(`<section class="spirit-profile" style="--spirit-backdrop:url('${cardBackdrop(element)}')" aria-label="Hồ sơ Vị Linh">
      <div class="spirit-portrait" style="--unit-color:${elementColors[element]}" data-rarity="${rarity}">
        <div class="spirit-stage-art">${spiritImage(definition.id, true, { showcase: true })}</div>
        ${model ? `<div class="spirit-model" aria-label="Mô hình chibi" hidden>${model}</div>
          <button type="button" class="button light spirit-view-toggle" data-spirit-view aria-pressed="false">Chibi</button>` : ''}
      </div>
      <div class="spirit-detail"><header class="spirit-identity" data-rarity="${rarity}">
        <p><b>${rarity}</b> ${title}${profile ? ` · ${'★'.repeat(profile.star ?? 1)}` : ''}</p>
        <h1 class="spirit-scene-heading">${escapeHtml(name)}</h1></header>
        ${member ? `<div class="spirit-tabs" role="group" aria-label="Mục hồ sơ">${Object.entries(SPIRIT_TABS).map(([id, label]) =>
          `<button class="button light" data-spirit-tab="${id}" aria-pressed="${runtime.rosterTab === id}">${label}</button>`).join('')}</div>
        <div class="spirit-tab-body">${renderSpiritTab(member, profile, battleActive)}</div>
        <div class="action-row"><button class="button light" data-party-toggle
          ${battleActive || (deployed ? party.length <= 1 : party.length >= 5) ? 'disabled' : ''}>${deployed ? 'Rút khỏi đội' : 'Thêm vào đội'}</button><button class="button light" data-home-companion
          aria-pressed="${save.settings.homeCompanion === member.id}">${save.settings.homeCompanion === member.id ? 'Đang ở sảnh' : 'Đặt ở sảnh'}</button>
          <small>Đội Adventure · ${party.length}/5</small></div>` :
          `<div class="spirit-tab-body"><h3>Chưa chiêu mộ</h3><p>${escapeHtml(definition.lore)}</p><p><strong>${escapeHtml(definition.ultimate)}</strong> · ${escapeHtml(definition.concept)}</p>
          <button class="button" data-page="gacha">Tới Giao Ước</button></div>`}
        ${battleActive && runtime.rosterTab !== 'skills' ? '<p class="muted-copy">Kết thúc trận Adventure để nâng cấp, đổi trang bị hoặc tặng quà.</p>' : ''}
        ${runtime.notice ? `<p class="notice" role="status">${escapeHtml(runtime.notice)}</p>` : ''}
      </div>
      <div class="spirit-browse"><button type="button" class="button light" data-roster-cycle="-1" aria-label="Vị Linh trước" ${available.length < 2 ? 'disabled' : ''}>‹</button>
      <button type="button" class="button light" data-open-roster aria-haspopup="dialog">Đổi Vị Linh</button>
      <button type="button" class="button light" data-roster-cycle="1" aria-label="Vị Linh tiếp theo" ${available.length < 2 ? 'disabled' : ''}>›</button></div>
    </section>`);
  if (runtime.spiritUpgrade?.id === definition.id && runtime.spiritUpgrade.until > performance.now()) {
    app.querySelector('.spirit-portrait').classList.add('spirit-upgrade-flash');
  }
  app.querySelectorAll('[data-roster-cycle]').forEach(button => button.addEventListener('click', () => {
    const offset = Number(button.dataset.rosterCycle);
    runtime.rosterId = available[(from + offset + available.length) % available.length].id;
    runtime.notice = '';
    runtime.audio.play('sfx_ui_confirm', { gain: .45 });
    renderRoster();
    app.querySelector(`[data-roster-cycle="${offset}"]`)?.focus({ preventScroll: true });
  }));
  app.querySelector('[data-open-roster]').addEventListener('click', openSpiritCollection);
  const stage = app.querySelector('.spirit-portrait');
  const showcase = stage.querySelector('[data-fallback-art]');
  showcase?.addEventListener('error', () => {
    showcase.src = showcase.dataset.fallbackArt;
  }, { once: true });
  const showModel = show => {
    if (!model) return;
    stage.querySelector('.spirit-model').hidden = !show;
    stage.querySelector('.spirit-stage-art').hidden = show;
    stage.querySelector('[data-spirit-view]').setAttribute('aria-pressed', String(show));
    stage.querySelector('[data-spirit-view]').textContent = show ? 'Minh họa' : 'Chibi';
  };
  stage.querySelector('[data-spirit-view]')?.addEventListener('click', event => showModel(event.target.getAttribute('aria-pressed') !== 'true'));
  app.querySelector('[data-preview-spirit]')?.addEventListener('click', () => {
    showModel(true);
    if (model) boardSprites.cue('roster:' + definition.id, 'ultimate_01', performance.now());
    stage.classList.remove('spirit-upgrade-flash');
    void stage.offsetWidth;
    stage.classList.add('spirit-upgrade-flash');
    runtime.audio.play(`sfx_element_${element}_cast`, { gain: .6 });
  });
  app.querySelector('[data-home-companion]')?.addEventListener('click', () => {
    save.settings.homeCompanion = member.id;
    saveNow();
    renderRoster();
    app.querySelector('[data-home-companion]')?.focus({ preventScroll: true });
  });
  app.querySelector('[data-party-toggle]')?.addEventListener('click', () => {
    try {
      runtime.save = changeParty(runtime.save, member.id);
      saveNow();
      runtime.notice = 'Đã cập nhật đội hình Adventure.';
    } catch (error) {
      runtime.notice = error.message;
    }
    renderRoster();
  });
  if (member && !battleActive) bindInventoryActions(member, renderRoster);
  app.querySelectorAll('[data-spirit-tab]').forEach(button => button.addEventListener('click', () => {
    runtime.rosterTab = button.dataset.spiritTab;
    runtime.notice = '';
    renderRoster();
    app.querySelector(`[data-spirit-tab="${CSS.escape(runtime.rosterTab)}"]`)?.focus({ preventScroll: true });
  }));
  app.querySelectorAll('[data-spirit-action]').forEach(button => button.addEventListener('click', () => {
    const { spiritAction: type, gearId } = button.dataset;
    try {
      runtime.save = changeSpiritProgress(runtime.save, { type, id: member.id, gearId }, Boolean(runtime.adventure.battle));
      saveNow();
      runtime.audio.play('sfx_ui_confirm');
      if (type === 'rank' || type === 'awaken') runtime.spiritUpgrade = { id: member.id, until: performance.now() + 500 };
      runtime.notice = ({ rank: 'Đã nâng cấp Vị Linh.', awaken: 'Đã thức tỉnh Vị Linh.', craft: 'Đã chế tác và đưa vào kho.', equip: 'Đã trang bị.', unequip: 'Đã đưa trang bị về kho.', gift: 'Mức quan hệ đã tăng.' })[type];
    } catch (error) {
      runtime.notice = error.message;
    }
    renderRoster();
    app.querySelector('[data-spirit-tab][aria-pressed="true"]')?.focus({ preventScroll: true });
  }));
}

function openSpiritCollection() {
  const { save } = runtime;
  const owned = new Set(save.roster.map(actor => actor.id));
  const team = new Set(adventureParty(save).map(actor => actor.id));
  const groups = [['Phạm vi', { all: 'Tất cả', owned: 'Đã chiêu mộ', team: 'Đội Adventure' }],
    ['Độ hiếm', { N: 'N', R: 'R', SR: 'SR', SSR: 'SSR' }], ['Hệ', ELEMENT_NAMES], ['Vai trò', SPIRIT_ROLES]];
  const dialog = openInfoDialog('Bộ sưu tập Vị Linh', `<label class="meta-roster-filter">Lọc <select data-roster-filter>${groups.map(([label, options]) =>
    `<optgroup label="${label}">${Object.entries(options).map(([id, name]) => `<option value="${id}" ${runtime.rosterFilter === id ? 'selected' : ''}>${name}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="spirit-collection">${META.characters.map(spirit => `<button class="spirit-choice" data-rarity="${spirit.rarity}" data-spirit-choice="${spirit.id}" aria-pressed="${spirit.id === runtime.rosterId}">
      ${spiritImage(spirit.id)}<strong>${escapeHtml(spirit.name)}</strong><small>${spirit.rarity} · ${owned.has(spirit.id) ? ELEMENT_NAMES[spirit.element] : 'Chưa có'}</small></button>`).join('')}</div>`);
  const filter = dialog.querySelector('select');
  const choices = [...dialog.querySelectorAll('[data-spirit-choice]')];
  const apply = () => choices.forEach(button => {
    const id = button.dataset.spiritChoice;
    const spirit = SPIRITS[id];
    const group = filter.value;
    button.hidden = !(group === 'all' || (group === 'owned' && owned.has(id)) || (group === 'team' && team.has(id))
      || [spirit.rarity, spirit.element, spirit.role].includes(group));
  });
  filter.addEventListener('change', apply);
  apply();
  for (const button of choices) button.addEventListener('click', () => {
    runtime.rosterFilter = filter.value;
    runtime.rosterId = button.dataset.spiritChoice;
    runtime.notice = '';
    runtime.audio.play('sfx_ui_confirm', { gain: .45 });
    dialog.close();
    renderRoster();
    app.querySelector('[data-open-roster]').focus({ preventScroll: true });
  });
}

function renderSpiritTab(member, profile, battleActive) {
  const { save } = runtime;
  if (runtime.rosterTab === 'skills') {
    const skill = adventureBalance.ultimates[member.id];
    return `<div class="spirit-skill"><img src="${effectArt(member.element, 'impact')}" alt=""><div><h3>${skill.name}</h3>
      <p>${skill.description}</p><small>100 năng lượng · hồi ${adventureBalance.ultimateCooldown / ADVENTURE_TICK_RATE} giây</small></div></div>
      <button type="button" class="button light" data-preview-spirit>Thử hiệu ứng</button>`;
  }
  if (runtime.rosterTab === 'gear') {
    const { ownedGear, profiles } = save.adventure.spirits;
    return `<fieldset class="meta-shop-body" ${battleActive ? 'disabled' : ''}><legend>Trang bị cửa hàng</legend>
      ${inventoryRows(save, member, { equipmentOnly: true, compare: true })}</fieldset>
      <button class="button light" data-page="store">Mở cửa hàng</button>
      <h3>Trang bị chế tác · ${ownedGear.length}/${Object.keys(SPIRIT_GEAR).length}</h3>
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
        return `<div class="spirit-gear-item"><span aria-hidden="true">${gear.symbol}</span><div><small>${gear.slot}</small><strong>${gear.name}</strong><small>${gear.detail}${owner ? ' · ' + escapeHtml(SPIRITS[owner.id]?.name) : ''}</small></div>
          <button class="button light" data-spirit-action="${action}" data-gear-id="${id}" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
      }).join('')}</div>`;
  }
  if (runtime.rosterTab === 'stars') {
    const star = profile.star ?? 1;
    const price = SPIRIT_AWAKENING[star - 1];
    return `<h3>${'★'.repeat(star)}${'☆'.repeat(5 - star)} · ${star}/5 sao</h3>
      <p>Tăng HP, ATK và DEF trong Adventure.</p>
      ${price ? `<button class="button" data-spirit-action="awaken" ${battleActive || save.player.essence < price ? 'disabled' : ''}>Thức tỉnh · ${price} ✦</button>` : '<p>Đã đạt 5 sao.</p>'}`;
  }
  if (runtime.rosterTab === 'bond') {
    const essence = SPIRIT_GIFTS[profile.bond];
    return `<h3>${SPIRIT_BONDS[profile.bond]}</h3>
      <progress max="${SPIRIT_GIFTS.length}" value="${profile.bond}" aria-label="Mức quan hệ"></progress>
      <p>${profile.bond >= 2 ? escapeHtml(SPIRIT_MEMORIES[member.id] ?? SPIRITS[member.id].lore) : 'Tặng quà để mở ký ức khi đạt mức Tin cậy.'}</p>
      ${essence ? `<button class="button" data-spirit-action="gift" ${battleActive || save.player.essence < essence ? 'disabled' : ''}>Tặng quà · ${essence} ✦</button>` : ''}`;
  }
  const stats = adventureSpiritStats(member, profile, undefined, save);
  const cost = SPIRIT_RANKS[profile.rank - 1];
  const next = cost ? adventureSpiritStats(member, profile, profile.rank + 1, save) : stats;
  const equipped = Object.fromEntries([...profile.equipped.map(id => [CRAFTED_GEAR_SLOTS[id], SPIRIT_GEAR[id].name]),
    ...adventureGearFor(save, member.id).map(([, entry]) => [ADVENTURE_OFFERS[entry.item].slot, ADVENTURE_OFFERS[entry.item].name])]);
  const values = [['HP tối đa', stats.maxHp, next.maxHp], ['ATK', stats.atk, next.atk], ['DEF', stats.def, next.def],
    ['Di chuyển · px/s', Math.round(stats.speed * ADVENTURE_TICK_RATE), Math.round(next.speed * ADVENTURE_TICK_RATE)],
    ['Tốc đánh · đòn/s', (ADVENTURE_TICK_RATE / adventureBalance.roles[member.role].interval).toFixed(2)],
    ['Năng lượng', `${member.energy}/100`]];
  return `<div class="spirit-rank"><strong>Cấp ${profile.rank}/${MAX_SPIRIT_RANK}</strong><progress max="${MAX_SPIRIT_RANK}" value="${profile.rank}" aria-label="Cấp Vị Linh"></progress></div>
    <dl class="spirit-stats">${values.map(([label, current, upgraded]) => `<div><dt>${label}</dt><dd><b>${current.toLocaleString('vi')}</b>${upgraded > current ? ` <small>→ ${upgraded.toLocaleString('vi')}</small>` : ''}</dd></div>`).join('')}</dl>
    <div class="spirit-loadout">${Object.entries(GEAR_SLOTS).map(([id, label]) => `<div><small>${label}</small><b>${escapeHtml(equipped[id] ?? 'Trống')}</b></div>`).join('')}</div>
    ${cost ? `<button class="button" data-spirit-action="rank" ${battleActive || !canAffordSpiritCost(save.player, cost) ? 'disabled' : ''}>Nâng cấp · ${spiritCostLabel(cost)}</button>` : '<p>Đã đạt cấp tối đa.</p>'}`;
}

function spiritCostLabel(cost) { return `${cost.gold} ◈ + ${cost.essence} ✦`; }

function renderSettings(asOverlay = false) {
  const settings = runtime.save.settings;
  const guestActions = runtime.cloud ? '' : '<div class="action-row"><button class="button light" data-page="title">Về màn hình bắt đầu</button><button class="button danger" data-reset-save>Khởi tạo lại tiến trình</button></div>';
  const cloudPanel = runtime.cloud ? `<section class="settings-list panel cloud-panel"><h2>Tài khoản ${escapeHtml(runtime.account.username)}</h2><p>Tiến trình luyện tập lưu trên máy chủ.</p><p role="status" data-cloud-status></p><div class="action-row"><button class="button light" data-cloud-action="retry" hidden>Thử lưu lại</button><button class="button light" data-cloud-action="reload" hidden>Tải bản trên máy chủ</button><button class="button light" data-cloud-action="reauth" hidden>Đăng nhập lại</button><button class="button danger" data-cloud-action="logout">Lưu và đăng xuất</button></div></section>` : '';
  const content = `<section class="settings-list panel">${[['music', 'Nhạc'], ['sfx', 'Hiệu ứng'], ['ambience', 'Môi trường']].map(([key, label]) => `<label class="setting-row"><span>${label}</span><input type="range" min="0" max="100" value="${settings[key]}" data-setting="${key}"><b>${settings[key]}%</b></label>`).join('')}<label class="setting-row"><span>Giảm chuyển động</span><input type="checkbox" data-setting-motion ${settings.reducedMotion ? 'checked' : ''}><b>${settings.reducedMotion ? 'Bật' : 'Tắt'}</b></label>
    <label class="setting-row"><span>Giảm mật độ hiệu ứng</span><input type="checkbox" data-setting-effects ${settings.effectsLimited ? 'checked' : ''}>
    <b>${settings.effectsLimited ? 'Bật' : 'Tắt'}</b></label>
    ${asOverlay ? '' : guestActions}</section>${asOverlay ? '' : cloudPanel}`;
  const host = asOverlay ? openInfoDialog('Cài đặt', content) : app;
  if (!asOverlay) shell(pageHeader(runtime.cloud ? 'Tài khoản' : 'Thiết bị này', 'Cài đặt', '') + content);
  host.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('input', () => { runtime.save.settings[input.dataset.setting] = Number(input.value); input.nextElementSibling.textContent = `${input.value}%`; runtime.audio.setSettings(runtime.save.settings); saveNow(); }));
  host.querySelector('[data-setting-effects]')?.addEventListener('change', ({ target }) => {
    settings.effectsLimited = target.checked;
    target.nextElementSibling.textContent = settings.effectsLimited ? 'Bật' : 'Tắt';
    saveNow();
  });
  host.querySelector('[data-setting-motion]')?.addEventListener('change', (event) => { runtime.save.settings.reducedMotion = event.target.checked; syncMotion(); saveNow(); event.target.nextElementSibling.textContent = settings.reducedMotion ? 'Bật' : 'Tắt'; });
  host.querySelector('[data-reset-save]')?.addEventListener('click', () => {
    if (!confirm('Xóa tiến trình đã lưu trên thiết bị này?')) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('soul-of-meal.save.v1');
    window.location.reload();
  });
  host.querySelectorAll('[data-cloud-action]').forEach(button =>
    button.addEventListener('click', () => runCloudAction(button.dataset.cloudAction)));
}


function openSceneSettings() {
  renderSettings(true);
}

function render() {
  if (runtime.page === 'title') {
    const loginResult = new URL(location.href).searchParams.get('login');
    runtime.audio.setScene(resolveSoundScene('title', runtime.adventure));
    const resume = renderEntry(app, enterGame, accountApi ? () => openAccountDialog(app, accountApi, enterAccount) : null,
      accountApi ? async report => enterAccount(await accountApi.bootstrap(), report) : null);
    if (resume) {
      const status = app.querySelector('.entry-loading [role=status]');
      if (loginResult === 'google_error') {
        status.closest('.entry-loading').hidden = false;
        app.querySelector('.entry-loading progress').hidden = true;
        status.textContent = 'Đăng nhập Google chưa hoàn tất. Bạn có thể thử lại.';
      }
      if (loginResult) {
        const url = new URL(location.href);
        url.searchParams.delete('login');
        history.replaceState(history.state, '', url);
      }
      void accountApi.bootstrap().then(() => {
        resume.hidden = false;
        if (loginResult === 'google' && app.contains(resume) && !resume.disabled) resume.click();
      }).catch(() => {});
    }
    return;
  }
  if (runtime.page === 'onboarding' || runtime.page === 'starter-summon') {
    const page = profileScene();
    if (page !== runtime.page) return navigate(page, { replace: true });
    runtime.audio.setScene('login');
    if (page === 'onboarding') return showOnboarding();
    return renderStarterReveal(app, runtime.save.meta.profile, finishStarterReveal, app.dataset.motion === 'reduced');
  }
  if (runtime.page === 'gacha') return renderGacha();
  if (runtime.page === 'store') return renderStore();
  if (runtime.page === 'home') return renderHome();
  if (runtime.page === 'adventure') return renderAdventure();
  if (runtime.page === 'puzzle') return renderAdventurePuzzle();
  if (runtime.page === 'journey') return renderAdventureJournal();
  if (runtime.page === 'guide') return renderGuide();
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
  if (key === 'Escape' && !event.repeat) {
    if (runtime.page === 'puzzle') return sceneNavigation.back();
    if (runtime.page === 'chess' && runtime.selectedChessItem !== null) {
      app.querySelector('[data-chess-item][aria-pressed="true"]')?.click();
      return;
    }
    const cancel = app.querySelector('[data-tcg-cancel-spell], [data-tcg-cancel-strike]');
    if (cancel && !event.defaultPrevented && !app.querySelector('.match-menu[open]')) {
      cancel.click();
      return;
    }
    const summary = app.querySelector('.match-menu summary');
    if (summary && !event.defaultPrevented) { summary.click(); summary.focus(); }
    return;
  }
  if (app.querySelector('.match-menu[open]')) return;
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    runtime.heldKeys.clear();
    runtime.worldStick = null;
  }
  runtime.audio.syncVisibility(document.hidden);
});
window.addEventListener('focus', () => { if (runtime.page === 'home') void checkForContentUpdate(); });

let lastFrame = 0;
function animate(now) {
  const delta = Math.min(.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  const modalOpen = Boolean(app.querySelector('dialog[open], .match-menu[open]'));
  if (runtime.page === 'adventure' && runtime.animations) drawAdventureFrame(modalOpen ? 0 : delta, modalOpen);
  if (runtime.page === 'chess' && !modalOpen) {
    if (runtime.chessReplay) drawChessReplay(delta);
    else updateChessClock(delta);
  }
  const reducedMotion = app.dataset.motion === 'reduced';
  if (runtime.page === 'guide' && runtime.guidePage === 'effects') paintEffectPreview(now, reducedMotion);
  if (['home', 'roster'].includes(runtime.page) || (runtime.page === 'chess' && !runtime.chessReplay)) {
    boardSprites.paint(app, delta, now, reducedMotion);
  }
  if (runtime.page === 'tcg') duelEffects.paint(app.querySelector('.duel-effects'), runtime.tcg?.battleId, now, reducedMotion, event => {
    if (event.type !== 'tcg_support_resolved') runtime.audio.handle(event);
    else if (event.payload.kind === 'boost') runtime.audio.handle({ ...event, type: 'cast_started' });
    else runtime.audio.handle({ ...event, type: event.payload.kind === 'shield' ? 'shield_applied' : 'heal_resolved' });
  }, runtime.save.settings.effectsLimited);
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
