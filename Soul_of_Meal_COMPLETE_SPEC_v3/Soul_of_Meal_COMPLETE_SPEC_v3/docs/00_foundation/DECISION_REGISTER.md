# Decision Register — v3.0

Đây là bảng lựa chọn cần duyệt. **Trạng thái tất cả các mục: PROPOSED / NEEDS APPROVAL**. Đây không phải phê duyệt ngầm.

| ID | Phạm vi | Baseline đề xuất | Cổng chốt |
|---|---|---|---|
| D-001 | Renderer | 2D/2.5D engine có atlas + texture management + WebGL/WebGPU fallback | Benchmark 3 máy mục tiêu |
| D-002 | Sprite pipeline | PNG RGBA individual frames → shared atlas; rig tùy nhân vật nếu đủ chất lượng | Golden Sample |
| D-003 | Lưu game | local-first, phiên bản schema, optional cloud sync | Recover/reload tests |
| D-004 | PvP | bot-only P0, PvP sau deterministic tests | anti-cheat review |
| D-005 | Adventure | hero + 4 spirits, auto basic + manual ult | playtest |
| D-006 | Adventure formula | `floor(max(1, ATK*coef*100/(100+DEF)))` | balance spreadsheet/playtest |
| D-007 | TCG | 36 cards, 5 units, 2 traps, 8000 HP, 1..10 mana | simulation 100 games |
| D-008 | TCG priority | sequential priority, stack LIFO, two passes resolve top item | edge-case tests |
| D-009 | Auto Chess | 8 players/bots, shop 5, bench 9, 7×8 battle grid | bot simulation |
| D-010 | Auto Chess economy | interest 1/10 up to 5, shop odds per level | balance simulations |
| D-011 | Gacha | rates/pity TBD, display transparent published odds when approved | legal/policy |
| D-012 | FPS | 60 high / 30 low; sim fixed independent of render | perf QA |
| D-013 | Audio | 48 kHz source, buses Music/SFX/Voice/Ambience | mix/playback tests |
| D-014 | Source licenses | original / licensable only, provenance required | legal sign-off |
| D-015 | UX orientation | Home portrait first, battle strategy landscape-friendly | UX tests |
| D-016 | UI density | minimum 44 dp touch, safe area OS inset | actual devices |
| D-017 | Release content | P0 five characters, one village & one forest map | production capacity |

Decision records khi chốt được lưu `docs/00_foundation/decisions/D-XXX.md`, có các trường: context, options, approved_by, approved_on, balance/version implications, rollback, test fixtures. Nếu chưa có bản APPROVED, hệ thống xử lý dưới mode `prototype` và hiển thị trong tài liệu là chưa khóa.
