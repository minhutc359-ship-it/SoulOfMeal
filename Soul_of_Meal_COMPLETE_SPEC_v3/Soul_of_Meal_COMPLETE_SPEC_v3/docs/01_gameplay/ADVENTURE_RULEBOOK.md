# Adventure RPG — Executable Rules Baseline v3
**Status:** PROPOSED FOR PROTOTYPE; not approved balance. **Tick:** 30 simulation ticks/s; render 30/60 FPS independently. **Determinism:** seeded PRNG, integer HP, integer tick clocks. **Source:** `PROJECT_BIBLE.md`.

## 1. Core state
`exploring -> encounter_transition -> battle_prepare -> battle_running -> battle_end -> rewards -> exploring`. Encounters can be triggered by proximity/contact; use one trigger only per eligible enemy, with explicit cooldown. Exploration input: joystick/WASD, interaction, inventory, quest tracker, map. Battle input: target override when allowed; manual ultimate; pause (PvE only), speed setting (PvE only). Separate actor from rendering.

## 2. Party and targeting
One protagonist + up to four spirits. Front, middle and rear are tactical *spawn regions*, not rigid immobile slots. Melee actors path toward target within `attack_range`; ranged actors seek LOS and stop appropriately. Targets chosen by `taunt -> accessible enemy lowest threat-distance -> lowest HP% -> stable actor ID`. On target death, retarget next tick. Disabled, stunned or dead actors cannot attack. No ghost projectiles: projectile is spawned at animation socket but simulation decides hit at an event tick using authoritative origin/target state.

## 3. Prototype character stat model
| Field | Unit | Example/Baseline | Scope |
|---|---|---:|---|
| `max_hp`, `hp` | positive integers | Bún Bò 3000 HP at Lv1 (EXAMPLE) | Adventure only |
| `atk` | integer | 320 (EXAMPLE) | Adventure only |
| `def` | integer | 100 (EXAMPLE) | Adventure only |
| `speed` | world units/sec | 3.0 | navigation |
| `attack_range` | world units | melee 1.4, ranged 5.0 | combat |
| `attack_interval_ticks` | ticks | 45 ticks | 1.5 seconds at 30Hz |
| `energy`, `energy_max` | integers | 0/100 | ultimate |
| `crit_chance_bp` | basis points | 500 = 5% | deterministic RNG |
| `crit_multiplier_bp` | basis points | 15000 = 1.5× | deterministic RNG |

All values load from content tables and are tuned later. Do not derive from TCG/Chess stats.

## 4. Damage and status ordering
Basic formula for physical/magical under a common baseline:
`base = max(1, floor(atk * skill_coefficient_bp / 10000))`
`mitigated = max(1, floor(base * 100 / (100 + effective_def)))`
`critical = floor(mitigated * crit_multiplier_bp/10000)` if PRNG roll below crit chance; otherwise mitigated.
Then apply typed modifier (if enabled), received-damage modifiers, shields first, HP second. Do not independently apply hit from VFX callback. Sample: ATK 320, skill coefficient 15000 (=1.5), DEF 100 => base 480, mitigated 240 damage. Prototype only.

Effect order at sim tick: expire buffs -> validate actor -> pay resource -> resolve target selection -> emit cast -> apply scheduled effects -> shield absorb -> HP delta -> status effects -> death/phase transitions -> event log. Clamp HP to [0,max_hp]; negative shield is never allowed.

## 5. Status contracts
| Status ID | Tick behavior | Stacking | Counter |
|---|---|---|---|
| `burn` | DoT every 30 ticks | 3 stacks, refresh by max remaining | cleanse / fire immunity |
| `slow` | reduce speed/AS, max 40% | strongest wins | cleanse |
| `bind` | cannot translate, can cast if allowed | refresh max remaining | cleanse |
| `stun` | cannot act | duration capped for boss | cleanse / resist |
| `shield` | pool absorbs damage before HP | additive cap 40% max HP | shield break |
| `heal_over_time` | periodic healing | same caster refresh | antiheal |
| `taunt` | overrides target selection | highest-priority active source | immunity |

A buff carries `source_actor_id`, `status_id`, `expires_tick`, `magnitude_bp`, `stack`, `application_id`. Idempotency: same `application_id` never applies twice.

## 6. Energy and ultimate
Energy gain baseline: +8 per basic attack that hits, +3 on being hit (with a per-tick cap), max 100. Ultimate costs 100 energy, cooldown minimum 90 ticks; player requests `activate_ultimate(actor_id,client_input_seq)`, sim validates alive, state, energy, cooldown and timing. `cast_start` visual + `hit_schedule` rule event can be queued; animation must not override sim. On rejection show specific reason (`no_energy`, `stunned`, `cooldown`, `invalid_target`, `dead`). For PvE autoplay optional, toggle visible.

## 7. Boss behavior
Boss Bếp Trưởng Hỏa Diệm, three phase model (P0 demo):
- Phase 1 HP 100–70%: `pan_slash`, visible arc for 24 ticks then hit.
- Phase 2 HP 70–30%: fire stoves spawn; destroy 2 objects to interrupt charged ultimate within 180 ticks.
- Phase 3 HP below 30%: periodic hazards and enlarged fire arc, red telegraph 36 ticks.
- Entry guard: phase transitions happen at most once, ordered by threshold. Boss action selection uses PRNG seed; telegraph visible ≥0.5 sec for dangerous attacks; difficulty modifies *patterns + stats* explicitly, not hidden cheating.

