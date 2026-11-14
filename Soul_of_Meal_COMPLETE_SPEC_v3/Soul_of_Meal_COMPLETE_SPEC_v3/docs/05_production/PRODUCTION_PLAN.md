# Production Plan / Next Steps

## Documentation-first checkpoint

Before expanding gameplay implementation, keep the documents and code in sync:

1. Use `docs/00_foundation/DECISION_REGISTER.md` to track every unresolved baseline; do not silently promote **PROPOSED** values to approved rules.
2. Keep each mode's rulebook as the gameplay source of truth and record implemented API/state contracts in `docs/03_engineering/` without implying unimplemented behavior exists.
3. Link acceptance criteria to executable tests where available; label manual, art, device and future-runtime checks as such.
4. Update examples/config schemas and their validators when a documented contract changes.
5. Re-run `python -m unittest discover -s tests -v` and `python scripts/validate_package.py .` after documentation or contract updates.

## Web Client–Server implementation

The current browser playtest has Canvas 2D, local versioned saves, original chibi artwork and three bot gameplay loops. See the [concept audit](../04_qa/PLAYTEST_CONCEPT_GAP.md) for exact coverage. The [v3.2 architecture](../03_engineering/ENGINE_ARCHITECTURE.md) sequences web shell and renderer validation, server account/save, mode migration and release integration. Keep the current client available as a gameplay and asset reference while the new shell is developed.

## Từ demo đến bản 1.0

Ưu tiên Adventure và TCG. Auto Chess đấu bot vẫn nằm trong phạm vi 1.0. PvP và gacha trả phí có mốc riêng theo [spec kiến trúc](../03_engineering/ENGINE_ARCHITECTURE.md).

| Mốc | Phạm vi | Tiêu chí nghiệm thu |
| --- | --- | --- |
| Chốt demo | Kiểm tra trọn luồng ba chế độ trên preview. Sau khi đạt, đưa PR #11 vào `main` và xác nhận đúng SHA ở Vercel Production. | Safari iOS và Chrome Android trên máy thật kiểm tra cài từ màn hình chính, mở game, xoay máy, vùng chạm và âm thanh khi trở lại game. Adventure chơi tới boss, TCG có phản ứng và lật bẫy, Auto Chess mua quân, xếp quân, ghép sao rồi giao tranh. |
| Adventure Chương 1 | Hoàn thiện luồng Lilia → giải khóa rương → điều tra rừng → các đợt quái → Bếp Trưởng Hỏa Diệm → trả nhiệm vụ. Dùng bản mẫu Bún Bò để rà rig, lớp che khuất và nhịp ra đòn. | Người chơi mới theo được chỉ dẫn, phân biệt được các đòn boss và có thể tải lại ở giữa trận hoặc sau khi nhận thưởng. Thử mở lại rương và bản lưu cũ để kiểm tra thưởng và cổng. |
| Adventure Chương 2–6 | Áp dụng chuẩn Chương 1 cho nhiệm vụ, NPC, minh họa truyện, thử thách và boss các vùng. Duyệt quái, boss và Vị Linh theo từng cảnh. | Chơi từ hồ sơ mới đến cảnh kết, xem lại truyện đã mở và tái đấu boss. Kiểm tra va chạm, che khuất và đường đến điểm tương tác trên từng map. |
| TCG | Cân bằng các bộ mẫu và ba mức bot. Hoàn thiện đặt úp, lật bẫy, kéo thả, chọn mục tiêu và thứ tự xử lý phản ứng. | Ván mới chơi đủ luật 5 Vị Linh + 2 bẫy trên PC và thiết bị thật. Tải lại được lúc chờ phản ứng. Ván lưu v3 giữ luật cũ. |
| Auto Chess | Cân bằng bot, hiệp lực và kinh tế. Rà thao tác shop, bench, đội hình, ghép sao, trang bị và phát lại. | Chơi hết ván trên màn hình ngang thấp; bench và quân đọc được; lưới chỉ hiện khi chuẩn bị. |
| Mỹ thuật và âm thanh | Duyệt splash art, rig Spine, clip, VFX và SFX của từng chế độ song song với gameplay. | Trên máy thật, pose và hướng giữ đúng nhận diện. Tín hiệu báo đòn, điểm chạm và âm thanh khớp sự kiện mô phỏng. Kiểm tra cả tùy chọn giảm hiệu ứng. |
| Beta và phát hành | Đồng bộ tiến trình, kho đồ và thưởng qua server theo spec. Đo tải và FPS, rà bản quyền asset và thử quay lui bản triển khai. | Bản lưu cũ tiếp tục đúng mốc, gửi lại yêu cầu thưởng chỉ ghi một lần, khôi phục được sau mất mạng và ván đang chơi giữ phiên bản khi có bản cập nhật. Ghi kết quả thiết bị thật trong [kế hoạch QA](../04_qa/ACCEPTANCE_TEST_PLAN.md). |

