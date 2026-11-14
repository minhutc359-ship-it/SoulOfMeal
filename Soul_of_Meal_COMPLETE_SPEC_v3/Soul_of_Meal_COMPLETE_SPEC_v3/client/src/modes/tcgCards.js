export const TCG_RULES_VERSION = 2;
export const TCG_COMPACT_TABLE_VERSION = 3;
export const TCG_TABLE_VERSION = 4;
export const TCG_TABLE_DECK_SIZE = 24;
export const usesTcgTable = match => [TCG_COMPACT_TABLE_VERSION, TCG_TABLE_VERSION].includes(match?.rulesVersion);
export const hasModernTcgRules = match => match.rulesVersion === TCG_RULES_VERSION || usesTcgTable(match);
export const tcgBoardLimit = match => match?.rulesVersion === TCG_COMPACT_TABLE_VERSION ? 4 : TCG_BOARD_LIMIT;
export const tcgTrapSlot = (trap, index) => trap.slot ?? index;
export const tcgOpenTrapSlots = (match, player) => {
  const used = new Set(match.players[player].traps.map(tcgTrapSlot));
  return Array.from({ length: tcgTrapLimit(match) }, (_, slot) => slot).filter(slot => !used.has(slot));
};
export const tcgTrapLimit = match => match?.rulesVersion === TCG_COMPACT_TABLE_VERSION ? 1 : TCG_TRAP_LIMIT;
export const tcgCommanderMax = (match, player) => match.players[player].maxHp ?? TCG_MAX_HP;
export const TCG_MAX_HP = 8000;
export const TCG_HAND_LIMIT = 9;
export const tcgHandLimit = match => usesTcgTable(match) ? 8 : TCG_HAND_LIMIT;
export const TCG_BOARD_LIMIT = 5;
export const TCG_TRAP_LIMIT = 2;
export const TCG_SPELL_TYPES = ['fast_spell', 'slow_spell', 'burst_spell'];
export const TCG_REACTIONS = ['fast_spell', 'burst_spell'];

export const TCG_RECIPES = {
  fire: { name: 'Quà phố', finish: ['deal_damage', 'sweep_damage'], reward: 'Gây thêm 100 HP lên chủ soái địch và rút 1 lá.', bonus: 'damage' },
  water: { name: 'Bến nước ký ức', finish: ['scout_trap', 'draw_cards', 'recall_enemy'], reward: 'Trói Vị Linh địch có ATK cao nhất. Nếu sân địch trống, rút 1 lá.', bonus: 'root' },
  wood: { name: 'Vườn sau cơn mưa', finish: ['restore_defense', 'team_heal', 'raise_ally'], reward: 'Hồi tối đa 150 DEF cho mỗi đồng minh.', bonus: 'heal' },
  light: { name: 'Bếp Tết sum vầy', finish: ['grant_shield', 'team_shield'], reward: 'Mỗi đồng minh nhận 100 ATK và 100 hộ thuẫn đến hết lượt.', bonus: 'buff' },
  shadow: { name: 'Đêm rước đèn', finish: ['execute', 'counter_reaction', 'drain_unit'], reward: 'Mỗi đồng minh nhận 100 hộ thuẫn và bạn rút 1 lá.', bonus: 'ward' },
};

export function tcgRecipeFor(match, playerIndex, card) {
  if (!usesTcgTable(match) || match.activePlayer !== playerIndex) return null;
  const player = match.players[playerIndex];
  const anchor = player.units.find(unit => unit.instance_id === player.recipeAnchor);
  const recipe = anchor && TCG_RECIPES[anchor.element];
  return recipe && !player.recipesUsed?.includes(anchor.element) && recipe.finish.includes(card.effect?.kind)
    ? anchor.element : null;
}

