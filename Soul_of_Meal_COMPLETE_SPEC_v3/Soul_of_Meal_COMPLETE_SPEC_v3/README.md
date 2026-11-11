# Soul of Meal — COMPLETE GAME & ART PRODUCTION SPEC v3.0
**Ngày:** 2026-11-09 · **Trạng thái:** pre-production specification / playable prototype baseline (proposed) · **Ngôn ngữ:** Việt / English technical IDs.

Đây là **gói duy nhất** chứa nguồn hình do người dùng gửi, 5 concept sheet tách riêng, **35 crop ảnh theo từng mục**, toàn bộ gói thiết kế v1 + v2, rulebook của 3 chế độ, kiến trúc dữ liệu, và AI Sprite Agent Skill có script xây atlas/kiểm tra.

## Mở theo thứ tự
1. [`docs/00_foundation/PROJECT_BIBLE.md`](docs/00_foundation/PROJECT_BIBLE.md): triết lý game, scope, quy tắc giữ nhận diện, nguồn chân lý.
2. [`docs/00_foundation/DECISION_REGISTER.md`](docs/00_foundation/DECISION_REGISTER.md): các giá trị prototype (PROPOSED) và những quyết định phải duyệt.
3. [`docs/01_gameplay/ADVENTURE_RULEBOOK.md`](docs/01_gameplay/ADVENTURE_RULEBOOK.md), [`TCG_RULEBOOK.md`](docs/01_gameplay/TCG_RULEBOOK.md), [`AUTO_CHESS_RULEBOOK.md`](docs/01_gameplay/AUTO_CHESS_RULEBOOK.md).
4. [`docs/02_art/SPRITE_PIPELINE.md`](docs/02_art/SPRITE_PIPELINE.md): kích thước, animation, crop, schema, sprite pipeline.
5. [`docs/02_art/ANIMATION_INTEGRATION_SPEC.md`](docs/02_art/ANIMATION_INTEGRATION_SPEC.md): agent handoff để nối animation đã duyệt vào browser runtime.
6. [`docs/02_art/VISUAL_REFERENCE_INDEX.md`](docs/02_art/VISUAL_REFERENCE_INDEX.md): link từng tấm hình nhỏ, không cần nhìn poster chữ li ti.
7. [`docs/03_engineering/ENGINE_ARCHITECTURE.md`](docs/03_engineering/ENGINE_ARCHITECTURE.md): kiến trúc đích và trạng thái triển khai hiện tại.
8. [`docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md`](docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md): API, state contract, lệnh test và giới hạn của rules prototype đã chạy.
9. [`docs/03_engineering/TCG_RULES_REFERENCE.md`](docs/03_engineering/TCG_RULES_REFERENCE.md): API, state contract và giới hạn của phần TCG setup/draw.
10. [`docs/03_engineering/ADVENTURE_RULES_REFERENCE.md`](docs/03_engineering/ADVENTURE_RULES_REFERENCE.md): API, combat event contract, test fixture và giới hạn Adventure rules prototype.
11. [`docs/04_qa/ACCEPTANCE_TEST_PLAN.md`](docs/04_qa/ACCEPTANCE_TEST_PLAN.md) và [`docs/05_production/PRODUCTION_PLAN.md`](docs/05_production/PRODUCTION_PLAN.md).
12. [`.agents/skills/soul-of-meal-sprite/SKILL.md`](.agents/skills/soul-of-meal-sprite/SKILL.md): AI skill tạo sprite từ reference đến frame, atlas và QA.

## Bản vẽ
- `references/original_user_images/`: 5 hình gốc user đưa.
- `references/visuals/full/`: 5 ảnh concept theo chuyên mục.
- `references/visuals/crops/`: ảnh cắt nhỏ theo panel; **không có chữ mới bằng AI**.
- `archive/v2_production_spec/design_pack_v1/`: bản v1 với blueprint SVG, PNG, manifest 127 asset và event schema.
- `archive/v2_production_spec/docs/`: toàn bộ tài liệu v2, 5 production spec + roadmap + rules/decisions.

## Cấu trúc cho AI agents
- `AGENTS.md`: nhiệm vụ chung, invariant, thứ tự đọc.
- `.agents/skills/soul-of-meal-sprite/`: `SKILL.md`, prompts, template JSON, script local.
- `agents/SPRITE_TASK_HANDOFF.md`: hướng dẫn giao ticket cho bất kỳ AI editor/coder/art agent nào.
- `docs/02_art/ANIMATION_INTEGRATION_SPEC.md`: contract và copy-ready task riêng cho agent nối animation runtime.
- `scripts/`: wrapper (standalone; Python 3.10+, Pillow), demo và check spec.
- `examples/`: mẫu character identity, sprite job, combat, card, chess data.

## Quy tắc hiệu lực (source of truth)
1. Decision Record **APPROVED** mới là khóa luật; không có quyết định APPROVED mặc định chỉ vì được in trong tài liệu.
2. `docs/00_foundation/*` và `docs/01_gameplay/*` là **baseline thử nghiệm**, đánh dấu PROPOSED. Các đối số runtime phải từ data/config, không hardcode vào code.
3. `docs/02_art/*`, Sprite Skill và ví dụ JSON mô tả quy tắc asset; con số pixels là đề xuất xuất bản, cần test renderer.
4. `archive/` để truy xuất nguồn cũ, **không ghi đè v3**. Chữ và số trong hình concept **không phải contract**.
5. Không sao chép nhân vật/nhạc/asset độc quyền của Princess Connect!, Azur Lane hoặc Legends of Runeterra; chỉ tham khảo nguyên lý trải nghiệm.

## Lệnh nhanh
```bash
python scripts/validate_package.py .
python scripts/update_file_index.py .
python -m unittest discover -s tests -v
python .agents/skills/soul-of-meal-sprite/scripts/validate_sprite.py --help
python .agents/skills/soul-of-meal-sprite/scripts/build_atlas.py --help
python .agents/skills/soul-of-meal-sprite/scripts/make_preview.py --help
```

## Chạy browser runtime
Client web nằm trong [`client/`](client/README.md). Từ thư mục chứa tài liệu này, chạy `python3 -m http.server 4173` rồi mở `http://localhost:4173/client/`. Kiểm tra bằng `node --test client/tests/*.test.js`.

Bản chơi thử cục bộ gồm tuyến nhiệm vụ Adventure, TCG đấu bot và Auto Chess đấu bot. Adventure dùng sprite anime chibi cho Bún Bò Hỏa Linh, atlas hiệu ứng Hỏa, năm tuyệt kỹ khác nhau và nhạc/âm thanh theo cảnh. Xem [hướng dẫn client](client/README.md) để biết phạm vi kiểm thử và các bước nghiệm thu còn lại.
