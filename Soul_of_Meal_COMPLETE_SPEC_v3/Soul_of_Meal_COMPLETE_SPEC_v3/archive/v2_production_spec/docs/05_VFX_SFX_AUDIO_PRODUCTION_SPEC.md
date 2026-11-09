# 05 — VFX/SFX STYLE GUIDE / AUDIO-VISUAL PRODUCTION SPEC

**Phụ trách:** Technical Artist, VFX Artist, Sound Designer, Composer, Client Engineer, QA.  
**Reference:** `design_pack_v1/05_vfx_sfx_style_guide/{VFX_SFX_CONCEPT_PLATE.png,VFX_SFX_BLUEPRINT.svg}`.  
**Mục tiêu:** mỗi hệ và mỗi character có hiệu ứng riêng, đồng nhất palette/shape/motion nhưng vẫn nhận diện khi giảm graphics preset.

## A. Element art language
| Element | Color core → main → edge | Shape | Motion | Impact | Sound design |
|---|---|---|---|---|---|
| Hỏa `fire` | `#FFF3A0`→`#FF832F`→`#D43E37` | vệt đao lửa, tàn gia vị | nhanh, xoắn, bùng | radial burst, ember | whoosh nóng, crackle, nổ có thân |
| Thủy `water` | `#E2FAFF`→`#54C9F4`→`#2166BB` | giọt, vòng sóng, lụa nước | đàn hồi, trôi chảy | splash + mist | pluck nước, splash, resonance |
| Mộc `wood` | `#DEFFAA`→`#5ABF68`→`#207A5A` | dây leo, lá, nụ hoa | mọc từ gốc, cuốn | leaf bloom/entangle | lá, gỗ, dây kéo mềm |
| Quang `light` | `#FFFDE0`→`#F6D46B`→`#DE9D37` | halo, star, vòng khiên | lan rộng đều, nhẹ | crystalline flare | chuông, airy shimmer |
| Âm `shadow` | `#E4C9FF`→`#885CCB`→`#32265D` | khói tím, trăng, tinh thể | chậm rồi bùng nhanh | shadow dissolve | pulse trầm, reversed swell |

VFX phải phân biệt bằng **hình dạng & chuyển động**, không chỉ màu; người dùng mù màu vẫn nhận ra hệ. Họa tiết ẩm thực sử dụng tinh tế trong pháp ấn/tàn sáng, không để ảnh đồ ăn thật che chiến trường.

## B. FX lifecycle
```text
CREATED → PRELOADED → ATTACHED/CAST → TRAVEL (if projectile)
        → HIT/IMPACT OR MISS → AFTERMATH → DESPAWN/POOL
```
Mỗi effect có: `effect_id`, `variant`, `trigger_event`, `anchor/socket`, `layer`, `lifetime_ms`, `preload_group`, `max_instances`, `priority`, `lod_variants`, `fallback_id`, `hit_policy`.

**Nguyên tắc:** `cast VFX` có thể xuất hiện ngay khi cast; `hit FX` và `hit SFX` chỉ xuất hiện khi nhận `hit_confirmed` của attack-instance. Timeline không tạo damage. Hiệu ứng status (burn, shield, slow) tồn tại theo status gameplay, không theo số frame animation cast.

## C. Master target sizes / durations
| FX | Master px | World units/dp hiển thị | Time target | LOD |
|---|---:|---:|---:|---|
| small hit | 512² | 32–72 world | 120–250ms | 1 core + ≤4 particles Low |
| medium hit | 1024² | 80–160 world | 200–400ms | 1 core + ≤12 Low |
| slash trail | 1024×512 | 96–240 world | 180–360ms | simplified motion low |
| projectile | 512² | 24–64 world | from simulation | trail optional low |
| cast ring | 1024² | 120–260 world | 350–900ms | gradient ring low |
| shield bubble | 1024² | 150–220 world | status duration | shader/material low |
| ultimate impact | 2048² master | 240–480 world | 400–900ms | split layered variants |
| UI sparkle | 256² | 16–48 dp | 180–450ms | no flash reduced motion |

**Không tải mặc định master texture 2048px nếu runtime chỉ cần 64px**: build pipeline sinh optimized assets và atlases, hạn chế overdraw. FX trên screen-space phải tuân theo safe area/contrast.

