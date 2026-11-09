# 04 — COMBAT STORYBOARD / RULES + ANIMATION EVENT SPECIFICATION

**Phụ trách:** Game Designer, Gameplay Engineer, Animator, VFX Artist, Audio, QA.  
**Reference:** `design_pack_v1/04_combat_storyboard/{COMBAT_CONCEPT_PLATE.png,COMBAT_BLUEPRINT.svg}`.  
**Triết lý:** gameplay rules quyết định kết quả, animation/VFX/SFX **hiển thị** kết quả; không tính damage bằng thời gian phát clip hoặc JS timeout UI.

## A. Simulation vs presentation
```text
PLAYER/BOT INTENT
    ↓ validate (phase, actor, mana/energy, range, target, status)
SIMULATION COMMAND -> deterministic rules / server authority where needed
    ↓ state change + canonical action ID + ordered combat events
PRESENTATION BRIDGE -> animation tracks, VFX sockets, audio cues, UI hints
    ↓ animation recovery / catch-up / snapshots
NEXT COMMAND
```
`action_id`/`instance_id` giúp deduplicate. Event có `sim_tick` và `sequence` đề xuất trong payload. Actor không thể gây damage nhiều lần chỉ vì clip loop hoặc replay khi mạng reconnect.

### Combat event envelope v1 tương thích
```json
{
  "event_id":"evt_000121",
  "type":"combat.damage_applied",
  "instance_id":"act_001_ultimate_01",
  "timestamp_ms":2000,
  "actor_id":"chr_bunbo_holinh_ally_01",
  "target_id":"enemy_mushroom_01",
  "payload":{"sim_tick":120,"sequence":9,"ability_id":"skill_bunbo_ngonluaamthuc","damage":418,"is_crit":false,"element":"fire"}
}
```
Schema gốc v1 có `type` enum giới hạn. Tất cả event mở rộng phải bổ sung version vào schema trước khi publish. Giá trị `damage=418` **chỉ là test fixture**, không phải balance final.

## B. Luồng Adventure & targeting
Team gồm 1 nhân vật chính + 4 Vị Linh. Combat realtime: hành động thường tự động, người chơi dùng ultimate và chọn ưu tiên mục tiêu (nếu hỗ trợ).

- `target_select`: đội có target hợp lệ nằm trong tầm nhìn; ưu tiên aggro/threat, cự ly và vai trò (phải được rule config quy định).
- `move_into_range`: melee tiến về mục tiêu, bảo đảm nav path trước khi chém; ranged giữ khoảng cách thích hợp.
- `attack_validate`: actor sống, không stun, cooldown xong, line-of-sight/range hợp lệ.
- `hit_resolve`: kiểm `target_state`, collider và target policy tại tick hit; tạo đúng một `hit_confirmed` cho hit instance.
- `death`: khi HP về 0, dừng hành động mới và phát `defeat`; projectile đang bay xử lý theo `onCasterDeathPolicy`.
- `wave`: khi đủ điều kiện thắng, lock spawns, chuyển wave, reward cuối trận chỉ claim một lần.

**Unit baseline:** range melee đề xuất `1.25 tile = 80 world units`, hiện trong sample attack Bún Bò. Kỹ năng ranged tùy rules. Không tự suy ra range từ chiều dài particle/ảnh.

## C. Frame storyboard — Bún Bò attack A
**Clip:** `chr_bunbo_holinh.attack_a` — 30 frames @60 FPS tham chiếu (0.50s).
| Frames | Visual | Logic | VFX / SFX |
|---|---|---|---|
| F00–F05 | bước tiếp cận, chuẩn bị dao | target validate | `sfx_step_light` |
| F06–F11 | charge lửa trên vũ khí | `cast_start` | `vfx_fire_anticipation_small` |
| F12–F17 | chém cung rộng, trail có hướng | hit window open | `vfx_fire_slash_a`, `sfx_fire_whoosh_a` |
| **F18** | dao va chạm mục tiêu | `hit_confirmed` nếu hit hợp lệ → `damage_applied` | `vfx_fire_hit_small`, `sfx_blade_impact` |
| F19–F24 | kẻ địch có hit react, knockback nhẹ | optional status | aftermath embers |
| F25–F29 | recover, trở lại guard | `cast_complete` | fade residual FX |

