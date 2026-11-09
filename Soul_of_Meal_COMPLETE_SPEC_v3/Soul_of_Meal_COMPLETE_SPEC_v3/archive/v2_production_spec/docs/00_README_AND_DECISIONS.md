# SOUL OF MEAL — PRODUCTION SPECIFICATION v2.0

**Trạng thái:** đề xuất tiền sản xuất (pre-production), chưa phải mã nguồn/game hoàn thành.  
**Nguồn sáng tạo:** 5 ảnh giới thiệu Soul of Meal do người dùng cung cấp + cuộc trao đổi thiết kế hiện tại; không suy ra quyết định từ dự án cũ.  
**Mục đích:** art director, game designer, UI/UX, engineer, sound designer, QA có thể giao việc và nghiệm thu nhất quán.  
**Tài liệu nền:** thư mục `design_pack_v1/` (concept PNG, blueprint SVG, manifest 127 assets, event schema và screen matrix).  
**Tài liệu chi tiết mới:** 5 chuyên ngành `docs/01…05`, roadmap `06`, gameplay rule gaps `07`, tracking và các ví dụ JSON.

## 0. Thứ tự ưu tiên khi tài liệu mâu thuẫn
1. Những quyết định đã được chủ dự án phê duyệt và ghi trong Decision Log (hiện chưa có).
2. `docs/07_GAME_RULES_AND_OPEN_DECISIONS.md` sau khi chốt luật.
3. `docs/01…05` phiên bản 2.0 cho chi tiết triển khai (đề xuất đang chờ phê duyệt).
4. `design_pack_v1/**/*.md`, `schemas/*.json` của v1 cho ID/tên đã có.
5. Blueprint SVG để đo cấu trúc, concept PNG chỉ thể hiện thẩm mỹ; **không lấy chữ nhỏ hoặc thông số trong ảnh làm luật**.

## 1. Phạm vi sản phẩm
- Thế giới ẩm thực anime, một dàn Vị Linh dùng chung qua Adventure / TCG / Auto Chess.
- Adventure: khám phá bản đồ, NPC, quest, đội 1 nhân vật chính + 4 Vị Linh, auto attack, điều khiển ultimate.
- TCG: 36 thẻ/deck (đề xuất), 5 ô quân / 2 ô bẫy, mana 1–10 và chủ soái HP 8.000 (tạm thời).
- Auto Chess: 5 quân cửa hàng, 3 quân đồng cấp hợp 1 cấp cao, synergy và kinh tế vòng (các thông số còn mở).
- Asset dùng chung **nhận diện** và rig khi phù hợp; rules/stat scale của từng mode độc lập. Không cố cưỡng ép Adventure HP vào TCG.
- Đồ họa: anime hand-painted + chibi 2.5D; nhạc fantasy orchestral kết hợp âm sắc Việt; không sử dụng asset/nhạc độc quyền từ game tham khảo.

## 2. Hệ quy chiếu thống nhất
| Thuộc tính | Quy ước tạm chốt cho prototype | Cần kiểm tra |
|---|---|---|
| Portrait logical UI | 390×844 dp | notch, device scale, chữ dài |
| Landscape logical UI | 960×540 dp | 16:9 đến 20:9, tablet |
| Safe area | 16dp portrait, 20dp landscape + OS inset | thao tác cảm ứng 44dp |
| Map tile | 64×64 world units | đọc rõ ở 12–18 tile ngang |
| Làng P0 | 64×48 tiles, chunks 16×16 | di chuyển/pathfinding và memory |
| Render target | 60 FPS tùy máy, preset 30 FPS | đo browser/device thật |
| Animation unit | 60 FPS tham chiếu storyboard | gameplay fixed tick độc lập |
| ID | `snake_case` ASCII, ổn định | check validator trước build |
| Runtime art | WebP/PNG/SVG/atlas; source PSD/KRA/SVG | kiểm tra licensing/alpha/bleed |
| Audio source | WAV 48kHz/24-bit; runtime OGG/Opus + fallback | kiểm tra trình duyệt đích |

**Quan trọng:** “world units”, “dp”, “pixel nguồn”, “giây timeline” là các đại lượng khác nhau. File raster 2048px không có nghĩa nó được render ở 2048 world units.

## 3. Bản giao việc tiêu chuẩn
Mỗi ticket phải ghi: `(feature_id, mode, owner, dependencies, visual_ref, asset_ids, state_events, acceptance, test_device, license, performance_budget)`; mọi thiếu hụt bắt buộc đánh dấu `TBD`, không cho phép developer tự đoán khi làm gameplay cốt lõi.

## 4. Cây thư mục khi vào dự án thật
```text
/soul-of-meal/
  docs/design/{character,environment,ui,combat,audio}/
  docs/rules/  docs/decisions/  docs/qa/
  content/characters/*.json  content/maps/*.json  content/cards/*.json
  content/abilities/*.json   content/synergies/*.json
  assets/characters/  assets/environments/  assets/ui/
  assets/vfx/  assets/audio/
  packages/game-rules/ packages/game-client/ packages/content-validation/
  apps/web/  tests/unit/  tests/integration/  tests/e2e/
```
Tên package chỉ minh họa, không khóa engine hay framework. Đầu vào bắt buộc của build: asset registry hợp lệ + content rules hợp lệ + license status approved.

## 5. Mốc nghiệm thu P0
- Người chơi vào làng → gặp Lilia → nhận nhiệm vụ → mở rương → vào rừng → chiến đấu → dùng ultimate → nhận thưởng → trở lại làng, reload không mất tiến trình.
- 5 Vị Linh có nhận diện thống nhất và bộ animation cơ bản; tối thiểu một character có art/rig/VFX/SFX đạt chuẩn vàng (golden sample).
- TCG có một ván hoàn chỉnh người vs bot, bao gồm phản ứng và bẫy; Auto Chess có một trận hoàn chỉnh vs bot với buy/merge/position/resolve.
- UI ở cả mobile portrait và landscape không bị che nút, không cần cuộn web page để đánh trận.
- Telemetry hiển thị lỗi thiếu asset/event; QA đo FPS, peak texture memory, audio clipping, reward idempotency.

## 6. Công việc chưa thể suy ra chỉ từ tranh
- Số nhân vật launch, cơ chế mở khóa nhân vật, giá trị thật của chỉ số, chiến thuật PvP, economy và drop rate.
- Hệ đồ họa runtime (rig Spine vs sprite sheet vs hybrid), game engine, chế độ server authoritative hay local only.
- Khối lượng voice/music, bản quyền sáng tác, dịch thuật, quy tắc dữ liệu người chơi.
- Chính sách monetization/PvP công bằng, trận TCG timeout, auto chess matchmaking và save/cloud.

Các mục này được tách thành **Decision Register**; không được âm thầm coi là đã duyệt. Xem `docs/07_GAME_RULES_AND_OPEN_DECISIONS.md`.