## D. Registry bắt buộc / mẫu P0
| Effect ID | Trigger | Anchor | Priority | Fallback policy |
|---|---|---|---|---|
| `vfx_fire_slash_a` | attack visual active | `blade_tip` | medium | debug-only elemental slash |
| `vfx_fire_hit_small` | `combat.hit_confirmed` | `target.hit_center` | high | `vfx_fire_hit_medium` scaled |
| `vfx_fire_bunbo_ultimate_cast` | cast_start | `actor.spine` | high | none for final release |
| `vfx_fire_bunbo_ultimate_impact` | main confirmed hit | `target.area_center` | critical | **not allowed** in release |
| `vfx_water_cast_ring` | skill cast | `actor.feet` | low | simple water aura |
| `vfx_water_splash_medium` | projectile collision | `target.hit_center` | medium | `vfx_water_hit_small` if registered |
| `vfx_wood_heal_bloom` | heal applied | `target.spine` | medium | leaf sparkle |
| `vfx_light_shield_bubble` | shield applied | `target.shield_center` | high | 2D bright shield circle |
| `vfx_shadow_cut_01` | assassin hit | `target.hit_center` | medium | shadow cut generic |
| `vfx_tcg_trap_reveal` | card trap reveal | `ui.trap_slot` | high | card flip with glow |

Ưu tiên fallback: character-specific ability → character-common → element-common → neutral. Với ultimate 5 nhân vật mẫu, **không chấp nhận fallback hình học generic** trên release; missing primary effect cần chặn CI hoặc QA sign-off.

## E. VFX shot package & storyboard layers
Mỗi effect có file storyboard gồm:
1. `anticipation` (dự báo/cast) — cue trước damage.
2. `core` — hình chính, có phương chuyển động.
3. `trail` — nối actor và target, không xuất hiện sau impact.
4. `impact` — bắt buộc đúng collider/area center.
5. `aftermath` — mờ rồi được pool, không giữ particle bất tử.
6. `reduced_motion` và `low_graphics` — biến thể giản lược nhưng giữ dấu hiệu gameplay.

Ví dụ `vfx_fire_bunbo_ultimate_impact`: anticipation pháp ấn chiếc tô → slash hỏa đao → vòng lửa chạm target → vòng shock lan → tàn gia vị bay ra → fade. Có thể chuyển texture thành mesh trail, particle và light decal; không chỉ là một video phủ màn hình làm mờ chiến đấu.

## F. Budgets & rendering
Các giá trị dưới là **đích thử nghiệm cho prototype**, cần profiler thật trước khi khóa:
- Dynamic effects active: đề xuất ≤30 FX nhỏ đồng thời cho máy trung bình và priority-based pooling; boss/ultimate được ưu tiên hiển thị.
- UI particles không chiếm nhiều GPU overdraw; khi có multi-hit 5 units, giảm số lượng trail ở ngoài vùng focus.
- Chỉ một cinematic overlay full-screen; VFX priority thấp có thể skip khi tải cao mà không thay damage.
- Texture atlas ≤2048²/trang như khuyến nghị v1; cập nhật số trang/texture memory qua build report.
- Telegraph của boss/bẫy có phiên bản High/Low và Reduced Motion, không bị cắt mất trong setting Low.
- Cấm flash trắng liên tục hoặc strobe mạnh; không dùng camera shake > vùng đọc của HUD.

## G. Audio architecture
```text
MASTER
  ├─ MUSIC   (home / exploration / battle / boss stems)
  ├─ AMBIENCE (weather / village / forest / sea)
  ├─ SFX     (UI / combat / footsteps / card / economy)
  └─ VOICE   (story / greetings / skills / ultimate)
```
Có mixer group volume per-user (0–100%), mute, persistence. Source WAV PCM 48kHz 24bit; runtime OGG/Opus hoặc fallback cần kiểm tra theo browser. BGM loop metadata `loop_start_ms`, `loop_end_ms`, `bpm` và `bars` nếu adaptive.

