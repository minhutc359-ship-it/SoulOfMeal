# 07 — GAME RULES: NHỮNG QUYẾT ĐỊNH CÒN PHẢI CHỐT

Tài liệu này phân tách **đã có nguồn mô tả** và **chưa có đủ thông số**; tránh nhầm concept art thành game logic chính thức. Các số dưới đây là giá trị baseline **đề xuất để làm prototype**, thay đổi phải ghi Decision Record có ID.

## A. Decisions critical cần duyệt trước coding core
| Decision ID | Câu hỏi | Baseline đề xuất | Ảnh hưởng |
|---|---|---|---|
| `DEC-001` | Engine/client stack? | Web/PWA renderer 2D/2.5D, engine chọn sau benchmark | rig, shaders, build |
| `DEC-002` | Save offline/account? | local-first single player, account sync optional | schema, migration |
| `DEC-003` | PvP online thời điểm nào? | P0 bot-only, PvP sau khi rules deterministic | authority/matchmaking |
| `DEC-004` | Adventure team size? | 1 hero + 4 Vị Linh | UI/team stats |
| `DEC-005` | Adventure: auto attack/manual ult? | auto attack + manual ultimate | movement/combat input |
| `DEC-006` | Adventure damage formula/status cap? | TBD, cần spreadsheet cân bằng | core mechanics |
| `DEC-007` | Adventure hit collision/target lock? | server/local rules decides hit at sim tick | correctness |
| `DEC-008` | TCG deck size? | 36; max 2 copies normal cards | collection UI |
| `DEC-009` | TCG board/traps? | 5 units + 2 traps per side | UI/board model |
| `DEC-010` | TCG hero HP/mana? | 8000; 1→10 cap | card balance |
| `DEC-011` | TCG combat priority/blocking? | alternating priority + reaction stack; blocking rule TBD | deterministic rules |
| `DEC-012` | TCG mana refresh/draw/card limits? | TBD | deck viability |
| `DEC-013` | Auto Chess player count? | up to 8/bot; prototype fewer if needed | lobby/server |
| `DEC-014` | Auto Chess cost tiers/odds/pool? | TBD | shop balance |
| `DEC-015` | Auto Chess economy? | interest 1 per 10 gold up to 5 at 50 (proposal) | long-term strategy |
| `DEC-016` | Auto Chess board size + units cap? | TBD; visual sketch not authoritative | board/input |
| `DEC-017` | Gacha rarity/rate/pity? | TBD; do not show odds before approved | economy/trust |
| `DEC-018` | Target devices/performance? | 60 FPS high, 30 FPS low; devices TBD | asset pipeline |
| `DEC-019` | Animation technology? | compare skeletal rig vs sprite sheets on browser | source pipeline |
| `DEC-020` | Audio language/VO? | Vietnamese primary, subtitles required | localization/recording |
| `DEC-021` | Content/IP ownership? | original/licensed only, provenance recorded | legal release |
| `DEC-022` | Full screen rotation mode? | portrait home, landscape strategy modes | UI/browser input |

## B. Bảng luật cần viết trước mỗi chế độ
### Adventure Rulebook checklist
1. Stats: HP/ATK/DEF/SPD, level growth, skill power, energy max/gain, cooldown.
2. Attack: target priority, range, line of sight, pathfinding, hit/miss, multi-target.
3. Status: burn/slow/shield/bind/stun, stack limit, cleanse, immunity, boss resistance.
4. Battle: wave length, target retarget, actor death, summon, interruption, ultimate queue.
5. Boss: windup/telegraph, phases, enrage/failure, difficulty variants.
6. Rewards: victory/star conditions, claim ID, daily/week caps if any, retry behavior.

### TCG Rulebook checklist
1. Deck: composition, hand size, initial draw/mulligan, max copies, rarity limits.
2. Phase: start, draw, main, declaration, block, reaction, resolve, cleanup.
3. Priority: who can respond, instant/slow, when both pass, stack direction.
4. Combat: unit ATK/DEF, blockers, direct attack, persistent damage, spell damage.
5. Trap: set turn, flip triggers, hidden info, chain cancellation, limit per turn.
6. Resource: mana increase/refill, spell cost, leftover mana behavior.
7. Victory: HP 0, deck-out, surrender, disconnect, turn timeout, tiebreak.

### Auto Chess Rulebook checklist
1. Shop: five cards, cost tiers, probability per level, finite pool/shared pool, reroll.
2. Economy: starting gold, base income, interest, win/lose streak, damage to player HP.
3. Level: EXP costs, max board units, stage/round timer, bench capacity.
4. Units: star merge, source of items, synergies, elemental interactions, targeting.
5. Phases: preparation lock, battle sim, reward, elimination, round reset.
6. Matchmaking: bot/multiple players, mirror combat, rematch rules, fairness.

## C. Balance document template
Mỗi character/ability/card/unit cần record:
`id`, `mode`, `role`, `element`, `tier`, `cost`, `hp`, `atk`, `def`, `range_units`, `attack_interval_ms`, `cast_time_ms`, `damage_formula_id`, `cooldown_ms`, `energy_cost`, `status_ids`, `targeting_policy`, `vfx_id`, `sfx_id`, `version`, `owner`.

**Điểm quan trọng:** không copy `hp=30` của một mode sang `hp=8000` của TCG hoặc HP Auto Chess; các mode có scale riêng. Ảnh hiển thị con số chỉ để minh họa, không phải baseline balance.

## D. Quy trình chốt quyết định
`OPEN → DRAFT_OPTION → REVIEW (game+tech+art+QA) → APPROVED → IMPLEMENTED → VERIFIED`. Mỗi thay đổi ảnh hưởng gameplay cần cập nhật test fixture và migration rule version. `TBD` không được đi vào logic production theo dạng hardcode ẩn.
