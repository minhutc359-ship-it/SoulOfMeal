# 03 — UI WIREFRAME / UI-UX PRODUCTION SPECIFICATION

**Phụ trách:** UX Designer, UI Artist, Frontend Engineer, Game Client Engineer, Accessibility QA.  
**Visual:** `design_pack_v1/03_ui_wireframe/UI_CONCEPT_PLATE.png`, `UI_BLUEPRINT.svg`.  
**Output:** 16 screen đặc tả theo route, trạng thái, thành phần, event, accessibility và responsive layout.

## A. Screen sizes / Safe areas / typography
| View | Design viewport | Quy tắc |
|---|---|---|
| Mobile portrait | 390×844 **logical dp** | hub, quest, character, gacha |
| Mobile landscape | 960×540 dp | TCG, Auto Chess, Adventure combat tùy setting |
| Tablet portrait | 768×1024 dp | nội dung hai cột khi đủ rộng |
| Desktop landscape | 1440×900 dp | giữ panel trung tâm, mở sidebar |

- `dp` là logical unit; `px` chỉ dùng khi xuất raster asset. Tránh đo hit target bằng số pixel tệp PNG.
- OS notch/bottom gesture được cộng vào safe area; thêm 16 dp portrait, 20 dp landscape.
- Tap/click target tối thiểu 44×44 dp. Khoảng cách giữa nút nguy hiểm/confirm nên ≥8 dp.
- Text body 14–16dp; heading 20–28dp; caption tối thiểu 12dp; chữ Việt có dấu render runtime, **không bake vào art**.
- Layout dùng anchors/relative constraints, không dùng ảnh screenshot làm background có các nút vô hiệu.

## B. Tokens cốt lõi
| Token | Giá trị | Ghi chú |
|---|---|---|
| `color.bg.parchment` | `#FFF4DE` | panel có chữ sẫm |
| `color.bg.wood` | `#6A3F32` | viền, nền phụ |
| `color.accent.gold` | `#F4B642` | CTA chính |
| `color.text.primary` | `#392A34` | contrast test |
| `color.text.inverse` | `#FFF9EE` | trên dark panel |
| `color.accent.fire` | `#F36B3F` | status Hỏa |
| `color.accent.water` | `#52B7E7` | status Thủy |
| `color.accent.wood` | `#5CBF73` | status Mộc |
| `color.accent.light` | `#F8DE73` | status Quang |
| `color.accent.shadow` | `#825DC8` | status Âm |
| `space.*` | 4/8/12/16/24/32 dp | scale spacing |
| `radius.*` | 8/12/16 dp | buttons, cards, modals |
| `motion.fast` | 120ms | press |
| `motion.normal` | 220ms | modal/tab |
| `motion.scene` | 350ms | scene |

Component states: `idle`, `hover` (PC), `focus_visible`, `pressed`, `loading`, `disabled`, `success`, `error`. `loading` vô hiệu double click; `error` kèm message/retry. Không chỉ đổi màu để thể hiện trạng thái.

## C. Navigation map
```text
SPLASH → HOME
 HOME → WORLD_MAP → ADVENTURE_EXPLORE → ADVENTURE_BATTLE → BATTLE_RESULT
 HOME → VILIN_DETAIL → TEAM_BUILDER → ADVENTURE_BATTLE
 HOME → GACHA → REVEAL → VILIN_DETAIL
 HOME → TCG_DECK_BUILDER → TCG_MATCH → BATTLE_RESULT
 HOME → AUTOCHESS_LOBBY → AUTOCHESS_MATCH → BATTLE_RESULT
 HOME → QUEST_JOURNAL / SETTINGS
 * → UPDATE_PROMPT (non-destructive); * → ERROR_DIALOG
```
Back theo route stack. Trong trận đấu, `Back` mở confirm/pause thay vì điều hướng mất trận. Đăng nhập nếu có cần được bổ sung trong route map sau khi chốt account architecture.

