const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright');
const catalog = require('../../examples/cards/cards.catalog.json');

const base = process.env.SOM_UI_BASE ?? 'http://127.0.0.1:4173';
const output = process.env.SOM_UI_OUTPUT;
const baseline = process.env.SOM_UI_BASELINE === '1';
const reference = process.env.SOM_UI_REFERENCE === '1';
const saveKey = 'soul-of-meal.save.v2';
const viewports = [[1920, 1080], [1366, 768], [844, 390], [932, 430], [1280, 720], [1600, 900], [390, 844], [360, 740], [1024, 768]];
const screen = name => `.shell[data-screen="${name}"]`;
const click = (page, selector) => page.locator(selector).first().click();
const tap = (page, selector) => page.locator(selector).first().tap();
const close = page => click(page, 'dialog[open] [data-close-info]');

async function capture(page, name, size) {
  if (!output) return;
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 83, fromSurface: false });
    await writeFile(join(output, `${name}-${size}.jpg`), Buffer.from(data, 'base64'));
  } finally { await session.detach(); }
}

async function lobby(page) {
  if (await page.locator(screen('home')).count()) return;
  if (await page.locator('[data-result-home]').count()) await click(page, '[data-result-home]');
  else if (baseline && await page.locator('.game-dock [data-page="home"]').count()) await click(page, '.game-dock [data-page="home"]');
  else {
    await click(page, '.match-menu summary');
    await click(page, '.match-menu [data-page="home"]');
    if (await page.locator('[data-confirm-exit]').count()) await click(page, '[data-confirm-exit]');
  }
  await page.waitForSelector(screen('home'));
}

async function visit(page, name) {
  await lobby(page);
  await click(page, `[data-page="${name}"]`);
  await page.waitForSelector(screen(name));
}

async function measure(page, name, width, height) {
  const selector = { adventure: '#adventure-canvas', tcg: '.duel-field', chess: '.chess-formation', roster: '.spirit-portrait' }[name];
  const { viewport, root, shell, main, field, controls, dock, tile, stage } = await page.evaluate(selector => {
    const box = element => element.getBoundingClientRect().toJSON();
    const main = document.querySelector('main');
    return {
      viewport: [innerWidth, innerHeight], root: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      shell: document.querySelector('.shell').scrollWidth, main: main.scrollHeight - main.clientHeight,
      field: box(document.querySelector(selector)), tile: main.querySelector('.player-formation .chess-cell')?.getBoundingClientRect().toJSON(),
      stage: main.querySelector('.chess-stage')?.getBoundingClientRect().toJSON(), dock: Boolean(document.querySelector('.game-dock')),
      controls: [...main.querySelectorAll('.match-actions button, .map-toggle, .shop-unit, .bench-unit')]
        .filter(element => element.getClientRects().length).map(box),
    };
  }, selector);
  if (!baseline && !reference) {
    assert.deepEqual(viewport, [width, height]);
    assert.ok(root[0] <= width && root[1] <= height && shell <= width + 1, `${name} root overflow`);
    assert.ok(field.left >= 0 && field.right <= width + 1, `${name} field overflow`);
    if (name !== 'roster') {
      assert.equal(dock, false, `${name} lobby navigation`);
      if (name === 'chess') {
        assert.ok(Math.abs(field.width / field.height - 16 / 9) < .02, 'Chess board aspect');
        assert.ok(tile.height / tile.width > .36, `${width}×${height} tile ${tile.width}×${tile.height}`);
        if (width > height) assert.ok(tile.height >= 20, 'Landscape Chess tile height');
        assert.ok(field.height <= stage.height + 1);
      } else assert.ok(field.width > width * .88 && field.height > height * .33, `${name} field size ${Math.round(field.width)}×${Math.round(field.height)} at ${width}×${height}`);
      assert.ok(main <= 2, `${name} main overflow`);
      for (const control of controls) assert.ok(control.right <= width + 1 && control.bottom <= height + 1, `${name} control overflow`);
    }
  }
  await capture(page, name, `${width}x${height}`);
  return [name, Math.round(field.width), Math.round(field.height)];
}

