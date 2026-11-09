# 06 — CẦN GÌ TIẾP THEO? PRODUCTION ROADMAP / DELIVERY GATES

**Trả lời ngắn:** concept + 5 design sheets chưa đủ để lập trình một game đúng luật. Cần chốt GAME RULES, DATA CONTRACT, ASSET PIPELINE, VERTICAL SLICE, QA và quy trình nội dung. Tiến hành từng gate; không triển khai hàng loạt 12+ Vị Linh khi 1 nhân vật mẫu chưa đạt chất lượng.

## Gate 0 — Khóa thiết kế nền (điều kiện vào production)
| Deliverable | Owner | Đã có? | Định nghĩa hoàn thành |
|---|---|---|---|
| Vision + GDD | Game Director | Có, đề xuất | trải nghiệm/giới hạn mode rõ |
| 5 visual design sheets | Art/UX/Combat/Audio | Có v1+v2 | layout/size/state/ID rõ |
| Character golden reference | Character Art Lead | Chưa | full-art, turnaround, rig và 1 skill đạt nghiệm thu |
| Game Rules v1 (Adventure) | Game Designer | Chưa đủ | damage, skill, status, AI, boss, wave, reward |
| TCG Rules v1 | System Designer | Chưa đủ | turn, priority, block, deck, traps, win condition |
| Auto Chess Rules v1 | System Designer | Chưa đủ | shop odds, income, pool, levels, phases, merge, rankings |
| Data model & IDL | Tech Lead | Một phần | schemas + validator + migrations |
| Tech spike | Tech Lead | Chưa | render 5 rig + map + VFX on target devices |
| Decision log | Producer | Chưa | mọi TBD có owner/quyết định/ngày |

## Gate 1 — Golden Sample (một lát cắt chuẩn chất lượng)
1. Chọn **Bún Bò Hỏa Linh** làm nhân vật mẫu: full art, 4 view, 8 expressions, rig, idle/walk/run/attack/skill/ultimate, voice/SFX/VFX gắn socket.
2. Chọn **Làng Ẩm Thực**: 64×48 tiles, 2 nội thất, Lilia, questboard, 1 chest, 1 cửa rừng, 5 điểm tương tác trong tuyến đầu.
3. Dựng Home + Adventure Explore + Battle HUD + Result + Character Detail ở 390×844/960×540.
4. Combat 1 encounter: melee pathing, ranged projectile, hit confirmation, damage VFX, boss telegraph, ultimate.
5. Telemetry: inspect current action/event, FPS, draw calls/texture memory, missing asset IDs, sound bus.

**Exit gate:** hoàn thành onboarding 1 quest mà không cần debug console; reload giữ rương/quest; đánh boss có animation và va chạm đúng; nhân vật được nhận diện ở 80px.

## Gate 2 — Vertical Slice ba chế độ
- Adventure 5 character + 1 boss + 1 quest chain + team builder + reward.
- TCG 2 sample decks người vs bot: 36 cards (hoặc số đã chốt), 5 unit/2 trap slots, mana, phản ứng, bẫy, thắng/thua, deck builder.
- Auto Chess một trận vs bot: shop 5, buy/sell/reroll, bench, board placement, 3-of-kind merge, synergy, reward, victory.
- Shared identity: cùng Bún Bò/Phở/Bánh Bao ở profile, thẻ, chess, adventure; asset IDs nhất quán, không nhiều model nhân vật khác nhau.
- Audio identity: 1 leitmotif, 1 home loop, 1 adventure battle loop, 1 TCG loop, 1 chess loop, 1 ultimate VO + SFX.

**Exit gate:** 3 mode chơi được từ đầu đến kết thúc, reward/save đáng tin cậy, QA pass trên thiết bị đích.

## Gate 3 — Content Alpha
- mở rộng vùng rừng, biển, núi lửa; NPC, boss, quest và collectibles.
- thêm character/balance sau khi pipeline chuẩn hóa; tăng story, gacha, progression/skins/social.
- TCG bot chiến lược hơn, Auto Chess nhiều synergy, tutorial sâu hơn; voice và nhạc mới.

