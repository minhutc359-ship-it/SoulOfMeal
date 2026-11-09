# 05 — VFX / SFX / Music Style Guide

**Mục tiêu:** mọi đòn đánh, UI interaction, map ambience và tuyệt kỹ thuộc một ngôn ngữ mỹ thuật/âm thanh, được gọi bằng event có thể kiểm thử. “Hiệu ứng theo hệ” không thay thế hiệu ứng đặc trưng theo nhân vật.

## A. VFX visual language

| Element | Màu lõi → rìa | Shape vocabulary | Motion | Impact signature |
|---|---|---|---|---|
| `fire` Hỏa | `#FFF3A0` → `#FF832F` → `#D43E37` | lưỡi lửa, vệt đao cong, tàn lửa hình gia vị | nhanh, xoắn, bùng | đốm lửa + blast + heat haze |
| `water` Thủy | `#E2FAFF` → `#54C9F4` → `#2166BB` | giọt nước, vòng sóng, bọt, ruy băng nước | uốn lượn, đàn hồi | splash + ring + mist |
| `wood` Mộc | `#DEFFAA` → `#5ABF68` → `#207A5A` | lá, dây leo, nụ hoa, rễ cây | mọc, cuốn, lan tỏa | leaf burst + vine pin |
| `light` Quang | `#FFFDE0` → `#F6D46B` → `#DE9D37` | tia sao, vòng hộ vệ, ribbon ánh sáng | nhẹ, đều, lan tròn | luminous halo + bell flash |
| `shadow` Âm | `#E4C9FF` → `#885CCB` → `#32265D` | sương tím, mặt trăng, tinh thể vụn, vết cắt trăng | chậm, lơ lửng, bùng bất ngờ | shadow burst + dissolve |

### Mẫu hiệu ứng theo từng tầng

Mỗi VFX có tối thiểu các cấu phần khi hợp lý:

1. `anticipation`: dấu hiệu người chơi đọc trước động tác (không làm bằng flash ngẫu nhiên).
2. `core`: shape đẹp nhất, giữ contrast với background và actor.
3. `trail`: kết nối hướng chuyển động và nguồn phóng.
4. `impact`: thông báo chính xác vùng bị đánh.
5. `aftermath`: dư âm tan sạch, không để particle bất tử.

**Đặc trưng món ăn:** dùng họa tiết gia vị, thìa, nồi hoặc nguyên liệu cách điệu trong magic seal/sparkle, không biến VFX thành hình ảnh thực phẩm chụp thật; không chèn hình món ăn lớn che trận.

### Hiệu ứng riêng vs fallback

Priority:

`character-specific ability` → `character common` → `element common` → `neutral common`.

Ví dụ `vfx_fire_bunbo_ultimate_impact` là primary; nếu thiếu phải flag trong production validation, chỉ dùng `vfx_fire_hit_medium` ở debug, không chấp nhận fallback hình học đơn giản trong release cho ultimate của 5 nhân vật mẫu.

## B. Kích thước và thời gian effect

| Category | Canvas master / design size | World scale | Duration target | Atlas |
|---|---:|---:|---:|---|
| small hit | 512×512 px | 32–72 units | 120–250ms | ≤1024×1024 |
| medium hit | 1024×1024 px | 80–160 units | 200–400ms | ≤2048×2048 |
| slash trail | 1024×512 px | 96–240 units | 180–360ms | ≤2048×2048 |
| projectile | 512×512 px source | 24–64 units | travel dependent | atlas common |
| cast ring | 1024×1024 px | 120–260 units | 350–900ms | atlas common |
| shield bubble | 1024×1024 px | 150–220 units | game-state dependent | mesh/shader |
| ultimate impact | 2048×2048 px master | 240–480 units | 400–900ms | split layers if necessary |
| UI sparkle | 256×256 px | 16–48 dp | 180–450ms | shared atlas |

World unit và source pixel là hai đơn vị khác nhau. Texture đủ nét khi scale nhưng không bắt runtime tải asset 2048px nếu chỉ render 50px; dùng optimized variants/atlases.

**Hướng dẫn cường độ:** focus vào actor và hit point; không phủ kín UI; area telegraph có biên và hướng an toàn rõ ràng. Impact freeze 1–3 frame chỉ áp dụng trên các điểm lớn và không làm frozen toàn gameplay logic.

## C. VFX registry sample