## 8. Quest, exploration and save
World P0: village 64×48 tiles, chunk 16×16, tile 64 world units (all PROPOSED). Interactable schema has `id`, `map_id`, `kind`, `bounds`, `state`, `cooldown`, `quest_gate`, `action`. Example Lilia quest states `unavailable -> offered -> accepted -> progress -> ready_to_claim -> completed`. Chest states `locked -> available -> opened`; `opened` is persisted using account_id + chest_id, never grants twice on reload. Navigation exit changes map only after new chunk preload succeeds; rollback on failure. Quest reward claim has idempotent `reward_claim_id`.

**Chương mở đầu trong bản chơi thử:** Hương Vị Đầu Tiên. Đối thoại Lilia mở nhiệm vụ, rương mở cổng rừng, hai manh mối `forest_clue_salt` và `forest_clue_ladle` mở sân bếp Hỏa Diệm. Hai manh mối có thể lấy theo thứ tự bất kỳ. Có thể về làng giữa lúc điều tra. Khi nhận thưởng boss, người chơi quay lại gặp Lilia để nhận thưởng nhiệm vụ và mở cảnh kết. Nhật ký hiển thị mục tiêu, manh mối đã ghi và cảnh có thể đọc lại. `save.adventure.forestClues` chứa ID đã tìm, bổ sung trên schema v2. Khi nạp bản lưu đã vượt boss, nhật ký đánh dấu cả hai manh mối đã hoàn thành dựa vào cờ tiến trình.

**Chương 2 trong bản chơi thử:** Bí Mật Rừng Nguyên Liệu. Lilia mở chương sau khi người chơi nhận thưởng nhiệm vụ Chương 1. Người chơi thắp đèn Mộc rồi đèn Quang để mở đàn đá. Ấn Bát Rỗng đứng yên, bắn đạn Bóng Tối và đánh dấu mục tiêu cố định khi bắt đầu tụ sương. Ở ngưỡng 65% và 42% HP, boss báo trước đòn vào hai mục tiêu xa nhất và cả đội tương ứng. Người chơi có một lượt dùng Đèn Giữ Vị trong cửa sổ báo trước để giảm 60% hệ số sát thương của lần tụ sương đó. Tất cả số liệu là cân bằng thử nghiệm. `save.adventure.chapterTwo` lưu mốc nhiệm vụ và số đèn đã thắp, mặc định chưa bắt đầu trên bản lưu v2 cũ. Nhận thưởng đàn đá ghi ID `forest_empty_bowl_reward` trước khi mở cảnh kết tại làng.

**Chương 3 trong bản chơi thử:** Hải Vực Hương Biển. Bến thuyền mở sau khi nhận thưởng Chương 2. Phở Lam Vũ mở nhiệm vụ và hai dấu vết trên bến mở trận Tù Và Hải Triều. Ở 72% và 45% HP, boss báo trước đợt sóng với ranh giới vùng khô khác nhau. Lệnh rút lui di chuyển Vị Linh theo tick, giữ vị trí đến khi sóng qua. Sóng đánh Vị Linh còn ở vùng nước tại tick va chạm. Tuyệt kỹ và đạn đã bắt đầu bay được xử lý xong trước khi Vị Linh lùi. Số liệu là cân bằng thử nghiệm. `save.adventure.chapterThree` lưu mốc nhiệm vụ và ID dấu vết. Phần thưởng trận ghi ID `harbor_tidal_conch_reward`. Khu vực mở rộng trong bản chơi thử sau mốc nội dung P0 của D-017.

**Hồ sơ và tiến triển thử nghiệm:** Vị Linh có cấp 1–5, bốn ô trang bị và mức quan hệ riêng. Nâng cấp và chế tác tiêu hao vàng/tinh hoa. Quà dùng tinh hoa và mở ký ức ở mức Tin cậy. `save.adventure.spirits` lưu cấp, quan hệ, kho và chủ trang bị theo ID. Bản lưu v2 cũ bắt đầu với cấp 1 và kho trống. Trận Adventure tính chỉ số hiệu lực từ chỉ số gốc khi vào trận và lưu lại tỷ lệ HP sau trận. TCG và Auto Chess dùng bảng chỉ số theo chế độ.

## 9. Battle event protocol
`battle_started, actor_spawned, move_started, target_changed, cast_started, projectile_spawned, hit_resolved, shield_changed, status_applied, actor_died, boss_phase_changed, wave_completed, battle_finished, reward_claimed`. All include `{battle_id, tick, seq, source_id, target_id?, payload, rules_version}`. Deduplicate by battle_id+seq; render may arrive late but must not change rules. Replay from seed+commands+version; save snapshots per wave.

## 10. Completion & QA
- Damage sample above exactly 240 before crit/shields; 1 projectile causes at most one `hit_resolved` unless explicitly multi-hit.
- Actor below 30 FPS still deals the same damage at the same sim ticks.
- Player cannot claim chest/reward twice by rapid clicking/reload.
- Boss phase cannot rewind or skip duplicate; no invisible instant boss attacks.
- Pathfinding respects solid map tiles and avoids jitter near doors.
- Ultimate has Cast→Travel→Impact→Aftermath and works with no sound/reduced motion.
