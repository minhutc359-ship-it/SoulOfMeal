import { escapeHtml as e, escapeAttr as a, textLog } from "./html.js";
import { characterArt, ELEMENTS } from "../core/characters.js";
const TYPES = {
  unit: "Vị Linh",
  fast_spell: "Tốc chú",
  slow_spell: "Phép",
  burst_spell: "Tức thời",
  trap: "Bẫy",
};
const PHASES = {
  action: "Triển khai",
  reaction: "Phản ứng",
  combat: "Tấn công",
  round_end: "Kết thúc lượt",
  result: "Kết quả",
};
export function cardFace(card, count = null) {
  return `<span class="card-cost">${card.cost}</span><span class="card-element">${ELEMENTS[card.element] ?? ""} · ${card.rarity ?? "R"}</span><div class="card-thumb"><img src="${characterArt(card)}" alt="${a(card.display_name)}" loading="lazy"></div><strong>${e(card.display_name)}</strong><small>${TYPES[card.type]}${card.type === "unit" ? `<br>⚔ ${card.atk} · ◇ ${card.max_def}` : ""}</small>${count !== null ? `<span class="copy-count">${count}/2</span>` : ""}`;
}
function unitTile(unit, friendly, selected) {
  if (!unit)
    return '<div class="empty-slot" aria-label="Ô Vị Linh trống">✧</div>';
  return `<button class="tcg-unit element-${unit.element} ${friendly ? "friendly" : ""} ${selected ? "selected" : ""}" ${friendly ? `data-attacker="${a(unit.instance_id)}"` : ""} aria-pressed="${Boolean(selected)}"><div class="tcg-unit-avatar"><img src="${characterArt(unit)}" alt=""></div><b>${e(unit.display_name)}</b><span>⚔ ${unit.atk} · ◇ ${unit.current_def}</span><small>${unit.role === "guardian" ? "🛡 Hộ Vệ · " : ""}${unit.ready ? "Sẵn sàng" : "Nghỉ"}${unit.shield ? " · +" + unit.shield + " khiên" : ""}</small></button>`;
}
function traps(player, hidden) {
  return `<div class="trap-row ${hidden ? "enemy-traps" : "friendly-traps"}">${Array.from({ length: 2 }, (_, index) => (player.traps[index] ? `<div class="trap-card card-back" title="${hidden ? "Bẫy úp đối thủ" : a(player.traps[index].card.display_name)}"><b>味</b><small>${hidden ? "Bẫy úp" : e(player.traps[index].card.display_name)}</small></div>` : '<div class="trap-slot">Bẫy</div>')).join("")}</div>`;
}
export function tcgTemplate(runtime, header) {
  const match = runtime.tcg;
  const user = match.players[0];
  const bot = match.players[1];
  const canPlay =
    !match.result &&
    ["action", "reaction"].includes(match.phase) &&
    match.priority === 0;
  const canAttack =
    !match.result && match.phase === "combat" && match.activePlayer === 0;
  const selected = user.hand.find(
    (card) => card.instance_id === runtime.selectedCard,
  );
  const phase = match.result
    ? match.winner === 0
      ? "Chiến thắng"
      : match.winner === null
        ? "Hòa trận"
        : "Thất bại"
    : PHASES[match.phase];
  const options = `<option value="commander">Thủ lĩnh / toàn đội</option><optgroup label="Đối thủ">${bot.units.map((unit) => `<option value="${a(unit.instance_id)}">${e(unit.display_name)} · ${unit.current_def} DEF</option>`).join("")}</optgroup><optgroup label="Đồng minh">${user.units.map((unit) => `<option value="${a(unit.instance_id)}">${e(unit.display_name)}</option>`).join("")}</optgroup><optgroup label="Stack">${match.stack.map((item) => `<option value="${item.id}">#${item.id} · ${e(item.card.display_name)}</option>`).join("")}</optgroup>`;
  return `${header("Đấu thẻ Vị Linh · 36 lá", "Học viện Hương Vị", "Triệu hồi, đặt bẫy và kết hợp nguyên tố để đánh bại thủ lĩnh đối phương.")}
  <div class="game-layout tactical-layout"><section class="panel tcg-board"><div class="duel-top"><div><div class="eyebrow">Đối thủ · Người giữ vị</div><strong>Thủ lĩnh Học Viện</strong><small>${bot.deck.length} trong bộ · ${bot.hand.length} trên tay · ${bot.graveyard.length} ở mộ</small></div><div class="commander-hp">${bot.hp}<small> / 8000 HP</small></div></div>
  ${traps(bot, true)}<div class="unit-row enemy-row">${Array.from(
    { length: 5 },
    (_, lane) =>
      unitTile(
        bot.units.find((unit) => unit.lane === lane),
        false,
        false,
      ),
  ).join("")}</div>
  <div class="stack-strip"><span>Vòng ${match.round} · ${phase}</span><b>${match.priority === 0 ? "Ưu tiên: bạn" : "Đối thủ đang suy nghĩ…"}</b><span>${match.activePlayer === 0 ? "⚔ Bạn" : "⚔ Đối thủ"}</span></div>
  ${
    match.stack.length
      ? `<div class="reaction-stack">${[...match.stack]
          .reverse()
          .map(
            (item) => `<span>#${item.id} ${e(item.card.display_name)} →</span>`,
          )
          .join(
            "",
          )}<small>Giải quyết từ trái sang phải sau hai lần bỏ ưu tiên</small></div>`
      : ""
  }
  <div class="unit-row friendly-row">${Array.from({ length: 5 }, (_, lane) =>
    unitTile(
      user.units.find((unit) => unit.lane === lane),
      true,
      runtime.selectedAttackers?.includes(
        user.units.find((unit) => unit.lane === lane)?.instance_id,
      ),
    ),
  ).join("")}</div>${traps(user, false)}
  <div class="duel-bottom"><div><div class="eyebrow">Bạn · Người Kết Vị</div><strong>${user.mana}/${user.maxMana} mana</strong><small>${user.deck.length} trong bộ · ${user.graveyard.length} ở mộ</small></div><div class="commander-hp">${user.hp}<small> / 8000 HP</small></div></div>
  <div class="combo-strip">Hương Vị Bùng Nổ ${["fire", "water", "wood"].map((element) => `<span class="combo-element ${(match.elementChains?.[0] ?? []).includes(element) ? "active" : ""}">${ELEMENTS[element]}</span>`).join("")}<small>Dùng đủ 3 hệ trong vòng: 900 sát thương</small></div>
  <div class="hand-heading"><strong>Bài trên tay · chạm để xem</strong><span>${user.hand.length}/9</span></div><div class="hand-row">${user.hand.map((card) => `<button class="playing-card element-${card.element} ${user.mana >= card.cost ? "affordable" : ""}" data-card="${a(card.instance_id)}">${cardFace(card)}</button>`).join("") || "<p>Chưa có bài trên tay.</p>"}</div>
  ${runtime.notice ? `<p class="notice" role="status">${e(runtime.notice)}</p>` : ""}
  <div class="action-row tcg-actions"><button class="button" data-tcg-pass ${!canPlay ? "disabled" : ""}>${match.phase === "reaction" ? "Phản ứng: bỏ ưu tiên" : "Bỏ ưu tiên"}</button><label class="target-select">Đích đánh<select id="attack-target"><option value="auto">Tự chọn theo vị trí</option><option value="commander">Thủ lĩnh đối thủ</option>${bot.units.map((unit) => `<option value="${a(unit.instance_id)}">${e(unit.display_name)}</option>`).join("")}</select></label><button class="button light" data-tcg-attack ${!canAttack ? "disabled" : ""}>⚔ ${runtime.selectedAttackers?.length ? "Quân đã chọn" : "Quân sẵn sàng"}</button><button class="button light" data-tcg-skip ${!canAttack ? "disabled" : ""}>Bỏ tấn công</button><button class="button secondary dark-secondary" data-tcg-end ${!["combat", "round_end"].includes(match.phase) || match.activePlayer !== 0 || match.result ? "disabled" : ""}>Kết thúc lượt</button></div>
  ${match.result ? `<div class="result-box ${match.winner === 0 ? "victory" : "defeat"}"><strong>${phase}</strong><p>${match.result === "deck_out" ? "Bộ bài đã hết." : match.result === "surrender" ? "Trận đấu kết thúc do đầu hàng." : "Trận đấu đã kết thúc."}</p><button class="button" data-tcg-new>Trận mới</button></div>` : ""}</section>
  <aside class="side-stack"><section class="panel"><h2>Bộ bài & chiến thuật</h2><button class="button light full" data-page="deck">Xây bộ bài · ${e(runtime.save.activeDeck)}</button>${match.eventSeq === 0 && !match.mulliganUsed?.[0] ? '<button class="button light full" data-mulligan>Đổi toàn bộ bài đầu trận</button>' : ""}<p class="muted-copy">Mỗi bên: 5 ô Vị Linh, 2 bẫy. Hộ Vệ bảo vệ thủ lĩnh. Các quân mới cần nghỉ một lượt.</p><button class="button danger full" data-tcg-surrender ${match.result ? "disabled" : ""}>Đầu hàng</button></section><section class="panel"><h2>Nhật ký trận</h2>${textLog(match.log)}</section></aside></div>
  ${selected ? `<div class="modal-backdrop" data-close-modal><section role="dialog" aria-modal="true" aria-label="${a(selected.display_name)}" class="card-inspect" data-modal-body><button class="modal-close" data-close-modal aria-label="Đóng">×</button><div class="playing-card element-${selected.element}">${cardFace(selected)}</div><h2>${e(selected.display_name)}</h2><p>${e(selected.description ?? selected.effect?.description ?? "Triệu hồi Vị Linh.")}</p><label class="target-select">Mục tiêu<select id="tcg-target">${options}</select></label><button class="button full" data-card-confirm ${!canPlay || user.mana < selected.cost ? "disabled" : ""}>${selected.type === "trap" ? "Úp bẫy" : selected.type === "unit" ? "Triệu hồi" : "Thi triển"} · ${selected.cost} mana</button>${!canPlay ? "<small>Chờ quyền ưu tiên của bạn.</small>" : ""}</section></div>` : ""}`;
}
export function deckTemplate(runtime, header) {
  const cards = runtime.deckDraft?.cards ?? runtime.deck.cards;
  const total = cards.reduce((sum, entry) => sum + entry.count, 0);
  return `${header("Bộ sưu tập · luật TCG độc lập", "Xây bộ bài", "36 lá, tối đa 2 bản sao mỗi lá. Bản thay đổi được dùng từ trận tiếp theo.")}<div class="deck-toolbar"><strong class="phase-pill">${total}/36 lá</strong>${[
    ["balanced", "Cân bằng"],
    ["fire", "Hỏa áp lực"],
    ["water", "Thủy kiểm soát"],
    ["wood", "Mộc hồi phục"],
  ]
    .map(
      ([key, label]) =>
        `<button class="button light" data-deck-preset="${key}">${label}</button>`,
    )
    .join(
      "",
    )}<button class="button" data-deck-save ${total !== 36 ? "disabled" : ""}>Lưu bộ bài</button><button class="button light" data-page="tcg">Trở lại trận</button></div>${runtime.notice ? `<p class="notice">${e(runtime.notice)}</p>` : ""}<section class="deck-grid">${runtime.cards.cards
    .map((card) => {
      const count =
        cards.find((entry) => entry.card_id === card.card_id)?.count ?? 0;
      return `<article class="deck-entry"><div class="playing-card element-${card.element}">${cardFace(card, count)}</div><p>${e(card.description ?? "")}</p><div class="deck-count"><button data-deck-remove="${card.card_id}" aria-label="Bớt ${a(card.display_name)}" ${!count ? "disabled" : ""}>−</button><b>${count}</b><button data-deck-add="${card.card_id}" aria-label="Thêm ${a(card.display_name)}" ${count >= 2 ? "disabled" : ""}>+</button></div></article>`;
    })
    .join("")}</section>`;
}