## D. Screen matrix 16 màn hình (bản chi tiết)
| ID | Widgets/regions | Interaction và event | Phải có states | Exit rule |
|---|---|---|---|---|
| `screen_splash` | logo, progress, patch note | `boot.load`, `update.check` | load/update/offline/error | dữ liệu init hợp lệ |
| `screen_home` | profile, currencies, hero, CTA Adventure/TCG/Chess, bottom nav | `nav.enter_mode`, `home.companion.tap` | default/news/claimable | route hợp lệ |
| `screen_world_map` | map/POI, zone details, quest marker | `map.select_zone`, `map.enter` | locked/unlocked/selected/loading | selected unlocked |
| `screen_adventure_explore` | world viewport, minimap, quest tracker, joystick/interact | `move.intent`, `interaction.open` | idle/moving/dialogue/encounter/menu | save position before leave |
| `screen_quest_journal` | tabs, quest list, objective detail, track button | `quest.accept`, `quest.track`, `quest.claim` | new/active/complete/claimed/empty | actions acknowledged |
| `screen_team_builder` | 5 slots, roster filter, synergy, save button | `team.slot.assign`, `team.save` | valid/invalid/locked/saving | no duplicate illegal units |
| `screen_adventure_battle` | wave/boss HUD, battlefield, target/portraits/energy/ultimate | `battle.target.select`, `ultimate.request` | ready/casting/cooldown/win/lose | result from sim |
| `screen_battle_result` | win/lose, stars, loot, continue | `reward.claim` | pending/claiming/claimed/error | idempotent claim |
| `screen_vilin_detail` | full art / chibi, skills, stats, tabs, upgrade | `character.upgrade`, `skin.preview` | owned/locked/maxed/resources_missing | server/local rules ack |
| `screen_gacha` | banner, probability, currency, single/ten draws | `gacha.draw.request` | idle/confirm/processing/reveal/error | transaction atomic |
| `screen_tcg_deck_builder` | filter, collection, deck count/curve, save | `deck.card.add/remove`, `deck.save` | empty/invalid/valid/saved | 36 card validated |
| `screen_tcg_match` | two heroes, 5 unit slots/side, two traps/side, hand, mana, stack/priority | `card.play.request`, `turn.pass` | my_priority/opponent_priority/resolving/win | server/rules result |
| `screen_autochess_lobby` | mode, bot difficulty, queue status | `chess.start`, `match.cancel` | ready/matching/error | match assigned |
| `screen_autochess_match` | board, bench, shop×5, economy, trait, ranking | `shop.buy`, `chess.place`, `shop.reroll` | preparation/combat/reward/end | round state authoritative |
| `screen_settings` | sliders, presets, language, reduced motion | `settings.change`, `settings.save` | dirty/saving/saved/error | persisted |
| `screen_update_prompt` | version, changes, download progress | `update.start`, `update.retry`, `update.reload` | detected/downloading/verifying/restart/error | no save loss |

**Tên event UI trong bảng là đề xuất:** muốn dùng chính thức phải mở rộng enum trong `design_pack_v1/schemas/events.schema.json`. Không gửi các event chưa đăng ký vào hệ thống production khi chưa version schema.

## E. Layout Home — 390×844 dp
- **Top 0–68dp** (+inset): Profile button 44dp; gold/crystal/energy widgets; overflow cho máy hẹp.
- **Hero 76–466dp:** background làng + companion 3D/rig chibi, hotspot phản ứng. Avatar đặt focal x≈170dp nhưng auto safe-crop không che CTA.
- **CTA 470–600dp:** Adventure nút chính full-width; TCG & Auto Chess thành hai nút cùng kích thước. Khi mode locked: disabled + tooltip `Mở khóa tại nhiệm vụ X`.
- **Shortcuts 600–690dp:** Quest/Events/Friends; nếu không có nội dung, ẩn shortcut nhưng vùng chính không lỗ hổng.
- **Bottom navigation 76dp** (+inset): Home, Vị Linh, Triệu Hồi, Cửa Hàng. Active state/icon/label rõ; không overlay button hệ điều hành.

## F. Layout Adventure Explore — 390×844 dp
- Minimap ở top right trong vùng safe 112×112dp, tap mở `screen_world_map`.
- Quest track top-left: tiêu đề tối đa hai dòng, collapse/expand; nhiệm vụ mới có badge nhưng không spam.
- World viewport chiếm nội dung chính; player anchored khoảng x=195dp,y=470dp khi di chuyển.
- Virtual joystick 112×112dp bottom-left, chỉ hiển thị ở touch; PC keyboard mapping hiển thị theo setting.
- Interact button 56×56dp, quick menu 44dp; chỉ khả dụng khi có target.
- Dialogue overlay tối đa khoảng 240dp từ dưới lên, có portrait, speaker, typewriter toggle, skip, choice. Trong dialogue: movement/attack disabled.