const EFFECTS = {
  deal_damage: { target: 'enemy', text: n => `Gây ${n} sát thương lên một Vị Linh địch hoặc chủ soái địch.`, badge: n => `${n} ST` },
  restore_defense: { target: 'injured', text: n => `Hồi tối đa ${n} DEF cho một Vị Linh đồng minh bị thương.`, badge: n => `+${n} DEF` },
  grant_shield: { target: 'ally', text: n => `Tạo ${n} hộ thuẫn cho một đồng minh đến hết lượt.`, badge: n => `${n} khiên` },
  boost_attack: { target: 'ally', text: n => `Tăng ${n} ATK cho một đồng minh đến hết lượt.`, badge: n => `+${n} ATK` },
  sweep_damage: { target: 'enemy_row', text: n => `Gây ${n} sát thương lên từng Vị Linh địch.`, badge: n => `${n} ST diện rộng` },
  bind_damage: { target: 'enemy_unit', text: n => `Gây ${n} sát thương và trói mục tiêu đến khi lượt của chủ kết thúc. Quân bị trói không thể đánh hoặc chặn.`, badge: n => `${n} ST · Trói` },
  team_heal: { target: 'injured_row', text: n => `Hồi tối đa ${n} DEF cho từng đồng minh bị thương.`, badge: n => `+${n} DEF cả đội` },
  team_shield: { target: 'ally_row', text: n => `Tạo ${n} hộ thuẫn cho từng đồng minh đến hết lượt.`, badge: n => `${n} khiên cả đội` },
  execute: { target: 'wounded_enemy', text: n => `Hạ một Vị Linh địch còn tối đa ${n}% DEF, kể cả khi có hộ thuẫn.`, badge: n => `Kết liễu ≤${n}% DEF` },
  heal_commander: { target: 'own_commander', text: n => `Hồi tối đa ${n} HP cho chủ soái của bạn.`, badge: n => `+${n} HP` },
  draw_cards: { target: 'own_deck', text: n => `Rút tối đa ${n} lá còn trong bộ bài. Lá vượt giới hạn tay bài vào mộ bài.`, badge: n => `Rút ${n} lá` },
  disarm_trap: { target: 'any_trap', text: () => 'Gỡ một bẫy địch. Bẫy úp rời sân mà không lộ danh tính.', badge: () => 'Gỡ bẫy' },
  scout_trap: { target: 'hidden_trap', text: () => 'Lộ một bẫy địch, giữ nguyên hiệu lực bẫy. Sau đó rút tối đa một lá.', badge: () => 'Do thám · Rút 1' },
  shatter_shield: { target: 'shielded_enemy', text: n => `Phá toàn bộ hộ thuẫn của một Vị Linh địch, sau đó gây ${n} sát thương.`, badge: n => `Phá khiên · ${n} ST` },
  recall_enemy: { target: 'enemy_unit', text: () => 'Đưa một Vị Linh địch về tay chủ, xóa trạng thái. Nếu tay đầy, đưa vào mộ bài.', badge: () => 'Về tay' },
  weaken_enemy: { target: 'enemy_unit', text: n => `Giảm tối đa ${n} ATK của một Vị Linh địch đến hết lượt.`, badge: n => `−${n} ATK` },
  raise_ally: { target: 'fallen_ally', text: n => `Gọi một Vị Linh trong mộ về ô trống đầu tiên với tối đa ${n} DEF. Quân trở lại ở trạng thái nghỉ.`, badge: n => `Hồi sinh · ${n} DEF` },
  rally_unit: { target: 'spent_ally', text: () => 'Cho một đồng minh đã đánh trong lượt này sẵn sàng đánh thêm một lần. Chỉ dùng trong lượt của bạn.', badge: () => 'Tái chiến' },
  drain_unit: { target: 'enemy_unit', text: n => `Gây ${n} sát thương lên một Vị Linh địch. Chủ soái bạn hồi bằng DEF thực sự đã trừ.`, badge: n => `Hút tối đa ${n} DEF` },
  counter_reaction: { target: 'stack', text: () => 'Hóa giải một phép hoặc bẫy địch đang chờ. Đối thủ đã trả mana khi sử dụng.', badge: () => 'Hóa giải' },
};

export function tcgEffectText(card) {
  const { kind, value } = card.effect ?? {};
  return Object.hasOwn(EFFECTS, kind) ? EFFECTS[kind].text(value) : '';
}

export function tcgEffectBadge(card) {
  const { kind, value } = card.effect ?? {};
  return Object.hasOwn(EFFECTS, kind) ? EFFECTS[kind].badge(value) : '';
}

export function tcgTurnSerial(match) {
  return match.round * 2 - Number(match.activePlayer === 0);
}