async function drag(page, from, to, useTouch = false) {
  const [a, b] = await Promise.all([page.locator(from).first().boundingBox(), page.locator(to).first().boundingBox()]);
  assert.ok(a && b, `${from} → ${to}`);
  if (useTouch) {
    const session = await page.context().newCDPSession(page);
    try {
      const x = a.x + a.width / 2, y = a.y + a.height / 2;
      const dx = b.x + b.width / 2 - x, dy = b.y + b.height / 2 - y;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const step of [.2, .5, .8, 1]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step, y: y + dy * step }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await session.detach(); }
    return;
  }
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function checkVillageDoors(page) {
  const canvas = page.locator('#adventure-canvas');
  const heading = name => page.getByRole('heading', { name, exact: true }).waitFor();
  const tapWorld = async (x, y) => {
    const box = await canvas.boundingBox();
    const playerY = Number(await canvas.getAttribute('data-world-y'));
    const worldWidth = 960, worldHeight = 540;
    const cameraHeight = worldWidth * box.height / box.width;
    const top = Math.min(worldHeight - cameraHeight, Math.max(0, playerY - cameraHeight / 2));
    await page.touchscreen.tap(box.x + x * box.width / worldWidth, box.y + (y - top) * box.height / cameraHeight);
  };
  await tapWorld(399, 235);
  await heading('Hội Quán');
  await tap(page, '[data-leave-room]');
  await heading('Làng Ẩm Thực');
  await tapWorld(728, 240);
  await heading('Tiệm Nguyên Liệu');
  await tap(page, '[data-leave-room]');
  await heading('Làng Ẩm Thực');
  await tapWorld(600, 195);
  await page.waitForFunction(() => {
    const { worldX, worldY, pathRemaining } = document.querySelector('#adventure-canvas').dataset;
    return pathRemaining === '0' && Math.abs(Number(worldX) - 600) < 2 && Math.abs(Number(worldY) - 195) < 2;
  });
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => Number(document.querySelector('#adventure-canvas').dataset.worldY) < 125);
    await page.waitForTimeout(500);
  } finally { await page.keyboard.up('w'); }
  assert.ok(Number(await canvas.getAttribute('data-world-y')) >= 100, 'North wall stops the avatar');
}