Nếu mục tiêu mất hiệu lực trước hit tick, **không** tạo impact/hit SFX giả; có thể play miss swoosh. Animation drop frame cần catch-up dựa event log; không bỏ damage.

## D. Frame storyboard — Phở Lam Vũ projectile
**Clip:** `chr_pho_lamvu.skill_01`, 72f / 1.2s visual sample.
| Frames | Presentation | Event |
|---|---|---|
| F00–F11 | đứng cast, vòng nước dưới chân | `cast_start` |
| F12–F23 | gom dòng nước đầu trượng | `charge_ready` (nếu được đăng ký v2) |
| F24 | phát projectile tại `muzzle` | `animation.projectile_spawn` |
| F25–F47 | projectile spline theo target snapshot/homing policy | projectile sim tick |
| **F48** | splash tại collider | hit/damage/status events |
| F49–F60 | water mist, icon slow | `status_applied` |
| F61–F71 | trở về idle | `cast_complete` |

Projectile travel time thay đổi theo khoảng cách thật; F48 chỉ đúng **trong demo quay phim**. Runtime impact phát khi projectile simulation va chạm, không ép 48f mọi trường hợp. `target invalid` → resolve `miss / retarget / explode` theo policy rõ ràng.

## E. Ultimate storyboard — Bún Bò Hỏa Linh
**ID:** `skill_bunbo_ngonluaamthuc`, full visual 150f = 2.5s, cut-in ngắn tùy setting.
| Frames | Shot | Visual/animation | Rule & audio |
|---|---|---|---|
| 000–017 | arena push-in | stance, pháp ấn lửa | `cast_start`; tension cue |
| 018–047 | anime face cut-in | portrait động / câu thoại | `vo_chr_bunbo_ultimate_vi`; duck BGM |
| 048–063 | dash tracking | lao tới, trail đỏ vàng | `vfx_fire_dash_trail` |
| 064–072 | two slashes | hai cung lửa khác nhau | `hit_1` và `hit_2` nếu rules multi-hit |
| 073–099 | elevated AoE | pháp ấn nguyên liệu và telegraph | thông báo vùng nguy hiểm |
| 100–110 | climax impact | vòng lửa + chấn động | main hit ở tick được rules resolve |
| 111–125 | pull-back | tàn lửa, boss hit react | status burn (nếu có) |
| 126–149 | camera reset | actor về idle | `cast_complete`, unduck BGM |

**Bảo vệ trận:** chỉ một full-screen cinematic cùng lúc; ultimate khác ưu tiên hàng chờ hoặc short form; giảm sáng flash và camera shake khi `reduced_motion=true`.

## F. Storyboard bổ sung cho 3 Vị Linh
| Character | Cast visual | Main action | Hit/impact | Return state |
|---|---|---|---|---|
| Gỏi Cuốn Diệp Nhi | lá tụ quanh tay 0–18f | vine mọc từ ground target 19–37f | rễ khóa mục tiêu 38–45f | hoa/lá tan dần 46–70f |
| Bánh Bao Bạch Ngọc | phồng má 0–18f | vòng bảo hộ nở 19–25f | shield applied, sparkle 26f | shield theo gameplay timer, không theo cast clip |
| Cà Phê Dạ Vũ | bóng đêm tụ ở chân 0–16f | teleport đằng sau mục tiêu 17–30f | chém kép / shadow mark 31–45f | dissolve + backstep 46–65f |

Các frame chỉ là **timing visual preview**. Animation event marker không bảo đảm quy tắc combat cho tới khi skill data được chốt.

## G. Adventure: boss telegraph và hit reactions
- Boss attack gồm `windup` (vẽ vùng dự báo), `commit`, `active`, `recovery`; luôn có visual warning trước vùng nổ.
- Telegraph shapes: sector, circle, line, donut, safe-zone. Cần stroke/texture pattern và icon, không chỉ một mảng màu đỏ.
- Target airborne/knockback phải tách `position in game state` khỏi render offset; tránh actor bị kẹt hoặc dịch vị trí vĩnh viễn do animation.
- Hit reaction policy: small target lùi ~8–16 world units nếu được rules cho phép; boss lớn dùng shake/bone hit không buộc knockback.
- Shield: `active / absorbing / breaking / expired`; HP giảm và vỡ khi sim rule xác nhận, không vỡ chỉ vì hết sprite timeline.