export function tcgCardCost(match, playerIndex, card) {
  const player = match.players[playerIndex];
  const resonance = hasModernTcgRules(match) && card.type !== 'trap' && card.cost > 0
    && player.chainElement === card.element && !player.resonanceUsed;
  return card.cost - Number(resonance);
}

export function tcgCaster(match, playerIndex, card) {
  if (!card.requires_character) return null;
  return match.players[playerIndex].units.filter(unit => unit.current_def > 0 && unit.character_id === card.requires_character)
    .sort((a, b) => a.lane - b.lane)[0] ?? null;
}

export function tcgSpellTargets(match, playerIndex, card) {
  const { kind, value } = card.effect ?? {};
  if (!Object.hasOwn(EFFECTS, kind) || (card.requires_character && !tcgCaster(match, playerIndex, card))) return [];
  const ally = match.players[playerIndex];
  const enemyIndex = 1 - playerIndex;
  const enemy = match.players[enemyIndex];
  const allies = ally.units.filter(unit => unit.current_def > 0);
  const enemies = enemy.units.filter(unit => unit.current_def > 0);
  const injured = allies.filter(unit => unit.current_def < unit.max_def);
  const units = (list, player) => list.map(unit => ({ id: unit.instance_id, player, unit, label: unit.display_name }));
  const group = (list, player, label) => list.length ? [{ id: 'row', player, units: list, label }] : [];
  const commander = player => ({ id: 'commander', player, unit: null, label: player === playerIndex ? 'Chủ soái của bạn' : 'Chủ soái đối thủ' });
  const target = EFFECTS[kind].target;
  switch (target) {
    case 'enemy': return [commander(enemyIndex), ...units(enemies, enemyIndex)];
    case 'enemy_unit': return units(enemies, enemyIndex);
    case 'shielded_enemy': return units(enemies.filter(unit => unit.shield > 0), enemyIndex);
    case 'fallen_ally': return allies.length < tcgBoardLimit(match)
      ? ally.graveyard.filter(card => card.type === 'unit').map(card => ({ id: 'grave:' + card.instance_id, player: playerIndex, fallen: card, label: card.display_name })) : [];
    case 'spent_ally': return match.activePlayer === playerIndex && !match.pendingAttack
      ? units(allies.filter(unit => !unit.ready && !unit.rootedUntil && unit.struckTurn === tcgTurnSerial(match)), playerIndex) : [];
    case 'wounded_enemy': return units(enemies.filter(unit => unit.current_def * 100 <= unit.max_def * value), enemyIndex);
    case 'ally': return units(allies, playerIndex);
    case 'injured': return units(injured, playerIndex);
    case 'enemy_row': return group(enemies, enemyIndex, 'Toàn bộ Vị Linh địch');
    case 'ally_row': return group(allies, playerIndex, 'Toàn bộ đồng minh');
    case 'injured_row': return group(injured, playerIndex, 'Mọi đồng minh bị thương');
    case 'own_commander': return ally.hp < tcgCommanderMax(match, playerIndex) ? [commander(playerIndex)] : [];
    case 'own_deck': return ally.deck.length ? [{ id: 'deck', player: playerIndex, label: 'Bộ bài của bạn' }] : [];
    case 'any_trap':
    case 'hidden_trap': return enemy.traps.flatMap((trap, index) => {
      const slot = tcgTrapSlot(trap, index);
      if (target === 'hidden_trap' && !trap.faceDown) return [];
      const label = `Bẫy địch ô ${slot + 1}` + (trap.faceDown ? '' : ' · ' + trap.card.display_name);
      return [{ id: 'trap:' + (trap.token ?? slot), player: enemyIndex, slot, label }];
    });
    case 'stack': return [...match.stack].reverse().filter(item => item.owner === enemyIndex)
      .map(item => ({ id: 'stack:' + item.id, player: enemyIndex, item, label: item.card.display_name }));
  }
  return [];
}

export const TCG_KEYWORDS = {
  guard: 'Hộ vệ · Đòn thường phải nhắm một Hộ vệ còn trên sân.',
  haste: 'Xung phong · Được đánh ngay khi vào sân.',
  pierce: 'Xuyên kích · Sát thương vượt DEF và hộ thuẫn của quân chặn chuyển sang chủ soái địch.',
  lifesteal: 'Hút vị · Hồi chủ soái bằng 35% DEF hoặc HP thực sự đã trừ khi giao tranh.',
};