async function checkTcgTargets(page) {
  const { createTcgMatch, tcgTableDeck } = await import('../src/modes/tcg.js');
  const { TCG_TABLE_VERSION } = await import('../src/modes/tcgCards.js');
  const deck = tcgTableDeck(catalog);
  const card = (id, owner = 0) => ({ ...catalog.cards.find(item => item.card_id === id), instance_id: `test:${owner}:${id}` });
  const unit = (id, lane, owner = 0) => {
    const value = card(id, owner);
    return { ...value, lane, current_def: value.max_def - 300, ready: true };
  };
  const ally = unit('card_demo_01', 1);
  const enemy = unit('card_demo_02', 0, 1);
  const ward = card('card_spirit_ward');
  const renewal = card('card_spirit_renewal');
  const damage = card('card_demo_11');
  const trap = card('card_demo_16');
  const enemySpell = card('card_demo_11', 1);
  const match = createTcgMatch(catalog, deck, 77, deck, 'normal', TCG_TABLE_VERSION);
  Object.assign(match, { round: 2, mulliganDone: true });
  Object.assign(match.players[0], { hand: [ward, renewal, damage, trap], units: [ally], mana: 7, maxMana: 7 });
  Object.assign(match.players[1], { hand: [], units: [enemy], mana: 0 });
  match.players[1].deck.push(enemySpell);
  await page.evaluate(({ key, match }) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.modes.tcg = match;
    localStorage.setItem(key, JSON.stringify(save));
  }, { key: saveKey, match });
  await page.reload();
  await click(page, '[data-enter]');
  await page.waitForSelector(screen('home'));
  await visit(page, 'tcg');
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).modes.tcg, saveKey);
  const selectCard = item => tap(page, `[data-card="${item.instance_id}"]`);
  const target = id => tap(page, `[data-spell-target="${id}"]`);
  await selectCard(ward);
  assert.equal(await page.locator('.duel-field .spell-target').count(), 1);
  assert.equal((await read()).players[0].mana, 7);
  await target(ally.instance_id);
  let state = await read();
  assert.equal(state.players[0].units[0].shield, ward.effect.value);
  assert.equal(state.players[0].hand.some(item => item.instance_id === ward.instance_id), false);
  await selectCard(renewal);
  await target(ally.instance_id);
  state = await read();
  assert.equal(state.stack.at(-1)?.card.instance_id, renewal.instance_id);
  await tap(page, '[data-tcg-pass]');
  assert.ok((await read()).players[0].units[0].current_def > ally.current_def);
  await selectCard(trap);
  await target('set');
  assert.equal((await read()).players[0].traps[0].faceDown, true);
  await selectCard(damage);
  assert.equal(await page.locator('[data-spell-target="commander"]').count(), 1);
  await target(enemy.instance_id);
  state = await read();
  assert.equal(state.stack.length, 0);
  assert.ok(!state.players[1].units.length || state.players[1].units[0].current_def < enemy.current_def);
  await tap(page, `[data-tcg-attacker="${ally.instance_id}"]`);
  await tap(page, '[data-tcg-strike-target="commander"]');
  state = await read();
  assert.equal(state.players[0].units[0].ready, false);
  assert.ok(state.players[1].hp < match.players[1].hp);
  await page.waitForSelector('.tcg-cutin[data-invocation="attack"][data-owner="0"]', { state: 'attached' });
  await tap(page, '[data-tcg-end]');
  await tap(page, '[data-tcg-trap-option]');
  state = await read();
  assert.ok(state.players[1].graveyard.some(item => item.instance_id === enemySpell.instance_id));
  assert.ok(state.log.some(item => item.type === 'stack_item_countered'));
  await page.waitForSelector('.tcg-trap-flash', { state: 'attached' });
  assert.equal(await page.locator('.tcg-match select, [data-tcg-cast], .tcg-unit canvas').count(), 0);
}

