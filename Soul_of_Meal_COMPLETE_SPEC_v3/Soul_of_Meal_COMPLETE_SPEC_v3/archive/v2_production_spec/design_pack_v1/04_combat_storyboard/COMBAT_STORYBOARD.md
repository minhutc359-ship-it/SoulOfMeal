# 04 — Combat Storyboard / Animation & Damage Timing

**Nguyên tắc:** từng hành động có storyboard key-pose + timeline frame + combat logic event + VFX socket + SFX event. Gameplay không được suy diễn `hit` từ số frame đang hiển thị vì dropped frames, speed-up hoặc reconnect sẽ làm sai kết quả.

## A. Storyboard convention

- **FPS tham chiếu:** 60 FPS (1 frame = 16.67 ms). Dữ liệu combat chạy fixed tick theo thiết kế engine; animation time là lớp hiển thị.
- **Góc camera:** Adventure battle side-isometric (camera xéo 20–35°); TCG fixed top-oblique; Auto Chess fixed top-oblique, zoom hạn chế.
- **Focal safe zone:** HUD không trùng cut-in/telegraph, vùng UI xung quanh 48 dp tránh overlay toàn màn.
- **Action ID:** `{actor_id}:{ability_id}:{instance_uuid}`; damage resolve phải idempotent.
- **Events tối thiểu:** `cast_start`, `target_lock`, `projectile_spawn`, `hit_confirmed`, `damage_applied`, `status_applied`, `impact_fx`, `sfx_play`, `cast_complete`.
- **Damage events** lấy từ combat rules; animation xử lý dựa event và có cơ chế catch-up khi frame bị bỏ.

## B. Storyboard 01 — Đòn thường cận chiến Bún Bò Hỏa Linh

**Animation:** `chr_bunbo_holinh.attack_a` • **Total:** 30f / 0.50s • **Range:** 1.25 tile (~80 units).

| Key pose/frame | Hành động | VFX/SFX | Logic |
|---|---|---|---|
| F00–F05 | bước chân trước, mắt khóa mục tiêu, rút đao | `sfx_step_light` F03 | validate range/target |
| F06–F11 | hạ trọng tâm, vũ khí nạp sắc cam | `vfx_fire_anticipation_small` F08 | cast_start |
| F12–F17 | chém từ thấp lên cao theo cung ~90° | `vfx_fire_slash_a` F13; `sfx_fire_whoosh_a` | hit-window mở |
| **F18** | đao chạm địch, flash nhỏ tại collider | `vfx_fire_hit_small`, `sfx_blade_impact` | **hit_confirmed → damage_applied** |
| F19–F24 | địch giật lùi 8–16 world units; hạt tàn lửa bay | `sfx_enemy_hit_short` | status optional |
| F25–F29 | quay về guard pose, khóa animation kết thúc | fade residual FX | cast_complete |

- Nếu mục tiêu chạy khỏi range trước F18: ruleset áp dụng `miss` theo lock-on policy, không để hit VFX hiển thị nếu hit bị từ chối.
- Trong Auto Chess, có thể tái dùng track attack A với animationSpeed 1.1–1.3, nhưng hit-confirm time do simulation quyết định.

## C. Storyboard 02 — Đạn ma thuật Phở Lam Vũ

**Animation:** `chr_pho_lamvu.skill_01` • **72f / 1.2s** • Projectile travel 24–36f theo khoảng cách.

| Frame | Nội dung | Event |
|---|---|---|
| 0–11 | tay nâng, vòng nước ở dưới chân, giọt nước ngược trọng lực | `cast_start`, `vfx_water_cast_ring` |
| 12–23 | ấn phép sáng; khối nước gom ở đầu trượng | `sfx_water_gather`, `charge_ready` |
| 24 | viên đạn nước phát ra từ socket `hand_r`/`muzzle` | `projectile_spawn` |
| 25–47 | viên đạn bay dọc quỹ đạo cong nhẹ về target snapshot; trail có độ rộng giảm | projectile travel events |
| 48 | đạn chạm collider địch; sóng nước mở rộng, splash | `hit_confirmed`, `damage_applied`, `vfx_water_splash_medium` |
| 49–60 | slow/status icon hiện; water mist mờ | `status_applied` |
| 61–71 | trả tay về idle; tan vòng cast | `cast_complete` |

