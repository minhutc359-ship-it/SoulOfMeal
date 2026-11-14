import { escapeHtml as e, escapeAttr as a, textLog } from "./html.js";
import { CHESS_ITEMS, CHESS_RULES } from "../core/rules.js";
import { chessSynergies, chessRoundType } from "../modes/autoChess.js";
import { ELEMENTS, ROLES } from "../core/characters.js";
const AVATAR = (unit) =>
  `./assets/avatars/avatar_${unit.id.replace("chr_", "")}.png`;
function figure(unit) {
  return `<img class="chess-avatar" src="${AVATAR(unit)}" alt="${a(unit.display_name)}"><span class="star-badge">${"★".repeat(unit.star ?? 1)}</span>`;
}
export function chessTemplate(runtime, header) {
  const run = runtime.chess;
  const playing = Boolean(runtime.chessPlayback?.playing);
  const preparing = run.phase === "prepare";
  const type = chessRoundType(run.round);
  const phase = playing
    ? "Giao tranh"
    : preparing
      ? "Chuẩn bị"
      : run.phase === "finished"
        ? "Kết thúc"
        : "Kết quả";
  const players = [
    { id: 0, name: "Bạn", hp: run.hp, level: run.level, gold: run.gold },
    ...run.opponents,
  ].sort((a, b) => b.hp - a.hp || a.id - b.id);
  const scout = run.opponents.find((bot) => bot.id === runtime.scoutId);
  return `${header("Đấu trường Vị Linh · Bạn + 7 bot", "Đấu trường Bếp Hoàng Gia", "Mua, xếp đội hình, ghép sao và tích vàng. Người sống sót cuối cùng đạt TOP 1.")}
 <div class="panel-tabs">${[
   ["standings", "Xếp hạng"],
   ["synergy", "Cộng hưởng"],
   ["items", "Trang bị"],
   ["log", "Nhật ký"],
 ]
   .map(
     ([key, label]) =>
       `<button class="button light compact" data-chess-panel="${key}">${label}</button>`,
   )
   .join(
     "",
   )}</div><div class="chess-topbar"><div class="resource">Vòng <b>${run.round}</b> · ${{ neutral: "Quái", elite: "Tinh Anh", pvp: "Đối thủ" }[type]}</div><div class="resource">♥ <b>${run.hp}</b></div><div class="resource">Cấp <b>${run.level}</b> · XP ${run.experience}/${CHESS_RULES.xpToNext[run.level] ?? "MAX"}</div><div class="resource">◈ <b>${run.gold}</b> · Lãi +${Math.min(5, Math.floor(run.gold / 10))}</div></div>
 <div class="game-layout chess-layout"><section class="panel chess-main"><div class="panel-heading"><div><h2>${phase} · ${preparing ? `${run.board.length}/${run.level} quân` : e(run.combat?.opponentName ?? "Đấu trường")}</h2><p>${preparing ? "Kéo thả hoặc chọn quân rồi chạm ô. Thả vào ô có quân để đổi chỗ." : playing ? "Các Vị Linh tự di chuyển, chọn mục tiêu và thi triển kỹ năng." : "Đội hình và kinh tế được giữ cho vòng sau."}</p></div><label class="arena-select">Sân<select data-arena><option value="royal" ${run.arena === "royal" ? "selected" : ""}>Bếp Hoàng Gia</option><option value="night" ${run.arena === "night" ? "selected" : ""}>Chợ Đêm</option><option value="forest" ${run.arena === "forest" ? "selected" : ""}>Rừng Gia Vị</option><option value="sea" ${run.arena === "sea" ? "selected" : ""}>Hải Vực</option><option value="volcano" ${run.arena === "volcano" ? "selected" : ""}>Núi Lửa</option></select></label></div>
 <div class="chess-stage arena-${run.arena ?? "royal"}">${
   preparing
     ? `<div class="chess-grid" role="group" aria-label="Nửa bàn hex 7 cột, 4 hàng">${Array.from(
         { length: 28 },
         (_, index) => {
           const x = index % 7,
             y = 3 - Math.floor(index / 7);
           const unitIndex = run.board.findIndex(
             (unit) => unit.x === x && unit.y === y,
           );
           const unit = run.board[unitIndex];
           return `<button class="chess-cell hex-cell ${unit ? "occupied" : ""} ${runtime.selectedBoard === unitIndex && unit ? "selected" : ""} ${runtime.selectedBench !== null ? "place-target" : ""}" data-cell="${x},${y}" style="--hex-row:${3 - y}" aria-label="Ô ${x + 1}, ${y + 1}${unit ? ", " + a(unit.display_name) : ""}">${unit ? figure(unit) : "<span>✧</span>"}</button>`;
         },
       ).join("")}</div>`
     : `<canvas id="chess-canvas" width="960" height="540" aria-label="Giao tranh Vị Linh · ô bàn cờ ẩn trong chiến đấu"></canvas>`
 }</div>
 <div class="bench-heading"><strong>Băng ghế · ${run.bench.length}/9</strong><button class="button light compact" data-chess-bench ${!preparing || runtime.selectedBoard === null ? "disabled" : ""}>Đưa quân đã chọn về ghế</button></div><div class="bench-row" data-bench-drop>${Array.from(
   { length: 9 },
   (_, index) => {
     const unit = run.bench[index];
     return unit
       ? `<button class="bench-unit ${runtime.selectedBench === index ? "selected" : ""}" data-bench="${index}" ${!preparing ? "disabled" : ""}>${figure(unit)}<small>${e(unit.display_name)}</small></button>`
       : '<div class="bench-empty" aria-label="Ghế trống">·</div>';
   },
 ).join("")}</div>
 <div class="shop-heading"><strong>Cửa hàng ${run.shopLocked ? "🔒" : ""}</strong><span>5 quân · 1–5 vàng</span></div><div class="shop-row">${run.shop.map((unit, index) => (unit ? `<button class="shop-unit tier-${unit.cost}" data-buy="${index}" ${!preparing || run.gold < unit.cost ? "disabled" : ""}><img src="${AVATAR(unit)}" alt=""><strong>${e(unit.display_name)}</strong><small>${ELEMENTS[unit.element]} · ${ROLES[unit.job]}</small><span>◈ ${unit.cost}</span></button>` : '<div class="shop-unit shop-empty">Đã mua</div>')).join("")}</div>
 <div class="action-row"><button class="button light" data-chess-refresh ${!preparing || run.gold < 2 || run.shopLocked ? "disabled" : ""}>Làm mới · 2 ◈</button><button class="button light" data-chess-lock ${!preparing ? "disabled" : ""}>${run.shopLocked ? "Mở khóa" : "Khóa shop"}</button><button class="button light" data-chess-xp ${!preparing || run.gold < 4 || run.level >= 9 ? "disabled" : ""}>+4 XP · 4 ◈</button><button class="button danger" data-chess-sell ${!preparing || (runtime.selectedBench === null && runtime.selectedBoard === null) ? "disabled" : ""}>Bán quân</button><button class="button" data-chess-fight ${!preparing ? "disabled" : ""}>Khóa đội hình & chiến đấu</button></div>
 ${playing ? '<p class="playback-label">Giao tranh đang diễn ra… <button class="button light compact" data-chess-skip>Hiện kết quả</button></p>' : ""}${runtime.notice ? `<p class="notice" role="status">${e(runtime.notice)}</p>` : ""}
 ${run.phase === "finished" ? `<div class="result-box ${run.placement === 1 ? "victory" : "defeat"}"><strong>TOP ${run.placement ?? (run.result === "victory" ? 1 : "—")}</strong><p>${run.wins} thắng · ${run.losses} thua · ${run.round} vòng</p><button class="button" data-chess-new>Giải đấu mới</button></div>` : run.result && !playing ? `<div class="result-box ${run.result.won ? "victory" : "defeat"}"><strong>${run.result.won ? "Chiến thắng" : run.result.draw ? "Hòa" : "Thất bại"}</strong><p>−${run.result.damage} HP · +${run.result.income} vàng (lãi ${run.result.interest}, chuỗi ${run.result.streakIncome}) ${run.result.item ? "· Nhận " + e(CHESS_ITEMS[run.result.item].name) : ""}</p><button class="button" data-chess-next>${run.hp <= 0 || run.opponents.every((bot) => bot.hp <= 0) ? "Xem thứ hạng" : "Vòng tiếp theo"}</button></div>` : ""}
 </section><aside class="side-stack"><section class="panel standings"><h2>8 Người Kết Vị</h2>${players.map((player, index) => `<button class="standing-row ${player.hp <= 0 ? "eliminated" : ""} ${player.id === 0 ? "is-you" : ""}" data-scout="${player.id}"><b>${index + 1}</b><span>${e(player.name)}<small>Cấp ${player.level} · ${player.gold} vàng</small></span><strong>♥ ${player.hp}</strong></button>`).join("")}${scout ? `<div class="scout-board"><h3>${e(scout.name)}</h3><p>${e(scout.strategy)} · ${scout.board.length}/${scout.level} quân</p>${scout.board.map((unit) => `<span>${e(unit.display_name)} ${"★".repeat(unit.star)}</span>`).join("")}</div>` : ""}</section><section class="panel"><h2>Cộng hưởng</h2><div class="synergy-list">${
   chessSynergies(run.board)
     .filter((trait) => trait.count)
     .map(
       (trait) =>
         `<div class="synergy-row ${trait.tier ? "trait-active" : ""}"><span>${trait.label}<small>${e(trait.description)}</small></span><strong>${trait.count}/${trait.thresholds.find((n) => n > trait.count) ?? trait.thresholds.at(-1)} ${trait.tier ? "✦" : ""}</strong></div>`,
     )
     .join("") ||
   '<p class="muted-copy">Đặt Vị Linh lên bàn để xây cộng hưởng.</p>'
 }</div></section><section class="panel"><h2>Trang bị · chọn quân để gắn</h2>${run.inventory.map((item, index) => `<button class="button light full" data-equip="${index}" ${!preparing || (runtime.selectedBench === null && runtime.selectedBoard === null) ? "disabled" : ""}>${e(CHESS_ITEMS[item]?.name ?? item)}</button>`).join("") || '<p class="muted-copy">Thắng vòng quái/tinh anh để nhận trang bị.</p>'}</section><section class="panel"><h2>Nhật ký</h2>${textLog(run.log)}</section><button class="button danger" data-chess-surrender ${run.phase === "finished" ? "disabled" : ""}>Rời giải đấu</button></aside></div>`;
}
