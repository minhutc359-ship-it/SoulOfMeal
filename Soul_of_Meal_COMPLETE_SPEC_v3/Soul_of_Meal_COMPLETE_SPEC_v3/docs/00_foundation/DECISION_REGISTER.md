# Decision Register — v3.0

Các baseline D-001 đến D-017 dưới đây được Project Owner duyệt ngày 2026-11-10 theo yêu cầu trong phiên làm việc. Phạm vi duyệt là baseline thiết kế/prototype; cổng benchmark, playtest, art, thiết bị và pháp lý vẫn là điều kiện nghiệm thu trước khi triển khai/phát hành, không được hiểu là đã hoàn tất.

| ID | Phạm vi | Baseline đã duyệt | ADR | Cổng nghiệm thu còn lại |
|---|---|---|---|
| D-001 | Renderer | 2D/2.5D; WebGL required, WebGPU optional; named engine after benchmark | [D-001](decisions/D-001.md) | Benchmark 3 target devices before engine lock |
| D-002 | Sprite pipeline | Individual RGBA PNG frames + metadata → shared atlas; rig only if Golden Sample qualifies | [D-002](decisions/D-002.md) | Golden Sample art/clip review |
| D-003 | Lưu game | Local-first, versioned schema/migrations; cloud sync outside P0 | [D-003](decisions/D-003.md) | Recovery, reload, migration and duplicate-claim tests |
| D-004 | PvP | Bot-only P0; no online PvP until server authority and anti-cheat gates pass | [D-004](decisions/D-004.md) | Determinism, server authority, reconnect and anti-cheat review |
| D-005 | Adventure | 1 hero + 4 spirits; auto basic attacks + manual ultimate | [D-005](decisions/D-005.md) | Playtest; full party/runtime not implemented |
| D-006 | Adventure formula | `max(1, floor(ATK * coefficient * 100 / (100 + DEF)))` | [D-006](decisions/D-006.md) | Balance playtest; coefficients remain data |
| D-007 | TCG | 36-card deck, max 2 copies where configured, 5 units, 2 traps, 8000 HP, mana cap 10 | [D-007](decisions/D-007.md) | 100-game simulation; not release balance |
| D-008 | TCG priority | Sequential priority; two passes resolve top LIFO item or close empty window | [D-008](decisions/D-008.md) | Edge-case tests; remaining card/effect grammar |
| D-009 | Auto Chess | 8 competitors (bots allowed), shop 5, bench 9, total grid 7×8 / each half 7×4 | [D-009](decisions/D-009.md) | Bot simulation; full combat not implemented |
| D-010 | Auto Chess economy | Interest `min(floor(pre-payout gold/10), 5)`; configured per-level odds | [D-010](decisions/D-010.md) | Economy simulations; current shop is with replacement |
| D-011 | Gacha | No monetized gacha in P0; rates/pity need separate approval and transparent disclosure | [D-011](decisions/D-011.md) | Economy/legal review before any future paid pulls |
| D-012 | FPS | Target 60 FPS high / 30 FPS low; fixed simulation independent of render | [D-012](decisions/D-012.md) | Device profiling; target is not measured performance |
| D-013 | Audio | 48 kHz source; independent Music/SFX/Voice/Ambience buses | [D-013](decisions/D-013.md) | Platform playback, mix and clipping tests |
| D-014 | Source licenses | Original or appropriately licensed assets; provenance required | [D-014](decisions/D-014.md) | Per-asset legal sign-off |
| D-015 | UX orientation | Home portrait-first; strategy screens landscape-friendly | [D-015](decisions/D-015.md) | Responsive UX/device tests |
| D-016 | UI density | Minimum 44 dp touch targets; honor OS safe-area insets | [D-016](decisions/D-016.md) | Actual device validation |
| D-017 | Release content | P0 scope: five characters, one village and one forest map | [D-017](decisions/D-017.md) | Capacity and slice acceptance; approval is not delivery |

Decision records được lưu `docs/00_foundation/decisions/D-XXX.md`, gồm context, decision, approver, date, implications, rollback và test fixtures. Người duyệt được ghi là Project Owner theo xác nhận trong phiên làm việc; tên hiển thị chưa được cung cấp. Các mục có cổng nghiệm thu vẫn là prototype cho đến khi bằng chứng kiểm thử/duyệt tương ứng được ghi nhận.

## D-018 · Three-mode playable upgrade · PROPOSED (2026-11-15)

Implement the user-shared three-mode brief as a local playable client while retaining the v3 prototype status. `client/src/core/rules.js` and the JSON catalogs hold proposed balances. Seven-bot tournament adjudication, overtime, items, region/progression rewards, 900-damage paid elemental combo and 0.7 combat presentation speed are documented in `docs/03_engineering/THREE_MODE_UPGRADE.md`. This implementation does not mark art, balance, engine/device performance or multiplayer as approved. Legacy Python reference slices retain their existing contracts.
