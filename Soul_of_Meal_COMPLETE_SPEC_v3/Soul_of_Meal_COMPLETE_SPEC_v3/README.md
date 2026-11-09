# Soul of Meal — COMPLETE GAME & ART PRODUCTION SPEC v3.0
**Ngày:** 2026-11-09 · **Trạng thái:** pre-production specification / playable prototype baseline (proposed) · **Ngôn ngữ:** Việt / English technical IDs.

Đây là **gói duy nhất** chứa nguồn hình do người dùng gửi, 5 concept sheet tách riêng, **35 crop ảnh theo từng mục**, toàn bộ gói thiết kế v1 + v2, rulebook của 3 chế độ, kiến trúc dữ liệu, và AI Sprite Agent Skill có script xây atlas/kiểm tra.

## Mở theo thứ tự
1. [`docs/00_foundation/PROJECT_BIBLE.md`](docs/00_foundation/PROJECT_BIBLE.md): triết lý game, scope, quy tắc giữ nhận diện, nguồn chân lý.
2. [`docs/00_foundation/DECISION_REGISTER.md`](docs/00_foundation/DECISION_REGISTER.md): các giá trị prototype (PROPOSED) và những quyết định phải duyệt.
3. [`docs/01_gameplay/ADVENTURE_RULEBOOK.md`](docs/01_gameplay/ADVENTURE_RULEBOOK.md), [`TCG_RULEBOOK.md`](docs/01_gameplay/TCG_RULEBOOK.md), [`AUTO_CHESS_RULEBOOK.md`](docs/01_gameplay/AUTO_CHESS_RULEBOOK.md).
4. [`docs/02_art/SPRITE_PIPELINE.md`](docs/02_art/SPRITE_PIPELINE.md): kích thước, animation, crop, schema, sprite pipeline.
5. [`docs/02_art/VISUAL_REFERENCE_INDEX.md`](docs/02_art/VISUAL_REFERENCE_INDEX.md): link từng tấm hình nhỏ, không cần nhìn poster chữ li ti.
6. [`docs/03_engineering/ENGINE_ARCHITECTURE.md`](docs/03_engineering/ENGINE_ARCHITECTURE.md): kiến trúc đích và trạng thái triển khai hiện tại.
7. [`docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md`](docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md): API, state contract, lệnh test và giới hạn của rules prototype đã chạy.
8. [`docs/03_engineering/TCG_RULES_REFERENCE.md`](docs/03_engineering/TCG_RULES_REFERENCE.md): API, state contract và giới hạn của phần TCG setup/draw.
9. [`docs/03_engineering/ADVENTURE_RULES_REFERENCE.md`](docs/03_engineering/ADVENTURE_RULES_REFERENCE.md): API, combat event contract, test fixture và giới hạn Adventure rules prototype.
10. [`docs/04_qa/ACCEPTANCE_TEST_PLAN.md`](docs/04_qa/ACCEPTANCE_TEST_PLAN.md) và [`docs/05_production/PRODUCTION_PLAN.md`](docs/05_production/PRODUCTION_PLAN.md).
11. [`.agents/skills/soul-of-meal-sprite/SKILL.md`](.agents/skills/soul-of-meal-sprite/SKILL.md): AI skill tạo sprite từ reference đến frame, atlas và QA.

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

**Không có sprite/runtime game hoàn thiện trong gói này.** Ảnh concept là đầu vào mỹ thuật; AI skill là quy trình và công cụ để sinh/kiểm chứng sprite. Tệp `examples` là fixture và thiết lập đề xuất, không phải asset đã được cấp phép phát hành.

Hiện có **rules prototype Auto Chess**, **TCG setup/action/combat slice** và **Adventure combat slice** bằng Python, chưa phải game runtime: xem các engineering references dưới `docs/03_engineering/` để biết phạm vi thực thi. Adventure exploration, boss/wave/reward flow, phần còn lại của TCG/Auto Chess, client/UI và lưu trận chưa được triển khai.