## G. Layout Adventure Battle — 960×540 dp
- Top 0–64dp: wave, timer, boss/target HP, pause. Telegraph badge không trùng label.
- Arena y=68–396dp: camera follow, projectile/hit/telegraph. Canvas không lấy focus khỏi UI nhập.
- Bottom y=396–540dp: 5 portrait 88×88dp (co giãn theo viewport), năng lượng và ultimate action. Khi unit defeated chuyển gray + lock.
- `ultimate` disabled khi thiếu năng lượng/actor dead/locked; loading khi request pending; animation cut-in có thể `skip/short` theo settings.
- Touch target chọn mục tiêu; target indicator ngoài hitbox, không che diện tích NPC.

## H. Layout TCG Match — 960×540 dp
```text
[Opponent hero HP 8000]   [Enemy hand backs]    [Timer]
[Enemy unit slots ×5]      [Enemy trap slots ×2]
──────────────── active priority / stack ───────────────
[Own unit slots ×5]        [Own trap slots ×2]
[Own hero HP]              [Pass / Confirm]
[Hand cards w/ inspect]    [Mana 5/10]
```
- Tap card đưa lên preview có title/cost/ATK/DEF/rules text ở panel; không buộc người chơi đọc font 6px trên card.
- Drag/drop: valid zones sáng viền; invalid path trả thẻ về tay và tooltip lý do.
- State bar công bố rõ `Bạn có quyền hành động` / `Đợi đối thủ` / `Đang giải quyết`.
- Stack giải quyết chiếm khu vực góc phải có thứ tự, không chồng lên trap/target; có nút inspect lịch sử.
- Trap face-down chỉ cho owner xem nội dung; đối thủ thấy vị trí/count, không lộ thẻ qua alt/title/HTML.

## I. Layout Auto Chess Match — 960×540 dp
- Top 0–60: round, countdown, gold, HP, ranking; giao diện chuẩn bị khác giao chiến.
- Grid x≈95–795,y≈60–385; drag ghost bám tâm ô; grid highlight nếu hợp lệ.
- Trait panel có collapse ở left; ranking player ở right có thể overlay tạm khi màn hẹp.
- Shop 5 units + bench + `buy/lock/reroll/XP` ở bottom 388–540; không tràn màn 960dp.
- Trong combat: store/drag disabled, slot chỉ cho inspect; countdown rõ; game state không bị thay khi gesture chậm.

## J. Input contracts / error handling
| Flow | Request | Pending | Success | Failure |
|---|---|---|---|---|
| upgrade | `character.upgrade` + request_id | khóa nút, preview chi phí | update stats + VFX | giữ inventory, toast + retry |
| draw gacha | `gacha.draw` + txn_id | không cho double-tap | show reveal + add owned | không trừ đơn vị tiền nếu chưa confirm |
| claim reward | `reward.claim` + claim_id | spinner | mark claimed | retry cùng claim_id |
| enter zone | `map.enter` + destination | preload + progress | spawn valid | trở về map, báo lỗi |
| TCG play card | `card.play` + turn/revision | ghost waiting | commit to board/stack | trả về hand, reason code |
| chess buy | `shop.buy` + slot/revision | optimistic only if safe | unit to bench | rollback economy + animation |
| update | version check + download | % bytes nếu có | reload after save flush | retry, không mất state |

## K. Accessibility + localization + motion
- Color-coded elements kèm icon và text; red/green không là tín hiệu duy nhất.
- Optional `reduced_motion`: tắt shake, giảm cut-in parallax/flash, vẫn giữ telegraph đọc được.
- Voice có subtitle; audio-only boss warning luôn có hình/cảnh báo thị giác.
- Focus navigation keyboard; Esc/Back đóng lớp trên cùng; không có focus trap lỗi sau modal close.
- Text Việt dài 2–3 dòng phải có wrap; tiếng Anh có thể dài hơn, UI auto size thay vì overflow.
- QA contrast (đặt target WCAG AA cho text UI thông thường nếu khả thi và test minh họa nền rất nhiều chi tiết); bubble cần solid backdrop để đọc.

## L. Acceptance / Definition of Done
1. 16 screen có trạng thái loading/error/empty/disabled tương ứng, Back đúng và không mất data.
2. 390×844 portrait và 960×540 landscape không clipping, cả khi bật device safe area.
3. Trong TCG, người chơi nhìn được priority, mana, hero HP, trap, target và action stack mà không cuộn toàn trang.
4. Trong Auto Chess, mua/đặt/xoay đội hình không thể xảy ra ngoài preparation.
5. Quest, reward, gacha không gửi request duplicate khi double tap, reconnect hoặc retry.
6. Text hiển thị bằng font runtime và có thể localization.
7. Mọi button có actual handler; missing route/event không để nút nhìn tương tác nhưng vô hiệu.