Nếu mục tiêu mất đi trong lúc đạn đang bay, quy tắc phải định nghĩa rõ: projectile homing đến target còn sống; khi target không hợp lệ thì đạn giải thể và không đánh trúng mục tiêu khác trừ khi có tag `piercing` hoặc `retarget`.

## D. Storyboard 03 — Ultimate Bún Bò Hỏa Linh

**Skill ID:** `skill_bunbo_ngonluaamthuc` • **150f/2.50s** • render cinematic có thể rút gọn xuống ~60f nếu bật `short_ultimate` nhưng damage/event giữ đúng.

| Frame | Shot & camera | Character | VFX | Audio/Event |
|---|---|---|---|---|
| 000–017 | arena camera 1.0→1.08× | đứng tấn, giơ hỏa đao | `vfx_fire_ultimate_cast` | cast_start; low whoosh |
| 018–047 | close-up 2D cut-in anime HD, camera pan nhẹ | mắt rực lửa, câu thoại | ribbon fire + pháp ấn chiếc tô | `vo_chr_bunbo_ultimate_vi`; BGM duck -4dB |
| 048–063 | trở về arena góc chéo; speed-ramp | lao tới, vũ khí kéo vệt | `vfx_fire_dash_trail` | `sfx_fire_dash` |
| **064–072** | camera tracking | chém A rồi B | hai slash arc khác nhau | hit_1 F64, hit_2 F72; damage pulses |
| 073–099 | camera cao hơn để nhìn AoE | nhân vật xoay vòng | pháp ấn nguyên liệu ngưng tụ | target AoE telegraph rõ |
| **100–110** | impact freeze 2–3f rồi bật sáng | đòn kết liễu | `vfx_fire_bunbo_ultimate_impact` | F100 main hit + sfx_blast |
| 111–125 | camera pull-back | ngửa vai, hơi thở | explosion dissipate, food-shaped sparkles | status_burn (nếu có) |
| 126–149 | camera trở về preset | trở lại idle/combat | giảm overlay; HUD fully visible | cast_complete, BGM normal |

**Timing rule:** AoE damage được tính tại `F100 main_hit`, trừ thiết kế `multi_hit` đã chốt; không tính damage riêng từ bóng sáng ảnh. Chặn stacked ultimate: một camera cinematic tại một thời điểm, ultimate thứ hai xếp hàng/hình thức rút gọn.

## E. Storyboard 04 — Bánh Bao tạo khiên

**Total:** 60f/1.0s. F00–10 nhún thân; F11–23 hít mạnh và phồng; F24 tạo bubble tại socket `shield_center` kích thước 150–220 units; F25–47 duy trì shimmer; F48–59 hạ về idle. Shield có state `active`, `absorbing`, `breaking`, `expired` và mỗi state có VFX/SFX. Shield gameplay duy trì theo duration ruleset, **không** gắn chặt 60 frames hoạt ảnh cast.

## F. Storyboard 05 — Boss Bếp Trưởng Hỏa Diệm

- **Telegraph lớn:** 0.9–1.3 s hình quạt đỏ trong arena, viền rõ, giữ HUD đọc được; có SFX báo trước.
- **Cast:** 0.7 s, boss nâng chảo/lò; hit area lock theo ruleset.
- **Impact:** 0.25 s, bùng lửa trong vùng cảnh báo; người chơi được đánh giá né/che chắn dựa combat position lúc hit tick.
- **Phase shift:** HP threshold 65%, 30%, có 1.0–1.5s animation + voice. Không đổi phase trong khi cutscene ultimate của player đang chạy nếu sẽ phá hit timing.
- **Accessibility:** warning icon + outline animation, không chỉ dựa màu đỏ.

## G. Storyboard 06 — TCG: Thẻ Vị Linh + bẫy phản ứng

