# Soul of Meal — Production Design Pack v1.0

**Nguồn định hướng:** 5 ảnh hướng dẫn Soul of Meal do người dùng cung cấp và bản GDD thống nhất đã chốt trong cuộc trò chuyện. Không lấy các dự án/tài liệu cũ làm yêu cầu.

**Trạng thái:** tài liệu thiết kế đề xuất để tiền sản xuất; các thông số là *design targets*, chưa được kiểm chứng bằng build hoặc profiler. Các concept image là tài liệu minh họa, **không phải texture/sprite/UI-ready assets**. Chuỗi ký tự trong ảnh minh họa có thể thiếu chính xác; thông số/nhãn/ID trong các file `.md`, `.json`, `.csv` ở pack này mới là nguồn chuẩn để lập trình.

## Các bản thiết kế trực quan

Mỗi chuyên mục có **một concept plate PNG 2400×1580** để xem nhanh và **một bản blueprint SVG 1600×1000** với text/shape/vector có thể chỉnh sửa:

- `01_character_sheet/CHARACTER_CONCEPT_PLATE.png` + `CHARACTER_BLUEPRINT.svg`
- `02_environment_sheet/ENVIRONMENT_CONCEPT_PLATE.png` + `ENVIRONMENT_BLUEPRINT.svg`
- `03_ui_wireframe/UI_CONCEPT_PLATE.png` + `UI_BLUEPRINT.svg`
- `04_combat_storyboard/COMBAT_CONCEPT_PLATE.png` + `COMBAT_BLUEPRINT.svg`
- `05_vfx_sfx_style_guide/VFX_SFX_CONCEPT_PLATE.png` + `VFX_SFX_BLUEPRINT.svg`

**Quan trọng:** phần art trong concept plates được cắt từ các bản minh họa concept, có thể xuất hiện chữ/giá trị chưa chuẩn. **Chỉ dùng text/ID/size từ Markdown, SVG blueprint, JSON, CSV trong gói làm source of truth.** PNG không phải asset xuất game.

## Thư mục

| File | Phạm vi |
|---|---|
| `01_character_sheet/CHARACTER_SHEET.md` | 5 Vị Linh khởi đầu, tỷ lệ, hướng nhìn, biểu cảm, animation state/event, quy tắc rig, naming, nghiệm thu |
| `02_environment_sheet/ENVIRONMENT_SHEET.md` | World, map Làng Ẩm Thực, tile/chunk, công trình, NPC, tương tác, collision/trigger, trạng thái cảnh |
| `03_ui_wireframe/UI_WIREFRAME.md` | Layout portrait/landscape, 16 màn hình, trạng thái, token thiết kế, hành vi tương tác, A11y |
| `04_combat_storyboard/COMBAT_STORYBOARD.md` | Storyboard theo frame cho đòn thường/skill/ultimate, combat event, TCG, Auto Chess, camera và damage sync |
| `05_vfx_sfx_style_guide/VFX_SFX_STYLE_GUIDE.md` | Element style guide, effect construction, scale/budget, mix bus, audio event, naming, QA |
| `schemas/assets.manifest.json` | Registry asset ID, paths, kích thước/định dạng/owner, variant và mức bắt buộc |
| `schemas/events.schema.json` | Hợp đồng event hoạt ảnh/chiến đấu/âm thanh/interaction |
| `schemas/screen_states.csv` | Ma trận màn hình/trạng thái/điều kiện nghiệm thu |

## Bộ nhận diện chuẩn

- **Tinh thần:** Anime fantasy ẩm thực Việt, ấm áp, vui nhộn, phép thuật theo nguyên tố.
- **Thể hiện:** nền hand-painted 2.5D; nhân vật chibi được rig; cut-in minh họa anime HD; UI parchment/wood/gold hiện đại hóa để dễ đọc.
- **Hệ:** `fire`, `water`, `wood`, `light`, `shadow`.
- **Độ phân giải bố cục:** portrait **390 × 844 dp**, landscape **960 × 540 dp**. `dp` = đơn vị thiết kế logic, **không phải số pixel của file xuất**.
- **Tỉ lệ xuất UI raster:** 2×, 3× nếu cần; ưu tiên icon SVG; text render bằng font runtime, không nhúng vào background image.
- **Art base:** map 1 tile = **64 × 64 world units** (tương đương px ở zoom 1× tham chiếu); scene viewport co giãn theo màn hình.
- **Mục tiêu:** 60 FPS ở máy đủ khả năng, 30 FPS tùy chọn; engine có thể PixiJS/Unity/khác, nhưng phải giữ asset IDs và event contract.

## Quy tắc tên (source of truth)

- ID: chữ thường ASCII, `snake_case`, ví dụ `chr_bunbo_holinh`, `env_village_square`, `ui_home_hero`, `vfx_fire_slash_a`, `sfx_ui_confirm`.
- Đường dẫn: `assets/{domain}/{asset_id}/{variant}.{ext}`. Không chứa dấu cách/ký tự tiếng Việt, không dùng `final`, `final2`.
- Bản chỉnh sửa: `v001`, `v002` trong quản lý nguồn; **ID runtime ổn định**. Cache busting dùng content hash ở build, không đổi ID.
- Mọi asset phải có owner, trạng thái (`draft`, `review`, `approved`), licensing note và kiểm tra tính nhất quán với Character/Environment Sheet.

## Mức ưu tiên sản xuất

1. `P0`: một scene làng + bản đồ khám phá + 5 vị linh + 1 boss + giao diện home/đội hình/combat.
2. `P1`: một bộ bài TCG playable và trận Auto Chess với bot, shared assets và full battle event.
3. `P2`: mở rộng thế giới, trang phục, thân thiết, nội dung lồng tiếng và VFX cao cấp.

## Definition of Done tổng

- Asset có ID trong manifest, có source gốc và variant runtime; không còn hình placeholder đi vào bản release.
- Màn hình có trạng thái loading/empty/error/disabled và thao tác Back hợp lý.
- Animation, VFX, SFX đồng bộ bằng sự kiện chứ không dùng timeout UI tự đoán.
- Mọi camera transition, overlay và hiệu ứng có tùy chọn giảm chuyển động; không làm mất khả năng đọc UI.
- Không sử dụng asset, logo, âm thanh hoặc thiết kế độc quyền của các game tham khảo.