## H. TCG — Rulebook prototype
**Thông số minh họa:** deck 36 lá, 5 unit slots/bên, 2 trap slots/bên, hero HP 8000, mana max 10, max 2 bản sao lá thường. Các thông số cần chốt trước balance.

| Phase | Hành động hợp lệ | State nhận diện | Kết thúc |
|---|---|---|---|
| start_round | recharge mana, draw according to rule | turn banner | on draw complete |
| main_priority | summon, cast normal spell, set trap, declare attack | `my_priority` | attack/pass |
| reaction_window | instant/fast spell, eligible trap, pass | `priority_player/opponent` | both pass |
| resolve_stack | không chơi normal card, resolve from stack | stack animation | empty stack |
| end_round | cleanup, status expire, priority swap | end banner | next round |

**Ví dụ chain:** player declare attack → opponent trap trigger → player fast spell → both pass → stack resolves LIFO (đề xuất) → check win state. Tất cả action phải có `turn_id`, `revision`, `controller`, `legal_target_ids` hoặc reason code. Khi request invalid, card **không biến mất** khỏi tay. Không đưa đối thủ thông tin về bài bẫy úp.

**Damage/DEF clarification:** DEF là sức bền của unit trong mode này theo thiết kế đề xuất, không tự động là phần trăm giảm sát thương. Unblocked attack có thể gây damage vào HP hero nếu điều kiện hợp lệ. Cần xác nhận luật chắn/attack trực tiếp/thời gian round ở Decision Register.

**TCG effects visual:** `draw → inspect/drag → summon/activate → priority indicator → trap flip → stack resolve → damage + hero HP update → result`. Mọi card frame/zoom/cutin sử dụng chung identity của Vị Linh.

## I. Auto Chess — Round rulebook prototype
| Phase | Hành động | UI change | Lock |
|---|---|---|---|
| setup/preparation | buy/sell/reroll/lock/XP/position | shop+bench+board | changes revisioned |
| phase_lock | snapshot valid lineup | countdown + freeze | không được đặt lại sau lock |
| simulation/combat | units auto move/attack/cast | shop disabled, telegraph visible | không thể buy/drag |
| reward | gold/XP/loot/HP update | reward summary | claim once |
| next_round | regenerate shop if rule says | reset timer | economy rule config |

**Upgrade:** ba unit cùng `unit_id+star` hợp thành một quân star+1 (đến 3 sao). Transaction atomic: reserve three IDs → create higher star unit → remove consumed once → spawn merge effect. Không phụ thuộc animation để quyết định merge.

**Combat AI:** chọn target theo rule, bước vào range, attack instance duy nhất, projectile/hit VFX ở đúng vị trí. Bot difficulty từ quyết định kinh tế/lineup; không âm thầm buff odds khi chọn Extreme.

## J. Determinism / replay / PvP fairness
- Rule engine nhận `state + command + rng_seed` và trả `new_state + ordered_events`; fixed tick theo engine, không dùng local `Date.now()` trong logic quyết định kết quả.
- RNG dùng seed ghi lại phục vụ replay/debug; server authoritative bắt buộc đối với PvP chính thức.
- Snapshot sau mỗi major action; event ID monotonic trong một match; replay các event không tạo reward trùng.
- State hash/checksum phục vụ phát hiện desync; khi resync UI chuyển sang snapshot mới, animations catch-up hoặc skip visual chứ không thay state.
- QA dùng golden match fixtures cho cùng inputs/seed → cùng result trên PC/mobile.

## K. Acceptance scenarios
1. Đòn cận chiến không gây damage ngoài range; melee biết tiến vào tầm, không chém từ xa.
2. Đạn có spawn/travel/collision/impact, hit VFX và SFX tại contact; hụt thì không hiện fake impact.
3. Khi FPS 60→20 hoặc tab bị background, simulation không nhân damage, không cộng reward trùng.
4. Hai ultimate liên tiếp không chồng cut-in che toàn bộ board.
5. TCG cho phép phản ứng có ưu tiên, bẫy không lộ nội dung đối thủ, invalid card trả đúng về hand.
6. Auto Chess hết giai đoạn preparation thì không mua/di chuyển; merge 3-of-kind atomic và đúng số lượng.
7. Boss telegraph dễ đọc Low/High và reduced motion, không trùng với HUD.
8. Test replay cùng seed và action log có cùng end state; mismatch báo diagnostics.