| VFX ID | Trigger | Hook | Layer | Importance |
|---|---|---|---|---|
| `vfx_fire_slash_a` | attack at F13 | `blade_tip` | above actor, below foreground | medium |
| `vfx_fire_hit_small` | `combat.hit_confirmed` | `target.center` | above target | medium |
| `vfx_fire_bunbo_ultimate_cast` | `cast_start` | `actor.spine` | behind actor | high |
| `vfx_fire_bunbo_ultimate_impact` | main hit | `target.area_center` | arena VFX | critical |
| `vfx_water_cast_ring` | skill cast | `actor.feet` | below actor | low |
| `vfx_water_splash_medium` | projectile impact | `target.center` | above target | medium |
| `vfx_wood_heal_bloom` | heal confirmed | `target.spine` | above target | medium |
| `vfx_light_shield_bubble` | shield applied | `target.shield_center` | around actor | high |
| `vfx_shadow_cut_01` | assassin hit | `target.center` | above target | medium |
| `vfx_tcg_trap_reveal` | trap resolved | `ui.trap_slot` | UI VFX | high |
| `vfx_chess_merge_star` | merge event | `board.cell` | above board | high |

## D. VFX format/pipeline

- Source có layer hoặc effect graph: sprite sheet/Spine animation/shader/light mesh theo khả năng engine.
- Engine export WebP PNG alpha + atlas JSON, shader parameters và effect spawn config. Không hardcode đối tượng FX bằng random shapes ở gameplay component.
- Alpha premultiplied setting phải đồng nhất với renderer; kiểm tra halo đen khi blend.
- Particle seed do battle event cung cấp nếu muốn replay nhất quán.
- `spawn`, `pause`, `resume`, `cancel`, `destroy` cần dọn timers và texture refs khi scene unload.
- VFX scale theo `unit_size`, không theo raw screen width. Auto Chess LOD low được phép giảm mật độ particle, không được mất tín hiệu hit/target.

### Performance budget (mục tiêu sơ bộ, phải đo trên thiết bị)

| Preset | Active particles toàn cảnh | FX texture memory | Notes |
|---|---:|---:|---|
| Low mobile | ~120 | ≤48 MB | disable distortion; short trails |
| Medium mobile | ~250 | ≤80 MB | limited additive overlap |
| High desktop | ~650 | ≤160 MB | layered ultimate & distortion |

- Max additive full-screen flashes: dưới 100ms; khi `reduced_motion` dùng highlight mờ và tránh flash/shake.
- Pool FX objects: giới hạn số simultaneous effect, ưu tiên `critical > high > medium > low`; tuyệt đối không drop gameplay telegraph.
- Ưu tiên mipmap/texture compression khi phù hợp, tránh sprite 2048px cho particle 12px.

## E. SFX audio language

### E1. Bus routing

```text
Master
 ├── Music       (BGM, stingers)
 ├── Ambience     (wind, village, forest, sea)
 ├── SFX_Gameplay (attack, impact, spell, card, chess)
 ├── SFX_UI       (click, toast, menu)
 └── Voice        (dialogue, cast, ultimate, alerts)
```

**Bản mix đề xuất:** master true peak ≤ -1dBTP. BGM tham chiếu khoảng -18 LUFS integrated theo track; kiểm tra bằng tai và meter sau khi trộn; voice có priority cao hơn BGM. Duck Music khoảng -4 dB trong voice ultimate và reset theo envelope 150–350ms. Không hardcode một target LUFS cho mỗi SFX ngắn vì đo integrated LUFS trên đoạn quá ngắn thường thiếu ổn định.

### E2. SFX theo hệ

- **Fire:** whoosh có độ nóng, tiếng nổ khô, crackle nhẹ, kim loại nóng khi sword hit.
- **Water:** drip, swirl, splash, bubble; tránh SFX nghe như tiếng nước dội bồn vệ sinh.
- **Wood:** leaf rustle, fiber stretch, branch crack, gentle bloom resonance.
- **Light:** harp/soft bell, crystalline shimmer, shield resonant hum.
- **Shadow:** low airy sweep, reversed textures, delicate chime, restrained bass pulse.

Cần thiết kế SFX theo cùng palette nhạc tính để không nghe như tải từ nhiều thư viện không liên quan.

### E3. Event IDs, duration, concurrency

