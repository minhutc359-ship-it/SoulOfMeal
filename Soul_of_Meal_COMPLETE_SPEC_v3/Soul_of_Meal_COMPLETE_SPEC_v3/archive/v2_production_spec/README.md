# Soul of Meal — Production Specification v2.0

**Phiên bản:** 2.0 — ngày 2026-11-09. **Trạng thái:** design proposal, chưa thực thi/benchmark.  
Bộ này được lập từ 5 ảnh do người dùng gửi và bản thảo Soul of Meal đã trao đổi; không sử dụng các dự án/tài liệu cũ làm yêu cầu.

## Nên mở theo thứ tự
1. `docs/00_README_AND_DECISIONS.md` — scope, source of truth, units, technical baselines.
2. `docs/01_CHARACTER_PRODUCTION_SPEC.md` — Character Sheet, rig, biểu cảm, 5 Vị Linh, animation state, art handoff.
3. `docs/02_ENVIRONMENT_PRODUCTION_SPEC.md` — map 64×48, 4×3 chunks, building/NPC/interactions, quest state.
4. `docs/03_UI_UX_PRODUCTION_SPEC.md` — 16 screens, responsiveness, layout dimensions, errors, events.
5. `docs/04_COMBAT_PRODUCTION_SPEC.md` — realtime battle, frame timelines, target/hit, TCG rules, Chess phases, replay.
6. `docs/05_VFX_SFX_AUDIO_PRODUCTION_SPEC.md` — elemental palettes, FX registry, event sync, mixer buses, budgets.
7. `docs/06_PRODUCTION_ROADMAP_AND_NEXT_STEPS.md` — những gate cần làm và Definition of Done.
8. `docs/07_GAME_RULES_AND_OPEN_DECISIONS.md` — luật còn thiếu, quyết định phải duyệt trước coding.

## File triển khai
- `tracking/BACKLOG.csv`: backlog giao việc theo vai trò + phụ thuộc.
- `tracking/QA_ACCEPTANCE_MATRIX.csv`: bộ test cases để QA có thể sử dụng.
- `tracking/DECISION_REGISTER.csv`: registry các quyết định chưa khóa.
- `examples/*.json`: ví dụ contract về nhân vật, map/interaction, event combat, UI screen, VFX và SFX.
- `design_pack_v1/`: giữ nguyên bộ concept PNG, SVG, five prior MD, `schemas/assets.manifest.json`, `schemas/events.schema.json`, `schemas/screen_states.csv` và các script có sẵn.

## Chú ý
- Art PNG là *concept*, có thể có chữ/số không chuẩn; document Markdown/JSON/CSV là nguồn tham khảo thông số.
- `example/*.json` là mẫu đề xuất, **chưa là JSON Schema đã triển khai**.
- `docs/07` đánh dấu `TBD`: không coi là quyết định đã duyệt; cần lập Rulebook riêng trước khi implement core.
- Các cấu hình v1/v2 cần một lần approval; không được dùng số trong screenshot làm balance final.
- Tài liệu có ghi license provenance bắt buộc; nội dung tạo ra cần được rà soát quyền sử dụng trước phát hành.