## H. SFX registry: samples + timing
| ID | Trigger | Target length | Priority | Voice limit |
|---|---|---:|---|---|
| `sfx_ui_confirm` | accepted button input | 80–180ms | medium | max 2/100ms |
| `sfx_ui_error` | rejected input | 120–220ms | high | max 1/200ms |
| `sfx_page_open` | panel opened | 150–250ms | low | 1 per modal |
| `sfx_card_draw` | TCG draw event | 250–400ms | medium | max 3 |
| `sfx_tcg_trap_flip` | trap reveals | 300–550ms | high | 1 chain group |
| `sfx_shop_buy` | Auto Chess buy confirmed | 150–250ms | medium | max 2/120ms |
| `sfx_star_upgrade` | merge succeeded | 600–1100ms | high | 1 per upgrade |
| `sfx_fire_whoosh_a` | slash swing | 180–300ms | medium | max 3 |
| `sfx_blade_impact` | hit confirmed | 150–260ms | high | max 4 nearby |
| `sfx_water_splash_medium` | water projectile hit | 300–600ms | medium | positional |
| `sfx_fire_blast_large` | ultimate impact | 700–1500ms | critical | exclusive 1–2 |
| `sfx_victory_fanfare` | result | 1.5–3s | high | exclusive |
| `vo_chr_bunbo_ultimate_vi` | valid ultimate start | 1–2s | critical | character exclusive |

File naming: `sfx_{context}_{action}_{variant}_v###.ogg`, `vo_{chr}_{trigger}_{locale}_v###.ogg`. Runtime key không bao gồm version; hash cache do bundle đảm nhiệm.

## I. BGM identity and transition
Một leitmotif Soul of Meal (8–16 bars) hiện diện trong Home, Làng Ẩm Thực, battle, victory, boss ở các cách phối khí khác nhau. Âm sắc gợi ý: đàn tranh/sáo trúc + piano/strings + bộ gõ fantasy; phải là sáng tác riêng hoặc có giấy phép.

| Track ID | Scene | Transition |
|---|---|---|
| `bgm_home_village` | home / village | loop steady, nhẹ |
| `bgm_forest_explore` | forest | xfade khi vào zone |
| `bgm_sea_explore` | sea | xfade, ambient wave layer |
| `bgm_volcano_explore` | volcano | xfade, tension stem |
| `bgm_adventure_battle` | regular battle | switch at musical boundary nếu có grid |
| `bgm_boss_hoadiem` | boss | intro → loop → climax |
| `bgm_tcg_match` | TCG | tactical loop; avoid long cut-in |
| `bgm_autochess_match` | Auto Chess | round phase variants |
| `bgm_gacha_reveal` | summon | sting when rarity reveal |

Crossfade tham khảo 0.5–1.5s; full cut-in voice → giảm mức BGM (duck) theo automation bus, trả mức khi voice kết thúc. Chuyển chunk không reset cùng track.

## J. Audio/visual event example
```json
{
  "event_id":"evt_impact_01",
  "type":"combat.hit_confirmed",
  "instance_id":"act_fire_slash_01",
  "timestamp_ms":320,
  "actor_id":"chr_bunbo_holinh_ally_01",
  "target_id":"enemy_001",
  "payload":{"impact_point_world":{"x":1024,"y":512},"vfx_id":"vfx_fire_hit_small","sfx_id":"sfx_blade_impact","priority":"high"}
}
```
Presentation phải tự xác định audio occlusion/volume theo khoảng cách, nhưng chỉ bắt đầu khi event được xác nhận. Event duplicate không play impact 2 lần nếu cùng action.

## K. Accessibility / safety / QA
- `reduced_motion`: tắt shake, parallax mạnh, flash, chromatic aberration; giữ telegraph/target outline.
- Phụ đề cho voice và story; boss warning vừa có biểu tượng vừa có âm thanh.
- SFX quan trọng không bị quá nhỏ so với BGM; không clipping khi nhiều units trúng cùng lúc.
- Background tab/browser: suspend hoặc mute thích hợp; resume bằng user gesture nếu API yêu cầu, tránh hai music instances.
- QA với 5 hệ và 3 mode, 4 preset `High / Medium / Low / Reduced Motion`, test ít nhất PC + Android/iOS browser đích.

**Đạt chuẩn:** mỗi VFX có ID, source, runtime variants, socket/layer/lifetime/fallback/owner/license; mỗi SFX có event trigger, voice limit, bus, length, master WAV; hit được hiển thị đúng nơi/đúng lúc; không còn missing effect ở 5 Vị Linh P0.