| ID | Event | Length | Concurrency / rule |
|---|---|---:|---|
| `sfx_ui_confirm` | primary CTA tapped | 90–140ms | max 1/80ms |
| `sfx_ui_cancel` | back/cancel | 70–110ms | max 1/80ms |
| `sfx_page_open` | modal opens | 150–250ms | 1 per modal |
| `sfx_card_draw` | draw a card | 250–400ms | max 3 simultaneous |
| `sfx_tcg_trap_flip` | trap flips | 300–550ms | 1 active chain group |
| `sfx_shop_buy` | buy unit | 150–250ms | max 2/120ms |
| `sfx_star_upgrade` | Chess upgrade | 600–1100ms | priority high |
| `sfx_fire_whoosh_a` | sword slash | 180–300ms | voice group max 3 |
| `sfx_blade_impact` | contact | 150–260ms | max 4 nearby |
| `sfx_water_splash_medium` | projectile hit | 300–600ms | distance attenuated |
| `sfx_fire_blast_large` | ultimate impact | 0.7–1.5s | priority critical, music duck |
| `sfx_victory_fanfare` | victory result | 1.5–3.0s | 1 + music transition |
| `vo_chr_bunbo_ultimate_vi` | ultimate speech | 1.0–2.0s | voice exclusive per actor |

**Naming:** `sfx_{context}_{action}_{variant}`, `vo_{char_id}_{trigger}_{locale}`. Các file không chứa dấu, ví dụ `assets/audio/sfx/sfx_tcg_trap_flip_v001.ogg`.

### E4. Audio file spec

| Category | Production source | Runtime | Mono/stereo |
|---|---|---|---|
| BGM | WAV 48 kHz / 24-bit | OGG Vorbis/Opus + fallback compatible | Stereo loop |
| Ambience | WAV 48 kHz / 24-bit | OGG/Opus | Stereo/mono depending 3D |
| SFX | WAV 48 kHz / 24-bit | OGG + optional MP3 fallback | Mono positional, stereo UI |
| Voice | WAV 48 kHz / 24-bit | OGG/Opus + fallback | Mono |

BGM cần metadata `loop_start_ms`, `loop_end_ms` và stem layers nếu adaptive. File cần thời gian đầu/cuối hợp lý, không bị click/pop.

## F. Music identity / adaptive transitions

**Nhạc chủ đề:** `bgm_main_hanhtrinhvigiac`: melody 8–16 bars có thể phối khí lại theo khu vực. Instrument palette: đàn tranh/sáo trúc + piano/strings/flute + percussion fantasy nhẹ.

| BGM ID | Scene | Layers |
|---|---|---|
| `bgm_home_village` | home/làng | melody, acoustic rhythm, daytime ambience |
| `bgm_forest_explore` | rừng | wind flute, string pads, small chimes |
| `bgm_sea_explore` | biển | harp, piano, light wave pad |
| `bgm_volcano_explore` | núi lửa | drums, brass low, tension strings |
| `bgm_adventure_battle` | normal battle | base, percussion, high tension |
| `bgm_boss_hoadiem` | boss | boss motif, percussion, brass, climax |
| `bgm_tcg_match` | TCG | thoughtful loop with rhythmic escalation |
| `bgm_autochess_match` | Auto Chess | tactical rhythmic orchestral |
| `bgm_gacha_reveal` | gacha | rising magical phrase + rarity sting |

- Switch BGM tại bar/beat boundary nếu track có BPM grid, crossfade 0.5–1.5s; không reset cùng track khi scene chunk đổi.
- Khi mở voice/ultimate, duck BGM; victory ưu tiên kết đoạn ở cadence musical không cắt ngang mạnh.
- Dùng bản thu/composition sở hữu hoặc license rõ ràng, không dùng nhạc game tham khảo.

## G. UI/audio accessibility

- Settings: Music / SFX / Voice / Ambience riêng, mute persist per user.
- `reduced_motion`: disable screen shake, strong brightness flashes; giữ âm báo important và icon trạng thái.
- Subtitle cho voice/story và visual notification cho cảnh báo boss; không dùng audio là nguồn duy nhất cho telegraph.
- Khi app/browser bị background hoặc tab pause: pause/mute BGM, resume bằng user gesture khi trình duyệt yêu cầu; tránh nhiều AudioContext.

## H. QA acceptance

1. 5 hệ có palette và signature dễ phân biệt ngay cả khi chỉ nhìn silhouette đen/trắng của core effect (đảm bảo khác shape, không chỉ màu).
2. `impact_fx` & `impact_sfx` diễn ra tại `hit_confirmed`, không trước khi damage hợp lệ.
3. Boss telegraph luôn hiển thị ở Low preset; camera shake không làm mất HUD.
4. Không có sound clipping và voice ultimate nghe rõ trên BGM; không có 2 BGM chạy chồng do route change.
5. Mỗi asset FX có `fallback`, `priority`, `max_instances`, `lifetime_ms`, `preload_group` trong manifest; asset missing có log/chỉ báo QA.