## Gate 4 — Beta / Release readiness
- stress test, memory/power optimization, gameplay telemetry, save corruption/reconnect, accessibility, localization.
- cân bằng PvP, anti-cheat/server authoritative nếu có online; kiểm thử account/reset; patch update/rollback.
- legal provenance, copyright/trademark/licensing cho asset/nhạc/voice, privacy/terms phù hợp nơi phát hành.

## Critical path (phụ thuộc)
```text
Design decisions
   ↓
Game rules + schema IDs  ────────→ content validator
   ↓                              ↓
Character art bible → rig/anim → golden combat prototype
Environment rules → map exporter → playable village
UI interaction → client routes/UX → connect game state
Audio/VFX ids → event bridge → animation + impact polish
   ↓
P0 onboarding + playable game loop → three-mode vertical slice → QA → content scale
```

## 10 bước triển khai ngay (theo ưu tiên)
1. Chốt engine/render: Web/PWA ưu tiên hay Unity export, test memory/fps trên thiết bị yếu.
2. Khóa `Game Rules v1`: hoàn thành các câu hỏi đỏ trong tài liệu 07, đặc biệt combat authority, TCG turn/priority, Auto Chess economy.
3. Chốt character master Bún Bò (không bắt đầu toàn bộ roster).
4. Thiết lập asset manager: runtime IDs, registry, validator, fallback policy, license gate.
5. Dựng vertical map scene có interactive prefab + save trạng thái.
6. Triển khai action/event bus, rule simulation, animation bridges và log/replay.
7. Làm một complete Adventure fight, skill projectile và boss telegraph trước khi làm VFX phức tạp.
8. Dựng TCG prototype text-first (không art) để kiểm luật bẫy/priority, sau đó gắn UI & VFX.
9. Dựng Auto Chess prototype text/board-first để xác minh shop/pool/economy, sau đó gắn rig.
10. Chạy QA checklist/metrics, sửa vấn đề gameplay và performance, mới cho phép nhân rộng content.

## Danh sách vai trò và output tối thiểu
| Vai trò | Output đầu tiên |
|---|---|
| Game Director / Designer | Rulebook v1, balance sheet, gameplay loop |
| Art Director | visual bible phê duyệt, 5 silhouette, golden character |
| Character Artist / Animator | source layered, rigs, motions, card/cutin |
| Environment Artist / Level Designer | tileset, props, map layout, collision/nav |
| UI/UX | interaction prototype 16 screens + design tokens |
| Gameplay Engineer | mode simulations, event sequence, save/replay |
| Technical Artist/VFX | socket rules, trails/projectiles, shader/LOD |
| Composer/Sound Designer | audio motif, bus, cue sheets, masters |
| QA | acceptance matrix, regression, device benchmark |
| Producer | task status/dependency/decisions & IP provenance |

## Rủi ro và hành động phòng ngừa
| Risk | Dấu hiệu | Phòng ngừa |
|---|---|---|
| scope ba game quá lớn | 3 mode đều chưa playable | ưu tiên golden sample + từng slice |
| art inconsistency | cùng nhân vật mỗi mode khác mặt/tóc | character ID, master sheet, rig reuse |
| VFX che combat | không đọc được target/telegraph | priority layers + LOD + visual QA |
| luật mơ hồ | dev chọn HP/damage theo cảm giác | approve Game Rules + fixtures |
| web performance | memory spike / jank | texture budgets, chunks, profiler sớm |
| save exploit | rương/merge/reward nhân đôi | transaction IDs + idempotent claims |
| PvP gian lận | browser quyết kết quả | authoritative rules + replay checksum |
| asset licensing | nguồn không rõ/na ná game tham khảo | provenance ledger và review |

## Gate QA tiêu biểu
- **Functional:** every task happy path, invalid input, error/retry, reconnect & double tap.
- **Visual:** safe area, silhouette, sprite clipping, layer sorting, camera, low graphics.
- **Performance:** FPS, GPU texture MB, draw calls, JS long tasks/audio voices ở thiết bị tối thiểu.
- **Content:** ID/schema references valid, no untranslated strings, license approved.
- **Game balance:** reproduce deterministic seed, win condition, bot behavior, reward state.

**Lưu ý:** Không có mốc thời gian hay chi phí cố định ở đây vì chưa chốt engine, số nhân sự, phạm vi launch, nền tảng chính và chất lượng asset thực tế. Sau Gate 0 mới ước lượng bằng công việc theo backlog có độ phức tạp đã đo.