## Gate 0 — Approve art & rule baselines
Game designer and tech lead review v3 prototype baselines and mark ADR statuses. Art director approves 5 character identities, color board, one isometric map angle, and Home/TCG/Chess hierarchy. Unapproved items stay in data configs. Output: decisions and constraints, not code.

## Gate 1 — Build Golden Sample character
Use sprite agent skill to build `chr_bunbo_holinh` from a standalone identity guide; source layers, turnarounds and frames. Export 9 animations, 8 facial expressions, one cut-in, VFX sockets, audio cues. Validate asset + scene preview; refine until no identity drift/clip issues. Output: complete reusable production template + benchmark.

## Gate 2 — Environment slice
Implement village: main plaza, restaurant, guild, merchant, forge, houses, bridge, chest; Lilia quest and forest portal. Pathfinding/navmesh, chunk streaming, camera, collision, interactions. Output: player can explore and reload.

## Gate 3 — Core combat and 3 mode demos
Adventure: 1 boss/2 enemy varieties/1 ultimate; TCG: 36-card decks with traps and stack, one bot; Auto Chess: shop, merge, 7x8 board, bot, combat events. Implement separate data schemas sharing Vị Linh `id`, art motifs, SFX buses. Output: 20-minute end-to-end demo.

## Gate 4 — UI, audio, update flow
Build the approved screens in one viewport, responsive HUD and four audio buses. Verify login, bootstrap, server recovery and scene bundles by content version. PWA install can be evaluated after the browser flow.

## Gate 5 — QA and production readiness
Run 30/60 render FPS behavior tests, mobile low-memory benchmarking, 53 old QA acceptance cases + v3 new case IDs, copyright/provenance and release checklist. Prioritize fixes using reproducible issue IDs and fixture versions.

## Suggested agent responsibilities
| Agent | Inputs | Outputs | Approval gate |
|---|---|---|---|
| `game-design-agent` | rulebooks | validated mode catalog and balancing workbook | Game Designer |
| `character-art-agent` | character bible + skill | identity, sprites, cutin and atlas | Art Director |
| `environment-agent` | map/props spec | tile/props/NPC sprites, collision | Level Designer |
| `ui-agent` | wireframes/state matrix | responsive components & animation | UX QA |
| `combat-agent` | rulebooks/events | deterministic simulation + replay | Tech Lead |
| `vfx-audio-agent` | five-element guide | FX profiles + SFX/voice event links | Audio/Art Lead |
| `qa-agent` | test plan + schemas | regression reports and captures | QA Lead |
| `release-agent` | artifact manifest | versioned assets + compliance checks | Release Manager |

## Milestones (not promised dates)
M0 approval and scope lock; M1 Golden Sample; M2 Adventure slice; M3 TCG bot play; M4 Auto Chess bot play; M5 unified vertical slice; M6 beta. Advance only after acceptance, not after a calendar date.

## Open gaps remaining after v3
1. Final balance from long playtests (not inferred from image).
2. Phaser WebGL and Spine benchmark across target devices.
3. Production motion and rig review, voice, scene templates and the remaining effects.
4. PvP server authority, matchmaking/reconnect/anti-cheat (if in scope).
5. Ownership/license approvals and publishing / economy legal compliance.