| Giai đoạn | Thời lượng | Bàn đấu/đối tượng | Kết quả logic |
|---|---:|---|---|
| `card_select` | 100ms | card nâng khỏi hand + highlight ô hợp lệ | không đổi state |
| `card_commit` | 180ms | card di chuyển đến ô | request validated |
| `unit_summon` | 450ms | card glow → standee/chibi xuất hiện | summon effect apply |
| `attack_declare` | 220ms | hiển thị đường chỉ mục tiêu + icon kiếm | mở response window |
| `trap_flip` | 400ms | lá úp quay 180°, highlight trap slot | trap trigger enters stack |
| `reaction_stack` | theo người chơi | hai/ba hiệu ứng xếp thứ tự rõ | no damage until resolution |
| `resolve_impact` | 350ms | va chạm tại chính unit/hero | apply card rules |
| `end_resolution` | 150ms | HUD update + clear stack | next priority |

**Ví dụ bẫy:** quân Hỏa tuyên bố tấn công → trap `Bẫy Ngon Tuyệt Hảo` xoay mở → popup card title và hiệu ứng counter → unit địch nhận status/chết nếu hợp lệ → đường tấn công biến mất nếu attacker không còn hợp lệ.

TCG **không** dùng con số HP Adventure/Auto Chess; defense của unit là durability theo luật TCG; hero HP mục tiêu demo 8.000. Các con số cân bằng cuối cùng thuộc ruleset và UI data-binding, không bake vào art.

## H. Storyboard 07 — Auto Chess: Mua quân → nâng sao → giao chiến

| Event | Visual | SFX | Duration |
|---|---|---|---:|
| `shop.buy` | card shop shrink rồi bay tới bench slot | `sfx_shop_buy` | 200ms |
| `bench.drag` | unit nâng 10dp, tile hợp lệ pulse | `sfx_pick_unit` | theo gesture |
| `unit.merge` | 3 bản sao kéo về tâm, tia sao, unit nâng cấp | `sfx_star_upgrade` | 650ms |
| `round.prepare_end` | countdown 3–2–1, board lock | `sfx_round_start` | 3.0s |
| `round.combat_start` | quân chibi tiến đến vị trí tấn công | combat SFX | ruleset |
| `round.result` | result ribbon + gold/XP | `sfx_victory_small` | 800ms |

Nhiều units cùng ultimate thì ưu tiên FX budget theo `importance`: boss/hero > gần camera > xa; tắt camera shake cho các unit xa.

## I. Hit validation và đồng bộ

**Pipeline:** Input/AI → action request → rules validation → combat event (authoritative) → animation/VFX/SFX rendering → result UI. Trong PvP backend authoritative; PvE local có thể simulation deterministic nhưng cùng event protocol.

```json
{
  "event_id": "evt_8ef2",
  "battle_id": "battle_102",
  "tick": 2890,
  "type": "combat.hit_confirmed",
  "action_instance_id": "act_31d2",
  "actor_id": "chr_bunbo_holinh",
  "target_id": "enemy_mushroom_01",
  "skill_id": "skill_bunbo_ngonluaamthuc",
  "damage": 532,
  "element": "fire",
  "world_pos": { "x": 504, "y": 272 },
  "visuals": ["vfx_fire_bunbo_ultimate_impact", "sfx_fire_blast_large"]
}
```

Damage numbers xuất hiện theo event ID, tối đa 1 popup chính và có aggregation khi multi-hit; không hiện `9999` chỉ để đẹp nếu damage thực là 532. Khi `reduce_motion`, vẫn phải hiển thị hit-confirm, hiệu ứng trạng thái và số sát thương.

## J. QA acceptance

1. Chạy hit test tại 30/60 FPS, slow/fast speed, replay: damage và status giống nhau.
2. Player/địch chết giữa animation: cancel/cleanup sạch projectile/VFX/camera lock.
3. Đường đạn originate đúng muzzle, collide đúng target; không có “tia đạn bị mất”.
4. 5 Vị Linh xuất hiện ở cả ba chế độ với cùng signature VFX, scale phù hợp.
5. TCG: stack reaction có thứ tự rõ, không phát bẫy trước khi được trigger; Auto Chess: shop không tương tác khi đang combat.
6. Camera không che skill/timer/hero HP; skip cut-in không skip damage hoặc đổi outcome.
