import { createAdventureState, interactAdventure, nearestInteraction, setAdventureInput, stepAdventure, activateUltimate, beginBattle, claimBattleResult, WORLD, resolveCameraViewport } from './modes/adventure.js?v=6';
import { createTcgMatch, playTcgCard, passTcgPriority, runBotPriority, runTcgBot, attackTcg, endTcgTurn } from './modes/tcg.js?v=3';
import { advanceChessRound, buyChessOffer, createChessRun, moveChessUnit, placeChessUnit, refreshChessShop, sellChessUnit, startChessCombat, toggleChessLock } from './modes/autoChess.js?v=3';
import { gameEvents } from './core/events.js?v=3';
import { loadSave, persistSave } from './core/save.js?v=3';
import { AnimationAdapter } from './render/animationAdapter.js?v=4';
import { findAdventurePath } from './modes/adventureNavigation.js?v=3';
import { createAdventureMapRegistry, getAdventureMap } from './modes/mapCatalog.js?v=1';
import { spriteRenderer } from './render/spriteRenderer.js';
import { preloadGameAssets } from './render/spriteAssets.js';

const app = document.querySelector('#app');
const runtime = {
  page: 'home', save: loadSave(), adventure: null, cards: null, deck: null, units: null, maps: null,
  shopConfig: null, tcg: null, chess: null, selectedTarget: 'commander', selectedBench: null,
  selectedBoard: null, notice: '', events: [], lastSavedLocation: 0, heldKeys: new Set(),
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

gameEvents.addEventListener('game-event', ({ detail }) => {
  runtime.events.unshift(detail);
  runtime.events = runtime.events.slice(0, 40);
});

const iconMap = { home: '⌂', adventure: '⌖', tcg: '▤', chess: '▦', settings: '⚙' };
const characterNames = {
  chr_bunbo_holinh: 'Bún Bò Hỏa Linh', chr_pho_lamvu: 'Phở Lam Vũ',
  chr_goicuon_diepnhi: 'Gỏi Cuốn Diệp Nhi', chr_banhbao_bachngoc: 'Bánh Bao Bạch Ngọc',
  chr_caphe_davu: 'Cà Phê Dạ Vũ',
};
const elementColors = { fire: '#dd684a', water: '#428eac', wood: '#548d56', light: '#b8923c', shadow: '#75627e' };

async function loadContent() {
  const [cards, deck, unitsData, shopConfig, villageMap, forestMap] = await Promise.all([
    fetch('../../examples/cards/cards.catalog.json').then(checkResponse).then((response) => response.json()),
    fetch('../../examples/cards/starter_deck.json').then(checkResponse).then((response) => response.json()),
    fetch('../../examples/auto_chess/units.json').then(checkResponse).then((response) => response.json()),
    fetch('../../examples/auto_chess/shop_odds.json').then(checkResponse).then((response) => response.json()),
    fetch('../../examples/maps/village.json').then(checkResponse).then((response) => response.json()),
    fetch('../../examples/maps/forest.json').then(checkResponse).then((response) => response.json()),
  ]);
  runtime.cards = cards;
  runtime.deck = deck;
  runtime.units = unitsData.units;
  runtime.shopConfig = shopConfig;
  runtime.maps = createAdventureMapRegistry([villageMap, forestMap]);
  preloadGameAssets(spriteRenderer).catch((err) => console.warn('Sprite preload error:', err));
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
  persistSave(runtime.save);
}

function navigate(page) {
  runtime.page = page;
  runtime.notice = '';
  render();
}

function navButton(page, label) {
  return `<button class="nav-button" data-page="${page}" aria-current="${runtime.page === page ? 'page' : 'false'}"><span class="nav-icon" aria-hidden="true">${iconMap[page] ?? '•'}</span><span>${label}</span></button>`;
}

function shell(content) {
  const player = runtime.save.player;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">味</div><div class="brand-name">SOUL OF MEAL<small>HÀNH TRÌNH VỊ LINH</small></div></div>
        <nav class="nav-group" aria-label="Điều hướng chính"><div class="nav-label">Trạm hành trình</div>
          ${navButton('home', 'Tổng quan')}${navButton('adventure', 'Phiêu lưu')}${navButton('tcg', 'Thẻ chiến thuật')}${navButton('chess', 'Đấu trường linh thú')}
        </nav>
        <div class="sidebar-spacer"></div>
        <nav class="nav-group" aria-label="Tài khoản">${navButton('settings', 'Cài đặt')}</nav>
        <div class="profile-chip"><div class="profile-avatar">味</div><div class="profile-copy">${escapeHtml(player.name)}<small>Cấp ${player.level} · Lữ khách</small></div></div>
      </aside>
      <main class="main">${content}</main>
      <nav class="mobile-nav" aria-label="Điều hướng nhanh">${navButton('home', 'Nhà')}${navButton('adventure', 'Khám phá')}${navButton('tcg', 'Thẻ')}${navButton('chess', 'Đấu cờ')}</nav>
    </div>`;
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
}

function pageHeader(kicker, title, description, back = 'home') {
  return `<div class="topline"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${description}</p></div><div class="resource-row"><div class="resource">◈ ${runtime.save.player.gold}</div><div class="resource">✦ ${runtime.save.player.essence}</div><button class="button light compact" data-page="${back}" aria-label="Về tổng quan">←</button></div></div>`;
}

function renderHome() {
  const quest = runtime.save.adventure.quest;
  const headline = quest === 'not_started' ? 'Lilia cần bạn ở quảng trường' : quest === 'completed' ? 'Hương vị đã trở về' : 'Dấu vết dẫn vào rừng';
  shell(`
    ${pageHeader('Bản thử nghiệm kỹ thuật · 0.1.0', 'Chào mừng trở lại', 'Làng Ẩm Thực đang chờ Người Kết Vị. Tiến trình lưu tự động trên thiết bị này.')}
    <section class="home-hero"><div class="hero-copy"><div class="eyebrow">${quest === 'completed' ? 'Khu rừng đã yên bình' : 'Một hương vị đang thất lạc'}</div><h2>${headline}</h2><p>Khám phá làng, nhận lời nhắn của Lilia và tìm lại hương vị bị đánh cắp. Luật chơi xử lý độc lập với phần hình ảnh.</p><div class="button-row"><button class="button" data-page="adventure">Tiếp tục hành trình →</button><button class="button secondary" data-page="roster">Đội hình · ${runtime.save.roster.length}</button></div></div><div class="hero-figure" role="img" aria-label="Bún Bò Hỏa Linh"><img src="./assets/portraits/chr_bunbo_holinh.png" alt="Bún Bò Hỏa Linh" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,0.45));" onerror="this.style.display='none'"><div class="hero-orbit"></div><div class="hero-shadow"></div><div class="hero-mascot"><div class="mascot-scarf"></div></div><div class="mascot-flame"></div></div></section>
    <div class="section-head"><div><div class="eyebrow">Ba lối chơi · chung thế giới</div><h2>Chọn hành trình</h2></div><p>Thành tích và tiến trình lưu trên thiết bị.</p></div>
    <section class="mode-grid">
      <button class="mode-card" data-page="adventure"><div class="mode-mark adventure">⌖</div><h3>Phiêu lưu</h3><p>Khám phá làng và rừng, hoàn thành nhiệm vụ, chiến đấu theo simulation 30Hz.</p><div class="mode-meta"><span>${quest === 'completed' ? 'Nhiệm vụ hoàn thành' : 'Nhiệm vụ P0'}</span><span>Vào khu vực →</span></div></button>
      <button class="mode-card" data-page="tcg"><div class="mode-mark tcg">▤</div><h3>Thẻ chiến thuật</h3><p>Xây dựng bộ bài, triệu hồi Vị Linh, quản lý ưu tiên, phản ứng và bẫy úp.</p><div class="mode-meta"><span>Đấu bot · PVE</span><span>Vào trận →</span></div></button>
      <button class="mode-card" data-page="chess"><div class="mode-mark chess">▦</div><h3>Đấu trường linh thú</h3><p>Mua quân, xếp đội hình, hợp thể ba bản sao và mô phỏng giao tranh tự động.</p><div class="mode-meta"><span>Chuẩn bị & chiến đấu</span><span>Vào trận →</span></div></button>
    </section><p class="status-line">🎨 Đồ họa Soul of Meal · Đã tích hợp Sprite Sheets, Animation Manifests, Card Art & Map Assets</p>
  `);
}

function renderAdventure() {
  const save = runtime.save;
  const adventure = runtime.adventure;
  const battle = adventure.battle;
  const target = nearestInteraction(adventure, save, runtime.maps);
  const questLabel = ({ not_started: 'Chưa nhận', accepted: 'Đang tìm nguyên liệu', ready_to_claim: 'Có thể báo tin', completed: 'Hoàn thành' })[save.adventure.quest];
  const actionLabel = target ? `Tương tác · ${target.label}` : adventure.map === 'forest' ? 'Tiến gần dấu chân / cổng về làng' : 'Tiến gần Lilia';
  const actorRows = battle?.actors.filter((actor) => actor.team === 'player').map((actor) => `
    <div class="combatant"><div class="combatant-title"><span>${escapeHtml(characterNames[actor.id] ?? actor.id)}</span><b>${actor.hp}/${actor.maxHp}</b></div><div class="meter"><i style="width:${Math.max(0, actor.hp / actor.maxHp * 100)}%"></i></div><button class="button light full" data-ultimate="${actor.actor_id}" ${actor.energy < 100 || !actor.alive || battle.phase !== 'battle_running' ? 'disabled' : ''}>Tuyệt kỹ · ${actor.energy}%</button></div>`).join('') ?? '';
  const battleEnemy = battle?.actors.find((actor) => actor.team === 'enemy' && actor.alive);
  const resultPanel = battle?.phase === 'battle_end' ? `<div class="result-box ${battle.result}"><strong>${battle.result === 'victory' ? 'Chiến thắng' : 'Đội hình đã gục'}</strong><p>${battle.result === 'victory' ? 'Nhận 60 vàng và 10 tinh hoa. Tiến trình đã được ghi nhận.' : 'Thử lại trận chiến. Phần thưởng không bị trừ khi thất bại.'}</p><button class="button" data-battle-result>${battle.result === 'victory' ? 'Nhận thưởng & tiếp tục' : 'Thử lại'}</button></div>` : '';
  shell(`
    ${pageHeader(`Phiêu lưu · ${escapeHtml(adventure.map === 'village' ? 'Làng Ẩm Thực' : 'Rừng Nguyên Liệu')}`, adventure.map === 'village' ? 'Làng Ẩm Thực' : 'Rừng Nguyên Liệu', 'Di chuyển bằng WASD / phím mũi tên hoặc chạm điểm đến. Nhấn E hay nút tương tác khi đứng gần mục tiêu.', 'home')}
    <div class="game-layout adventure-layout"><section class="panel world-panel"><div class="panel-heading"><div><h2>${adventure.map === 'village' ? 'Quảng trường & lối rừng' : battle ? 'Mô phỏng giao tranh' : 'Đường mòn trong rừng'}</h2><p>${battle ? `Trận ${battle.id} · tick ${battle.tick} · wave ${battle.wave + 1}` : '30 tick/s · hit do simulation quyết định'}</p></div><span class="phase-pill ${battle ? 'combat' : ''}">${battle ? battle.phase === 'battle_end' ? 'Kết quả' : 'Đang giao chiến' : 'Khám phá'}</span></div>
      <div class="canvas-wrap"><canvas id="adventure-canvas" width="960" height="540" aria-label="Bản đồ phiêu lưu tương tác"></canvas></div>
      <p class="controls-hint">${escapeHtml(adventure.lastMessage)} ${target && !battle ? `<span class="interaction-hint">E · ${escapeHtml(target.label)}</span>` : ''}</p>
      <div class="action-row"><button class="button" data-interact ${battle ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button><button class="button light" data-page="home">Về tổng quan</button>${battle?.phase === 'battle_end' ? resultPanel : ''}</div>
    </section>
    <aside class="side-stack">
      <section class="panel"><h2>Nhật ký hành trình</h2><div class="data-list"><div class="data-row"><span>Nhiệm vụ</span><span>${questLabel}</span></div><div class="data-row"><span>Rương tiếp tế</span><span>${save.adventure.chestOpened ? 'Đã mở' : 'Chưa mở'}</span></div><div class="data-row"><span>Khu rừng</span><span>${save.adventure.forestCleared ? 'Đã khai thông' : 'Chưa khai thông'}</span></div><div class="data-row"><span>Đội hình</span><span>${save.roster.filter((actor) => actor.hp > 0).length}/5 khỏe mạnh</span></div></div></section>
      ${battle ? `<section class="panel"><h2>${battleEnemy ? escapeHtml(battleEnemy.name) : 'Đội hình'}</h2>${battleEnemy ? `<div class="boss-hp"><div class="combatant-title"><span>${battleEnemy.boss ? 'Boss · pha ' + battle.bossPhase : 'Đối thủ'}</span><b>${battleEnemy.hp}/${battleEnemy.maxHp}</b></div><div class="meter enemy"><i style="width:${Math.max(0, battleEnemy.hp / battleEnemy.maxHp * 100)}%"></i></div>${battle.bossTelegraph ? `<p class="telegraph">${escapeHtml(battle.bossTelegraph.attack)} · ${battle.bossTelegraph.ticks} tick</p>` : ''}</div>` : ''}<div class="actor-list">${actorRows}</div></section>` : `<section class="panel"><h2>Đội hình hành trình</h2><div class="actor-list">${save.roster.map((actor) => `<div class="combatant"><div class="combatant-title"><span><i class="element-dot" style="background:${elementColors[actor.element]}"></i>${escapeHtml(characterNames[actor.id])}</span><b>${actor.hp}/${actor.maxHp}</b></div><div class="meter"><i style="width:${Math.max(0, actor.hp / actor.maxHp * 100)}%"></i></div></div>`).join('')}</div></section>`}
      <section class="panel"><h2>Sự kiện runtime</h2>${renderEventLog()}</section>
    </aside></div>
  `);
  app.querySelector('[data-interact]')?.addEventListener('click', doAdventureInteract);
  app.querySelectorAll('[data-ultimate]').forEach((button) => button.addEventListener('click', () => useUltimate(button.dataset.ultimate)));
  app.querySelector('[data-battle-result]')?.addEventListener('click', claimAdventureBattle);
  const canvas = app.querySelector('#adventure-canvas');
  canvas?.addEventListener('pointerdown', onWorldPointer);
}

function renderEventLog() {
  const events = runtime.events.slice(0, 7);
  return `<div class="log">${events.length ? events.map((event) => `<p><b>${escapeHtml(event.type)}</b> · tick ${event.tick}</p>`).join('') : '<p>Chưa có sự kiện trong phiên này.</p>'}</div>`;
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
  runtime.adventure.lastMessage = result.ok ? runtime.adventure.lastMessage : result.reason;
  render();
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
  if (runtime.adventure.battle) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * WORLD.width;
  const y = (event.clientY - rect.top) / rect.height * WORLD.height;
  const path = findAdventurePath(runtime.adventure.map, { x: runtime.adventure.x, y: runtime.adventure.y }, { x, y }, undefined, runtime.maps);
  if (!path.length) {
    runtime.adventure.lastMessage = 'Không tìm được đường đi tới điểm đó.';
    canvas.dataset.pathLength = '0';
    return;
  }
  runtime.adventure.walkPath = path;
  runtime.adventure.walkTarget = { x, y };
  canvas.dataset.pathLength = String(path.length);
}

function drawAdventureFrame(deltaSeconds) {
  const canvas = app.querySelector('#adventure-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
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
      if (!adventure.walkPath.length) { adventure.walkTarget = null; setAdventureInput(adventure, 0, 0); }
    } else setAdventureInput(adventure, dx, dy);
  }
  if (adventure.battle) setAdventureInput(adventure, 0, 0);
  else if (runtime.heldKeys.size) {
    const x = Number(runtime.heldKeys.has('ArrowRight') || runtime.heldKeys.has('d')) - Number(runtime.heldKeys.has('ArrowLeft') || runtime.heldKeys.has('a'));
    const y = Number(runtime.heldKeys.has('ArrowDown') || runtime.heldKeys.has('s')) - Number(runtime.heldKeys.has('ArrowUp') || runtime.heldKeys.has('w'));
    setAdventureInput(adventure, x, y);
    adventure.walkTarget = null;
    adventure.walkPath = [];
  }
  stepAdventure(adventure, runtime.save, deltaSeconds, runtime.maps);
  syncAdventureAnimations(adventure);
  runtime.animations.advance(deltaSeconds * 1000);
  const target = nearestInteraction(adventure, runtime.save, runtime.maps);
  const interactButton = app.querySelector('[data-interact]');
  if (interactButton && !adventure.battle) {
    interactButton.disabled = !target;
    interactButton.textContent = target ? `Tương tác · ${target.label}` : 'Tiến gần một điểm tương tác';
  }
  const now = Date.now();
  if (now - runtime.lastSavedLocation > 900 && !adventure.battle) {
    runtime.lastSavedLocation = now;
    runtime.save.adventure.map = adventure.map;
    runtime.save.adventure.x = adventure.x;
    runtime.save.adventure.y = adventure.y;
    persistSave(runtime.save);
  }
  canvas.dataset.worldX = String(Math.round(adventure.x));
  canvas.dataset.worldY = String(Math.round(adventure.y));
  canvas.dataset.simTick = String(adventure.tick);
  canvas.dataset.pathRemaining = String(adventure.walkPath?.length ?? 0);
  const heroAnimation = runtime.animations.getActorState('chr_bunbo_holinh')?.animation;
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
    const playerActors = adventure.battle.actors.filter((actor) => actor.team === 'player');
    playerActors.forEach((actor, index) => {
      views.push({
        actorId: actor.actor_id,
        characterId: actor.id,
        team: actor.team,
        x: 140 + index * 75,
        y: 300 + Math.sin(index * 2) * 20,
        direction: 'E',
        alive: actor.alive,
      });
    });
    adventure.battle.actors.filter((actor) => actor.team === 'enemy').forEach((actor, index) => {
      views.push({
        actorId: actor.actor_id,
        characterId: actor.id,
        team: actor.team,
        x: actor.boss ? 690 : 670 + index * 75,
        y: actor.boss ? 280 : 298 + Math.sin(index * 3) * 15,
        direction: 'W',
        alive: actor.alive,
      });
    });
  } else {
    const direction = ({ up: 'N', right: 'E', down: 'S', left: 'W' })[adventure.facing] ?? 'S';
    views.push({ actorId: 'chr_bunbo_holinh', characterId: 'chr_bunbo_holinh', team: 'player', x: adventure.x, y: adventure.y, direction, alive: true });
  }

  for (const view of views) {
    runtime.animations.registerActor(view);
    runtime.animations.syncMotion(view.actorId, {
      x: view.x,
      y: view.y,
      direction: view.direction,
      speed: !adventure.battle && Math.hypot(adventure.input.x, adventure.input.y) > 0 ? 1.5 : 0,
      alive: view.alive,
    });
  }
  runtime.animations.retainActors(views.map((view) => view.actorId));
}

function drawWorldScene(context, adventure, save) {
  const forest = adventure.map === 'forest';
  const map = getAdventureMap(runtime.maps, adventure.map);
  context.fillStyle = forest ? '#6d9870' : '#9cc88e'; context.fillRect(0, 0, 960, 540);
  context.fillStyle = forest ? '#8bb080' : '#b5d29b';
  for (let row = 0; row < 12; row += 1) for (let column = 0; column < 20; column += 1) {
    if ((row + column) % 3 === 0) { context.globalAlpha = .22; context.beginPath(); context.ellipse(column * 52 + 20, row * 50 + 15, 13, 4, -.4, 0, Math.PI * 2); context.fill(); }
  }
  context.globalAlpha = 1;
  context.fillStyle = forest ? '#d7c792' : '#d8c99e';
  context.beginPath(); context.moveTo(-20, 350); context.bezierCurveTo(170, 260, 260, 500, 450, 390); context.bezierCurveTo(640, 280, 720, 340, 990, 225); context.lineTo(990, 308); context.bezierCurveTo(720, 420, 640, 360, 470, 455); context.bezierCurveTo(240, 570, 160, 340, -20, 430); context.fill();
  drawMapVisuals(context, map, save);
  drawPlayer(context, adventure.x, adventure.y, runtime.animations.getActorState('chr_bunbo_holinh')?.animation);
  context.fillStyle = '#173c35'; context.font = '700 14px DM Sans, sans-serif'; context.fillText(forest ? 'RỪNG NGUYÊN LIỆU · KHU VỰC 01' : 'LÀNG ẨM THỰC · QUẢNG TRƯỜNG', 22, 30);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawMapVisuals(context, map, save) {
  if (!map) return;
  for (const visual of map.visuals) {
    if (visual.kind === 'house') {
      const palette = { coral: '#c96b50', sage: '#7b8d72', gold: '#d4a84e' };
      const labels = { building_kitchen: 'NHÀ BẾP', building_guild: 'HỘI QUÁN', building_merchant: 'TIỆM' };
      drawHouse(context, visual.x, visual.y, palette[visual.palette] ?? '#b87855', labels[visual.id] ?? 'NHÀ', visual.width, visual.height, visual.id);
    } else if (visual.kind === 'table') {
      drawTable(context, visual.x, visual.y, visual.width, visual.height);
    } else if (visual.kind === 'tree') {
      drawTree(context, visual.x, visual.y, visual.palette === 'forest_dark' ? '#356c50' : '#437a51', visual.palette);
    } else if (visual.kind === 'marker') {
      const color = visual.palette === 'wood' ? '#4b7f62' : visual.palette === 'coral' ? '#e87552' : '#efbd54';
      drawMarker(context, visual.x, visual.y, visual.label, color);
    } else if (visual.kind === 'chest' && !save.adventure.chestOpened) {
      drawChest(context, visual.x, visual.y, false);
    } else if (visual.kind === 'portal') {
      const open = save.adventure.chestOpened;
      drawMarker(context, visual.x, visual.y, open ? visual.label : 'KHÓA', open ? '#e87552' : '#68786e');
    }
  }
}

function drawBattleScene(context, adventure) {
  const battle = adventure.battle;
  const gradient = context.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, '#314e43'); gradient.addColorStop(1, '#a48258');
  context.fillStyle = gradient; context.fillRect(0, 0, 960, 540);
  context.fillStyle = '#6f7753'; context.beginPath(); context.ellipse(485, 342, 440, 130, 0, 0, Math.PI * 2); context.fill();
  for (let index = 0; index < 5; index += 1) {
    const actor = battle.actors.filter((item) => item.team === 'player')[index];
    drawActor(context, actor, 140 + index * 75, 300 + Math.sin(index * 2) * 20, index === 0 ? '#de704f' : elementColors[actor?.element] ?? '#86ac72', runtime.animations.getActorState(actor?.actor_id)?.animation);
  }
  const enemies = battle.actors.filter((item) => item.team === 'enemy');
  enemies.forEach((enemy, index) => drawActor(context, enemy, enemy.boss ? 690 : 670 + index * 75, enemy.boss ? 280 : 298 + Math.sin(index * 3) * 15, enemy.boss ? '#b54e3e' : '#648c4e', runtime.animations.getActorState(enemy.actor_id)?.animation));
  context.fillStyle = '#fff8e6'; context.font = '700 16px DM Sans, sans-serif'; context.fillText(`WAVE ${battle.wave + 1}  ·  TICK ${battle.tick}`, 24, 32);
  if (battle.bossTelegraph) {
    context.fillStyle = '#f5d477'; context.font = '700 18px DM Sans, sans-serif'; context.fillText(`TELEGRAPH: ${battle.bossTelegraph.attack} · ${battle.bossTelegraph.ticks}`, 650, 46);
  }
}

function drawActor(context, actor, x, y, color, animation) {
  if (!actor) return;
  const size = actor.boss ? 55 : 31;
  const charId = actor.boss ? 'boss_thief' : (actor.id ?? 'chr_bunbo_holinh');

  // Thử vẽ Sprite đồ họa
  const spriteDrawn = spriteRenderer.drawSprite(context, charId, animation, x, y, {
    scale: actor.boss ? 1.3 : 1.0,
    flipX: actor.team === 'enemy',
    opacity: actor.alive ? 1.0 : 0.28,
  });

  if (!spriteDrawn) {
    const pose = placeholderPose(animation);
    context.save();
    context.translate(x, y + pose.offsetY);
    context.scale(pose.scaleX, pose.scaleY);
    context.translate(-x, -y);
    context.globalAlpha = actor.alive ? 1 : .28;
    context.fillStyle = '#1f3027a0'; context.beginPath(); context.ellipse(x, y + size, size * .85, 10, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = color; context.beginPath(); context.ellipse(x, y, size * .65, size, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#fff5db'; context.beginPath(); context.arc(x, y - size * .62, size * .4, 0, Math.PI * 2); context.fill();
    context.globalAlpha = 1;
    context.restore();
  }

  // Tên & Thanh máu
  context.save();
  context.globalAlpha = actor.alive ? 1 : .28;
  context.fillStyle = '#283831'; context.font = '700 12px DM Sans, sans-serif'; context.textAlign = 'center';
  context.fillText((actor.name ?? characterNames[actor.id] ?? 'V').slice(0, 12), x, y + size + 22);
  context.textAlign = 'left';
  context.fillStyle = '#24443a'; context.fillRect(x - size, y - size - 13, size * 2, 5);
  context.fillStyle = '#e98157'; context.fillRect(x - size, y - size - 13, size * 2 * Math.max(0, actor.hp / actor.maxHp), 5);
  context.restore();
}

function drawHouse(context, x, y, color, label, width = 176, height = 118, houseId = '') {
  const houseKey = `./assets/sprites/maps/${houseId.replace('building_', 'house_')}.png`;
  const drawn = spriteRenderer.drawImage(context, houseKey, x, y, width, height);
  if (!drawn) {
    context.fillStyle = '#425b45'; context.fillRect(x + 10, y + 38, width - 20, height - 38);
    context.fillStyle = color; context.beginPath(); context.moveTo(x, y + 47); context.lineTo(x + width / 2, y); context.lineTo(x + width, y + 47); context.fill();
    context.fillStyle = '#ead9ad'; context.fillRect(x + 27, y + 48, width - 34, height - 48);
    context.fillStyle = '#745840'; context.fillRect(x + width / 2 - 14, y + height - 40, 28, 40);
  }
  context.fillStyle = '#304e40'; context.font = '700 11px DM Sans, sans-serif'; context.fillText(label, x + 47, y + height + 18);
}

function drawTree(context, x, y, color, palette = 'forest_light') {
  const treeKey = palette === 'forest_dark' ? './assets/sprites/maps/tree_02.png' : './assets/sprites/maps/tree_01.png';
  const drawn = spriteRenderer.drawImage(context, treeKey, x - 24, y - 48, 48, 96);
  if (!drawn) {
    context.fillStyle = '#664c38'; context.fillRect(x - 7, y + 7, 14, 43);
    context.fillStyle = color; context.beginPath(); context.moveTo(x, y - 45); context.lineTo(x - 36, y + 20); context.lineTo(x + 36, y + 20); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(x, y - 21); context.lineTo(x - 31, y + 40); context.lineTo(x + 31, y + 40); context.closePath(); context.fill();
  }
}

function drawMarker(context, x, y, label, color) {
  context.fillStyle = '#213d33'; context.beginPath(); context.ellipse(x, y + 34, 30, 8, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = color; context.beginPath(); context.arc(x, y, 23, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff6e3'; context.font = '700 10px DM Sans, sans-serif'; context.textAlign = 'center'; context.fillText(label, x, y + 4); context.textAlign = 'left';
}

function drawChest(context, x, y, opened = false) {
  const chestKey = opened ? './assets/sprites/maps/chest_open.png' : './assets/sprites/maps/chest_closed.png';
  const drawn = spriteRenderer.drawImage(context, chestKey, x - 20, y - 20, 40, 40);
  if (!drawn) {
    context.fillStyle = '#563f29'; context.fillRect(x - 25, y - 17, 50, 36);
    context.fillStyle = '#dba94f'; context.fillRect(x - 25, y - 19, 50, 12);
    context.fillStyle = '#f1d77d'; context.fillRect(x - 4, y - 11, 8, 25);
  }
  context.fillStyle = '#fff4cf'; context.font = '700 11px DM Sans, sans-serif'; context.textAlign = 'center'; context.fillText('RƯƠNG', x, y + 37); context.textAlign = 'left';
}

function drawTable(context, x, y, width = 85, height = 52) {
  const legHeight = height - 20;
  context.fillStyle = '#80523c'; context.fillRect(x, y, width, 22); context.fillRect(x + 9, y + 20, 8, legHeight); context.fillRect(x + width - 18, y + 20, 8, legHeight);
  context.fillStyle = '#f0d7a5'; context.fillRect(x + 11, y + 4, 16, 8); context.fillRect(x + 39, y + 4, 16, 8);
}

function drawPlayer(context, x, y, animation) {
  const facingLeft = runtime.adventure?.facing === 'left';
  const drawn = spriteRenderer.drawSprite(context, 'chr_bunbo_holinh', animation, x, y, {
    scale: 1.0,
    flipX: facingLeft,
  });
  if (!drawn) {
    const pose = placeholderPose(animation);
    context.save();
    context.translate(x, y + pose.offsetY);
    context.scale(pose.scaleX, pose.scaleY);
    context.translate(-x, -y);
    context.fillStyle = '#193b32'; context.beginPath(); context.ellipse(x, y + 22, 19, 6, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#df7051'; context.beginPath(); context.ellipse(x, y, 14, 20, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f2d5a5'; context.beginPath(); context.arc(x, y - 16, 10, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#39433a'; context.fillRect(x - 12, y - 26, 24, 6);
    context.restore();
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

function renderTcg() {
  if (!runtime.tcg) runtime.tcg = createTcgMatch(runtime.cards, runtime.deck, 41);
  const match = runtime.tcg;
  const user = match.players[0]; const bot = match.players[1];
  const hand = user.hand.map((card) => `<button class="playing-card element-${card.element}" data-card="${escapeAttr(card.instance_id)}"><span class="card-cost">${card.cost}</span><span class="card-element">${escapeHtml(card.element)}</span><div class="card-thumb"><img src="./assets/cards/${escapeAttr(card.card_id)}.png" alt="${escapeAttr(cardName(card))}" loading="lazy" onerror="this.parentElement.style.display='none'"></div><strong>${escapeHtml(cardName(card))}</strong><small>${escapeHtml(card.type.replaceAll('_', ' '))}${card.type === 'unit' ? `<br>${card.atk} ATK · ${card.max_def} DEF` : card.effect ? `<br>${card.effect.value} damage` : ''}</small></button>`).join('');
  const friendlyUnits = user.units.map((unit) => unitTile(unit, true)).join('') || '<div class="empty-slot">Unit slot</div>'.repeat(5);
  const enemyUnits = bot.units.map((unit) => unitTile(unit, false)).join('') || '<div class="empty-slot">Unit slot</div>'.repeat(5);
  const phaseLabel = match.result ? match.winner === 0 ? 'Chiến thắng' : match.winner === null ? 'Hòa trận' : 'Thất bại' : `${match.phase} · Vòng ${match.round}`;
  const canPlay = !match.result && ['action', 'reaction'].includes(match.phase) && match.priority === 0;
  shell(`
    ${pageHeader('Đấu bot · bộ bài 36 lá', 'Thẻ chiến thuật', 'Chọn lá bài để triển khai. Bẫy sẽ được giữ kín đến lúc kích hoạt.', 'home')}
    <div class="game-layout tactical-layout"><section class="panel tcg-board">
      <div class="duel-top"><div><div class="eyebrow">Đối thủ · máy</div><strong>Người giữ vị đối phương</strong><small>${bot.deck.length} lá trong bộ bài · ${bot.hand.length} lá trên tay · ${bot.traps.length} bẫy úp</small></div><div class="commander-hp enemy-hp">${bot.hp}<small> / 8000 HP</small></div></div>
      <div class="unit-row enemy-row">${enemyUnits}</div>
      <div class="stack-strip"><span>${phaseLabel}</span><b>${match.priority === 0 ? 'Ưu tiên: bạn' : 'Ưu tiên: đối thủ'}</b><span>Stack ${match.stack.length}</span></div>
      <div class="unit-row friendly-row">${friendlyUnits}</div>
      <div class="duel-bottom"><div><div class="eyebrow">Bạn · người kết vị</div><strong>Đội hình</strong><small>${user.units.length}/5 đơn vị · ${user.traps.length}/2 bẫy</small></div><div class="commander-hp">${user.hp}<small> / 8000 HP</small></div></div>
      <div class="hand-heading"><strong>Bài trên tay</strong><span>${user.mana}/${user.maxMana} mana · ${user.deck.length} lá còn lại</span></div>
      <div class="hand-row">${hand || '<p class="empty-message">Không còn bài trên tay.</p>'}</div>
      ${match.result ? `<div class="result-box ${match.winner === 0 ? 'victory' : 'defeat'}"><strong>${phaseLabel}</strong><p>${match.winner === 0 ? 'Đối thủ đã bị đánh bại.' : 'Bạn có thể bắt đầu ván mới.'}</p><button class="button" data-tcg-new>Ván mới</button></div>` : ''}
      <div class="action-row"><label class="target-select">Mục tiêu <select id="tcg-target"><option value="commander">Chủ soái đối thủ</option>${bot.units.map((unit) => `<option value="${escapeAttr(unit.instance_id)}">${escapeHtml(cardName(unit))} · ${unit.current_def} DEF</option>`).join('')}</select></label><button class="button" data-tcg-pass ${!canPlay ? 'disabled' : ''}>Bỏ ưu tiên</button><button class="button light" data-tcg-attack ${match.phase !== 'combat' || match.activePlayer !== 0 || match.result ? 'disabled' : ''}>Tấn công bằng quân sẵn sàng</button><button class="button light" data-tcg-skip ${match.phase !== 'combat' || match.activePlayer !== 0 || match.result ? 'disabled' : ''}>Bỏ tấn công</button><button class="button secondary dark-secondary" data-tcg-end ${!['combat', 'round_end'].includes(match.phase) || match.activePlayer !== 0 || match.result ? 'disabled' : ''}>Kết thúc lượt</button></div>
    </section><aside class="side-stack"><section class="panel"><h2>Trạng thái trận</h2><div class="data-list"><div class="data-row"><span>Pha</span><span>${phaseLabel}</span></div><div class="data-row"><span>Quyền ưu tiên</span><span>${match.priority === 0 ? 'Bạn' : 'Đối thủ'}</span></div><div class="data-row"><span>Deck</span><span>${user.deck.length + user.hand.length}/36</span></div><div class="data-row"><span>Mục tiêu</span><span>8000 HP</span></div></div></section><section class="panel"><h2>Nhật ký trận</h2>${renderTextLog(match.log)}</section><section class="panel"><h2>Hợp đồng</h2><p class="muted-copy">Đang bật unit summon, fast/slow damage spell, trap counter, lane attack/block, round draw và thắng/thua. Card effects ngoài grammar mẫu hiện chưa bật.</p></section></aside></div>
  `);
  app.querySelectorAll('[data-card]').forEach((button) => {
    button.addEventListener('click', () => actTcg(() => playTcgCard(runtime.tcg, 0, button.dataset.card, app.querySelector('#tcg-target')?.value ?? 'commander')));
  });
  app.querySelector('[data-tcg-pass]')?.addEventListener('click', () => actTcg(() => runBotPriority(passTcgPriority(runtime.tcg, 0))));
  app.querySelector('[data-tcg-attack]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0)));
  app.querySelector('[data-tcg-skip]')?.addEventListener('click', () => actTcg(() => attackTcg(runtime.tcg, 0, [])));
  app.querySelector('[data-tcg-end]')?.addEventListener('click', () => actTcg(() => runTcgBot(endTcgTurn(runtime.tcg, 0))));
  app.querySelector('[data-tcg-new]')?.addEventListener('click', () => { runtime.tcg = createTcgMatch(runtime.cards, runtime.deck, Date.now() % 999_983); saveNow(); render(); });
  saveNow();
}

function actTcg(action) {
  try {
    runtime.tcg = action();
    runtime.notice = '';
    saveNow();
  } catch (error) {
    runtime.notice = error.message;
  }
  render();
}

function unitTile(unit, friendly) {
  return `<div class="tcg-unit ${friendly ? 'friendly' : ''}"><div class="tcg-unit-avatar"><img src="./assets/cards/${escapeAttr(unit.card_id)}.png" alt="${escapeAttr(cardName(unit))}" onerror="this.parentElement.style.display='none'"></div><b>${escapeHtml(cardName(unit))}</b><span>${unit.atk} ATK</span><strong>${unit.current_def} DEF</strong><small>${unit.ready ? 'Sẵn sàng' : 'Nghỉ'}</small></div>`;
}

function renderTextLog(items) {
  return `<div class="log">${items.slice(0, 12).map((item) => `<p>${escapeHtml(item.text ?? item.type)}</p>`).join('')}</div>`;
}

function renderChess() {
  if (!runtime.chess) runtime.chess = createChessRun(runtime.units, runtime.shopConfig, 2077);
  const run = runtime.chess;
  const boardCells = Array.from({ length: 28 }, (_, index) => {
    const x = index % 7; const y = Math.floor(index / 7);
    const unitIndex = run.board.findIndex((unit) => unit.x === x && unit.y === y);
    const unit = run.board[unitIndex];
    return `<button class="chess-cell ${unit ? 'occupied' : ''} ${runtime.selectedBench !== null && !unit ? 'place-target' : ''}" data-cell="${x},${y}" aria-label="Ô ${x + 1}, ${y + 1}${unit ? ', ' + escapeAttr(unit.display_name) : ''}">${unit ? `<span class="unit-symbol" style="--unit-color:${elementColors[unit.element]}">${escapeHtml(shortName(unit.display_name))}</span><small>${unit.star}★</small><b>${unit.hp} HP</b>` : `<span>${x + 1},${y + 1}</span>`}</button>`;
  }).join('');
  const shop = run.shop.map((unit, index) => unit ? `<button class="shop-unit" data-buy="${index}" ${run.phase !== 'prepare' || run.gold < unit.cost ? 'disabled' : ''}><small>${unit.element} · T${unit.cost}</small><b>${escapeHtml(unit.display_name)}</b><span>◈ ${unit.cost}</span></button>` : `<div class="shop-unit shop-empty"><span>Đã mua</span></div>`).join('');
  const bench = run.bench.map((unit, index) => `<button class="bench-unit ${runtime.selectedBench === index ? 'selected' : ''}" data-bench="${index}"><span class="unit-symbol" style="--unit-color:${elementColors[unit.element]}">${escapeHtml(shortName(unit.display_name))}</span><b>${escapeHtml(unit.display_name)}</b><small>${unit.star}★ · T${unit.cost}</small></button>`).join('') || '<div class="empty-message">Băng ghế trống · mua quân ở cửa hàng bên dưới</div>';
  const result = run.phase === 'finished'
    ? `<div class="result-box ${run.result === 'victory' ? 'victory' : 'defeat'}"><strong>${run.result === 'victory' ? 'Vô địch đấu trường' : 'Run đã kết thúc'}</strong><p>${run.wins} trận thắng · ${run.losses} trận thua · ${run.hp} HP chỉ huy còn lại.</p><button class="button" data-chess-new>Bắt đầu run mới</button></div>`
    : run.result ? `<div class="result-box ${run.result.won ? 'victory' : 'defeat'}"><strong>${run.result.won ? 'Chiến thắng' : 'Thất bại'}</strong><p>${run.result.won ? 'Đối thủ mất 12 HP.' : `Mất ${run.result.damage} HP.`} · +${run.result.income} vàng · ${run.result.ticks} tick.</p><button class="button" data-chess-next>Sang vòng tiếp</button></div>` : '';
  shell(`
    ${pageHeader('Đấu trường · 8 đối thủ mô phỏng', 'Đấu trường linh thú', 'Mua và bố trí quân trong nửa bàn 7×4 của bạn. Mỗi ba bản sao cùng cấp sẽ hợp thể.', 'home')}
    <div class="chess-topbar"><div class="resource">Vòng <b>${run.round}</b> / 10</div><div class="resource">Chỉ huy <b>${run.hp}</b> HP</div><div class="resource">Cấp <b>${run.level}</b></div><div class="resource">Kinh nghiệm <b>${run.experience}/4</b></div><div class="resource">◈ <b>${run.gold}</b></div><div class="resource">${run.wins} thắng · ${run.losses} thua</div></div>
    <div class="game-layout chess-layout"><section class="panel chess-main"><div class="panel-heading"><div><h2>${run.phase === 'prepare' ? 'Sắp xếp đội hình' : run.phase === 'combat' ? 'Combat simulation' : run.phase === 'finished' ? 'Kết thúc trận' : 'Kết quả vòng ' + run.round}</h2><p>${run.phase === 'prepare' ? `${run.board.length}/${run.level} quân trên bàn · ${run.bench.length}/9 ghế` : 'Simulation deterministic theo seed và đội hình'}</p></div><span class="phase-pill ${run.phase !== 'prepare' ? 'combat' : ''}">${run.phase}</span></div>
      <div class="chess-grid" role="group" aria-label="Bàn cờ 7 cột 4 hàng">${boardCells}</div>
      <div class="bench-heading"><strong>Băng ghế</strong><span>${run.bench.length}/9</span></div><div class="bench-row">${bench}</div>
      <div class="shop-heading"><strong>Cửa hàng</strong><span>Refresh 2 vàng · cửa hàng ${run.shopLocked ? 'đã khóa' : 'mở'}</span></div><div class="shop-row">${shop}</div>
      <div class="action-row"><button class="button light" data-chess-refresh ${run.phase !== 'prepare' || run.gold < 2 || run.shopLocked ? 'disabled' : ''}>Làm mới · 2 ◈</button><button class="button light" data-chess-lock ${run.phase !== 'prepare' ? 'disabled' : ''}>${run.shopLocked ? 'Mở khóa' : 'Khóa shop'}</button><button class="button danger" data-chess-sell ${run.phase !== 'prepare' || (!runtime.selectedBench && runtime.selectedBench !== 0 && !runtime.selectedBoard) ? 'disabled' : ''}>Bán quân đã chọn</button><button class="button" data-chess-fight ${run.phase !== 'prepare' ? 'disabled' : ''}>Khóa đội hình & chiến đấu →</button></div>
      ${runtime.notice ? `<p class="notice">${escapeHtml(runtime.notice)}</p>` : ''}${result}
    </section><aside class="side-stack"><section class="panel"><h2>Synergy hiện tại</h2>${renderSynergies(run.board)}</section><section class="panel"><h2>Đối thủ kế tiếp</h2><div class="data-list"><div class="data-row"><span>Đội hình</span><span>${run.opponents[(run.round - 1) % run.opponents.length]?.units.length ?? 0} quân</span></div><div class="data-row"><span>Đối thủ còn lại</span><span>${run.opponents.filter((opponent) => opponent.hp > 0).length}/7</span></div><div class="data-row"><span>Payout</span><span>+5 base · interest ≤5</span></div></div><p class="muted-copy">Đối thủ dùng đội hình bot theo seed; AI không nhận bonus chỉ số/odds.</p></section><section class="panel"><h2>Nhật ký đấu trường</h2>${renderTextLog(run.log)}</section></aside></div>
  `);
  app.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => updateChess(() => buyChessOffer(runtime.chess, Number(button.dataset.buy)))));
  app.querySelectorAll('[data-bench]').forEach((button) => button.addEventListener('click', () => { runtime.selectedBench = Number(button.dataset.bench); runtime.selectedBoard = null; render(); }));
  app.querySelectorAll('[data-cell]').forEach((button) => button.addEventListener('click', () => onChessCell(button.dataset.cell)));
  app.querySelector('[data-chess-refresh]')?.addEventListener('click', () => updateChess(() => refreshChessShop(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-lock]')?.addEventListener('click', () => updateChess(() => toggleChessLock(runtime.chess)));
  app.querySelector('[data-chess-sell]')?.addEventListener('click', sellSelectedChessUnit);
  app.querySelector('[data-chess-fight]')?.addEventListener('click', () => updateChess(() => startChessCombat(runtime.chess)));
  app.querySelector('[data-chess-next]')?.addEventListener('click', () => updateChess(() => advanceChessRound(runtime.chess, runtime.units, runtime.shopConfig)));
  app.querySelector('[data-chess-new]')?.addEventListener('click', () => {
    runtime.chess = createChessRun(runtime.units, runtime.shopConfig, Date.now() % 999_983);
    runtime.selectedBench = null; runtime.selectedBoard = null; runtime.notice = '';
    saveNow(); render();
  });
  saveNow();
}

function onChessCell(coordinates) {
  const [x, y] = coordinates.split(',').map(Number);
  try {
    if (runtime.selectedBench !== null) runtime.chess = placeChessUnit(runtime.chess, runtime.selectedBench, x, y);
    else if (runtime.selectedBoard !== null) runtime.chess = moveChessUnit(runtime.chess, runtime.selectedBoard, x, y);
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
  try { runtime.chess = action(); runtime.notice = ''; saveNow(); }
  catch (error) { runtime.notice = error.message; }
  render();
}

function renderSynergies(board) {
  const counts = new Map();
  for (const unit of board) counts.set(unit.element, (counts.get(unit.element) ?? 0) + 1);
  const elements = ['fire', 'water', 'wood', 'light', 'shadow'];
  return `<div class="synergy-list">${elements.map((element) => { const count = counts.get(element) ?? 0; return `<div class="synergy-row"><i class="element-dot" style="background:${elementColors[element]}"></i><span>${element}</span><strong>${count >= 2 ? 'Kích hoạt' : count ? '1 / 2' : 'Chưa có'}</strong></div>`; }).join('')}</div>`;
}

function renderRoster() {
  shell(`${pageHeader('Hồ sơ · Adventure stat scale', 'Đội hình Vị Linh', 'Cùng nhận diện nhân vật; đồ họa chính thức đã được tích hợp.', 'home')}<section class="roster-grid">${runtime.save.roster.map((actor) => `<article class="roster-card"><div class="roster-avatar" style="--unit-color:${elementColors[actor.element]}"><img src="./assets/avatars/avatar_${actor.id.replace('chr_', '')}.png" alt="${escapeAttr(characterNames[actor.id])}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;" onerror="this.style.display='none'"><span>${escapeHtml(shortName(characterNames[actor.id]))}</span></div><div><div class="eyebrow">${actor.element} · ${actor.role}</div><h2>${escapeHtml(characterNames[actor.id])}</h2><div class="data-list"><div class="data-row"><span>HP</span><b>${actor.hp}/${actor.maxHp}</b></div><div class="data-row"><span>ATK</span><b>${actor.atk}</b></div><div class="data-row"><span>DEF</span><b>${actor.def}</b></div></div></div></article>`).join('')}</section>`);
}

function renderSettings() {
  const settings = runtime.save.settings;
  shell(`${pageHeader('Thiết bị này · save local', 'Cài đặt', 'Tùy chỉnh âm thanh và chuyển động. Audio buses đã có state, chờ asset âm thanh được gắn sau.', 'home')}<section class="settings-list panel">${[['music', 'Nhạc'], ['sfx', 'Hiệu ứng'], ['voice', 'Giọng nói'], ['ambience', 'Môi trường']].map(([key, label]) => `<label class="setting-row"><span>${label}</span><input type="range" min="0" max="100" value="${settings[key]}" data-setting="${key}"><b>${settings[key]}%</b></label>`).join('')}<label class="setting-row"><span>Giảm chuyển động</span><input type="checkbox" data-setting-motion ${settings.reducedMotion ? 'checked' : ''}><b>${settings.reducedMotion ? 'Bật' : 'Tắt'}</b></label><div class="action-row"><button class="button danger" data-reset-save>Khởi tạo lại tiến trình</button></div></section>`);
  app.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('input', () => { runtime.save.settings[input.dataset.setting] = Number(input.value); input.nextElementSibling.textContent = `${input.value}%`; saveNow(); }));
  app.querySelector('[data-setting-motion]')?.addEventListener('change', (event) => { runtime.save.settings.reducedMotion = event.target.checked; runtime.animations.setReducedMotion(event.target.checked); saveNow(); renderSettings(); });
  app.querySelector('[data-reset-save]')?.addEventListener('click', () => { if (!confirm('Xóa tiến trình đã lưu trên thiết bị này?')) return; localStorage.removeItem('soul-of-meal.save.v2'); localStorage.removeItem('soul-of-meal.save.v1'); window.location.reload(); });
}

function render() {
  if (runtime.page === 'home') return renderHome();
  if (runtime.page === 'adventure') return renderAdventure();
  if (runtime.page === 'tcg') return renderTcg();
  if (runtime.page === 'chess') return renderChess();
  if (runtime.page === 'roster') return renderRoster();
  if (runtime.page === 'settings') return renderSettings();
  runtime.page = 'home'; renderHome();
}

function cardName(card) { return card.display_name?.replace('Soul of Meal Sample', 'Lá chiến thuật') ?? card.card_id; }
function shortName(name = '') { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join(''); }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function escapeAttr(value = '') { return escapeHtml(value); }

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key) && runtime.page === 'adventure') {
    runtime.heldKeys.add(key); event.preventDefault();
  }
  if ((key === 'e' || key === 'Enter') && runtime.page === 'adventure' && !runtime.adventure.battle) doAdventureInteract();
});
window.addEventListener('keyup', (event) => runtime.heldKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => runtime.heldKeys.clear());

setInterval(() => {
  if (runtime.page === 'adventure') drawAdventureFrame(1 / 30);
}, 1000 / 30);

try {
  await loadContent();
  render();
  saveNow();
} catch (error) {
  app.innerHTML = `<main class="error-screen"><div class="eyebrow">Không thể khởi tạo game</div><h1>Dữ liệu chưa tải được</h1><p>${escapeHtml(error.message)}</p><p>Hãy chạy client từ server ở package root để các catalog trong <code>examples/</code> khả dụng.</p><button class="button" onclick="location.reload()">Thử lại</button></main>`;
}