async function check(page, width, height) {
  const size = `${width}x${height}`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/client/`);
  await page.waitForSelector('[data-enter]');
  await capture(page, 'login', size);
  await click(page, '[data-enter]');
  await page.locator('.meta-onboarding input[name="name"]').fill('Kiểm Thử');
  if (baseline) await page.locator('[name="starter"][value="chr_som_016"]').check();
  else assert.deepEqual(await page.locator('.meta-onboarding input').evaluateAll(inputs => inputs.map(input => input.name)), ['name']);
  await click(page, '.meta-onboarding [type="submit"]');
  if (!baseline) {
    await page.waitForSelector('.starter-summon');
    const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
    const ids = first.meta.profile.starterIds;
    assert.equal(new Set(ids).size, 2);
    assert.deepEqual(first.adventure.party, ids);
    assert.deepEqual(first.roster.map(member => member.id), ids);
    assert.equal(first.meta.wallet.ticket, 10);
    assert.equal(first.meta.starterRevealPending, true);
    if (width === 844) {
      await page.reload();
      await click(page, '[data-enter]');
      await page.waitForSelector('.starter-summon');
      const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).meta.profile.starterIds, saveKey);
      assert.deepEqual(restored, ids);
    }
    const skip = page.locator('.starter-summon [data-reveal-all]');
    if (await skip.isVisible()) await skip.click();
    await page.waitForSelector('[data-starter-next="adventure"]:enabled');
    assert.equal(await page.locator('.starter-summon [data-revealed="true"]').count(), 2);
    await capture(page, 'starter-summon', size);
    if (width === 844) {
      await click(page, '[data-starter-next="gacha"]');
      await page.waitForSelector(screen('gacha'));
      await click(page, '[data-scene-back]');
      await page.waitForSelector(screen('home'));
      await visit(page, 'adventure');
    } else await click(page, '[data-starter-next="adventure"]');
  }
  await page.waitForSelector(screen('adventure'));
  const results = [await measure(page, 'adventure', width, height)];
  if (!baseline) {
    const canvas = page.locator('#adventure-canvas');
    await page.waitForFunction(() => Number(document.querySelector('#adventure-canvas')?.dataset.worldX) > 0);
    const before = Number(await canvas.getAttribute('data-world-x'));
    await page.keyboard.down('d');
    await page.waitForFunction(x => Number(document.querySelector('#adventure-canvas').dataset.worldX) > x + 4, before);
    await page.keyboard.up('d');
    await click(page, '[data-open-journal]');
    await page.waitForSelector('.quest-dialog[open]');
    await page.goBack();
    await page.waitForSelector('.quest-dialog', { state: 'detached' });
    await page.waitForSelector(screen('adventure'));
    await click(page, '[data-map-toggle]');
    await page.waitForSelector('.world-map-expanded');
    await close(page);
    await click(page, '[data-guide-objective]');
    await click(page, '[data-interact]:visible');
    await page.waitForSelector('.story-dialog[open]');
    await page.keyboard.press('Escape');
    if (width === 844 && !reference) await checkVillageDoors(page);
  }
  await lobby(page);
  if (!baseline && !reference) {
    assert.equal(await page.locator('.lobby-modes').count(), 0);
    assert.ok(await page.locator('.game-dock [data-page=store]').isVisible());
    assert.equal(await page.locator('.shell[data-screen=home] main').evaluate(el => el.scrollHeight - el.clientHeight), 0);
  }
  await capture(page, 'lobby', size);
  await visit(page, 'tcg');
  if (!baseline && !reference) assert.equal(await page.locator('.tcg-match[data-mulligan=true]').count(), 1);
  results.push(await measure(page, 'tcg', width, height));
  if (!baseline) {
    await click(page, '[data-tcg-mulligan]');
    assert.equal(await page.locator('[data-tcg-mulligan]').count(), 0);
    await click(page, '.hand-inspect');
    await page.waitForSelector('dialog[open] .inspect-tcg');
    await close(page);
    if (width === 844 && !reference) {
      const unit = page.locator('[data-card]:enabled').filter({ has: page.locator('.card-copy small', { hasText: 'Vị Linh' }) }).first();
      await unit.tap();
      await page.waitForSelector('.friendly-row .tcg-unit .tcg-unit-avatar img');
      assert.equal(await page.locator('.friendly-row > :first-child').evaluate(slot => slot.classList.contains('tcg-unit')), true);
      assert.equal(await page.locator('.duel-field canvas.board-chibi, #tcg-target, [data-tcg-cast]').count(), 0);
      await page.waitForSelector('.tcg-cutin[data-invocation="summon"][data-owner="0"]', { state: 'attached' });
      await capture(page, 'tcg-deploy', size);
    }
    if (width === 1366) {
      const card = page.locator('[data-card]:enabled').first();
      const art = await card.boundingBox();
      assert.ok(art, 'playable card for long press');
      await page.mouse.move(art.x + art.width / 2, art.y + art.height / 2);
      await page.mouse.down();
      await page.waitForSelector('dialog[open] .inspect-tcg');
      await page.mouse.up();
      await close(page);
    }
    await click(page, '.match-menu summary');
    await click(page, '[data-scene-settings]');
    await page.waitForSelector('dialog[open] [data-setting="music"]');
    await close(page);
    await page.goBack();
    await page.waitForSelector('[data-confirm-exit]');
    await close(page);
    await click(page, '.match-menu summary');
    await click(page, '[data-tcg-surrender]');
    await click(page, '[data-confirm-surrender]');
    await page.waitForSelector('.battle-result-dialog[open]');
  }
  await visit(page, 'chess');
  results.push(await measure(page, 'chess', width, height));
  if (!baseline) {
    const activate = width < 900 ? tap : click;
    await activate(page, '[data-buy]:enabled');
    assert.equal(await page.locator('[data-chess-bench-slot]').count(), 9);
    assert.equal(await page.locator('[data-bench]').first().evaluate(element => {
      const slot = element.getBoundingClientRect(), art = element.querySelector('img').getBoundingClientRect();
      return art.left >= slot.left && art.right <= slot.right && art.top >= slot.top && art.bottom <= slot.bottom;
    }), true);
    if (width < 900) {
      await tap(page, '[data-bench]');
      await tap(page, '[data-cell="2,0"]');
    } else await drag(page, '[data-bench]', '[data-cell="2,0"]');
    if (width === 844 && !reference) {
      await drag(page, '[data-buy]:enabled', '[data-cell="3,0"]', true);
      await page.waitForSelector('[data-cell="3,0"][data-chess-board-index]');
    }
    await click(page, '[data-chess-fight]:enabled');
    await page.waitForSelector('#chess-replay');
    assert.equal(await page.locator('.chess-grid, [data-buy]').count(), 0);
    if (output) {
      await click(page, '[data-chess-pause]');
      await capture(page, 'chess-combat', size);
    }
    await click(page, '[data-chess-skip]');
    await page.waitForSelector('.battle-result-dialog[open]');
    assert.equal(await page.locator('.chess-controls .result-box, .chess-grid').count(), 0);
    await capture(page, 'chess-result', size);
  }
  await visit(page, 'roster');
  results.push(await measure(page, 'roster', width, height));
  if (!baseline) {
    await click(page, '[data-roster-cycle="1"]');
    if (!reference) {
      await click(page, '[data-spirit-tab=skills]');
      await click(page, '[data-preview-spirit]');
      await click(page, '[data-open-roster]');
      await page.selectOption('[data-roster-filter]', 'all');
      for (let index = 0; index < (width === 844 ? 10 : 1); index++) {
        await page.locator('dialog[open] [data-spirit-choice]').nth(index).click();
        assert.ok(await page.locator('.spirit-stage-art').isVisible());
        await click(page, '[data-open-roster]');
      }
      await close(page);
    }
    await click(page, '[data-scene-back]');
    await page.waitForSelector(screen('home'));
    await click(page, '.game-dock [data-page="gacha"]');
    await page.waitForSelector(screen('gacha'));
    await click(page, '[data-gacha-odds]');
    await page.waitForSelector('dialog[open] .meta-odds');
    await close(page);
    await capture(page, 'gacha', size);
    await click(page, '[data-gacha-draw="1"]');
    await click(page, '[data-confirm-draw]');
    if (width === 1366) {
      await page.waitForSelector('dialog[open][data-cinematic] canvas');
      await click(page, '[data-gacha-skip]');
    }
    await page.waitForSelector('dialog[open] .meta-reveal-card[data-revealed="true"]');
    assert.match(await page.locator('.meta-wallet').textContent(), /9 vé/);
    await close(page);
    await click(page, '[data-scene-back]');
    await page.waitForSelector(screen('home'));
    await visit(page, 'store');
    await page.waitForSelector('.store-shopkeeper');
    await capture(page, 'store', size);
    await click(page, '[data-store-offer]:enabled');
    await page.waitForSelector('dialog[open] [data-store-purchase]');
    await close(page);
  }
  if (width === 844 && !baseline && !reference) await checkTcgTargets(page);
  assert.deepEqual(errors, []);
  console.log(size, JSON.stringify(results));
}

(async () => {
  const bundled = process.env.SOM_UI_CHROMIUM ? (await import(process.env.SOM_UI_CHROMIUM)).default : null;
  const executablePath = process.env.SOM_UI_CHROMIUM_PATH;
  if (output) await mkdir(output, { recursive: true });
  for (const [width, height] of viewports) {
    if (process.env.SOM_UI_SIZE && process.env.SOM_UI_SIZE !== `${width}x${height}`) continue;
    const browser = await chromium.launch(bundled ? { executablePath: await bundled.executablePath(), args: bundled.args } : { executablePath });
    try {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 1100, reducedMotion: width === 1366 ? 'no-preference' : 'reduce' });
      await check(page, width, height);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
