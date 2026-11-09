# 01 — Character Sheet / Character Bible

**Mục đích:** artist có thể vẽ đúng cùng một nhân vật ở illustration, chibi, card và animation; developer có thể gắn asset và event bằng ID ổn định.

## A. Cấu trúc một sheet bàn giao

1. **Turnaround:** front, 3/4 front, side, back + close-up mặt, tóc, phụ kiện, vũ khí.
2. **Proportion & palette:** thước đo chiều cao, các điểm khớp, palette mã màu; đường silhouette đen để kiểm tra nhận diện.
3. **Expression:** 8 biểu cảm bắt buộc: `neutral`, `smile`, `laugh`, `surprised`, `angry`, `sad`, `hurt`, `victory`; 4 biểu cảm tùy chọn `sleepy`, `shy`, `determined`, `thinking`.
4. **Motion:** contact sheet pose key của idle, walk, run, attack A/B, cast, hit, stun, victory, defeat, interact.
5. **VFX hook:** tay vũ khí, muzzle, foot, center, head, body, projectile origin; định nghĩa chính xác offset.
6. **Equipment/variants:** màu hệ, skin, icon, biến thể card; không đổi silhouette lõi khi dùng skin.

## B. Chuẩn tỷ lệ và bàn giao file

| Item | Design target | Format bàn giao | Ghi chú |
|---|---:|---|---|
| Illustration toàn thân | 2048 × 3072 px | PNG RGBA + source PSD/KRA | transparent, 300 px safe margin |
| Portrait/hội thoại | 2048 × 2048 px | PNG RGBA + layer mặt/tóc | có thể rig mắt, miệng |
| Card artwork | 768 × 1024 px | WebP + PNG master | art không chứa chữ/khung bài |
| Ultimate cut-in | 2048 × 1152 px | PNG RGBA / texture atlas | 16:9, không ghép chữ |
| Chibi turnaround | 2048 × 2048 px/board | PNG/PDF nội bộ | 4 góc nhìn tối thiểu |
| Chibi in-game | 80–112 world px cao, gốc tại chân | Spine/mesh atlas hoặc sprite | art source cao ≥ 768 px |
| Combat character | 112–160 world px cao | dùng cùng rig/variant | không cần asset người khác |
| Icon nhân vật | 512 × 512 px master | SVG nếu vector / WebP | safe circle 80% |
| Icon skill | 256 × 256 px master | PNG/WebP | không đặt text trong icon |
| Atlas một nhân vật | ≤ 2048 × 2048 px/trang (khuyến nghị) | WebP/PNG | tối ưu theo thiết bị |
| Frame rate | render 60 FPS; keyframe author 24–30 FPS | runtime interpolated | không giả định sprite 60 frame/s |

**Tỷ lệ:** chibi nhân vật humanoid khoảng 2.4–2.8 đầu; Bánh Bao là mascot tỉ lệ 1.1–1.4 đầu. Mọi model bám sát key art. Vũ khí/phụ kiện xác định bên tay: không flip tùy tiện nếu làm sai thiết kế bất đối xứng.

**Anchor:** gốc local `(0,0)` tại bàn chân trung tâm; trục Y dương xuống đối với runtime screen-space; combat hitbox tách riêng hình thể, không dùng rìa tóc/đồ để quyết định va chạm. NPC và humanoid chibi cùng thang chiều cao.

## C. Năm Vị Linh mẫu chuẩn

| ID ổn định | Tên | Silhouette & màu | Vũ khí/đặc trưng | Element, role |
|---|---|---|---|---|
| `chr_bunbo_holinh` | Bún Bò Hỏa Linh | tóc đỏ cam, trang phục đầu bếp-chiến binh đỏ vàng, ruy băng lửa | hỏa đao/chảo lửa, họa tiết ớt và gia vị | fire, fighter |
| `chr_pho_lamvu` | Phở Lam Vũ | tóc xanh lam/bạc, áo lụa mềm, dải sóng | trượng/đũa phép nước và hơi nước | water, mage |
| `chr_goicuon_diepnhi` | Gỏi Cuốn Diệp Nhi | tóc xanh lá sáng, hoa/lá trên tóc | dây leo, quạt lá | wood, support |
| `chr_banhbao_bachngoc` | Bánh Bao Bạch Ngọc | mascot trắng kem tròn, má hồng, mũ đầu bếp | thìa gỗ, bong bóng lá chắn | light, guardian |
| `chr_caphe_davu` | Cà Phê Dạ Vũ | tóc tím than, áo khoác sâu màu, điểm vàng đồng | song dao/tinh thể cà phê, bóng tối | shadow, assassin |

### C1. Character Sheet mẫu: Bún Bò Hỏa Linh

- **Face reference:** mắt hổ phách to, lông mày mạnh, nụ cười tinh nghịch; má hồng nhẹ. Không nhầm màu mắt với tóc.
- **Costume:** lớp áo trắng kem, giáp đỏ nâu, nơ đỏ, đường chỉ vàng; mũ đầu bếp biến tấu nhỏ; vũ khí lửa không che silhouette mặt.
- **Palette (đề xuất):** tóc `#E45A3B`; lửa lõi `#FFE17A`; lửa chính `#FF7B31`; vải kem `#FFF1DA`; đỏ chính `#B92D3F`; nâu tối `#4A2F35`.
- **Turnaround:** mặt trước nhìn toàn thân; 3/4 với dao rõ; side xác định độ dày vai/giáp; back thấy buộc tóc và dải ruy băng.
- **Các điểm hook rig:** `head`, `hand_r`, `blade_tip`, `spine`, `feet`, `hip`, `fx_back`, `target_lock`.
- **8 biểu cảm:** neutral hơi tự tin; smile rạng rỡ; laugh mắt nhắm; surprised mở tròn mắt; angry cắn răng; sad mắt cụp; hurt nhăn mặt; victory cười giơ vũ khí.
- **Ultimate:** `Ngọn Lửa Ẩm Thực` (được mô tả chính xác trong Combat Storyboard).

### C2. Biến thể hình ảnh giữa chế độ

- **Adventure:** cùng chibi rig, blending đi/chạy, 4–8 hướng nhìn, hiệu ứng footprint, shadow ellipse bên dưới chân.
- **Adventure battle:** nâng tỷ lệ rig và camera; không tự vẽ lại toàn bộ nhân vật theo phong cách khác.
- **TCG:** card art 768×1024; khi triệu hồi có thể render bust/standee hoặc avatar chibi trên sân; dùng master voice + elemental FX.
- **Auto Chess:** sử dụng rig chibi combat; LOD giảm số particle/chi tiết dưới scale nhỏ, không thay màu tóc/áo.


### C3. Character-specific production notes (4 nhân vật còn lại)

**Phở Lam Vũ — `chr_pho_lamvu`**

- **Silhouette:** tóc dài xanh lam/bạc, dải tay áo mềm cong theo đường sóng; giữ hình trượng có vòng nước nhận diện được ở 96 px.
- **Palette đề xuất:** `#D9F7FF` (highlight), `#6FCBEE` (chủ đạo), `#276EAD` (shadow), `#F3F7FF` (vải).
- **Expression đặc biệt:** `thinking` nghiêng đầu, `determined` nhìn thẳng, `surprised` mở mắt và tóc bay nhẹ.
- **Idle riêng:** điều khiển hạt nước nổi quanh lòng bàn tay; tắt hạt nếu ở preset Low.
- **Skill signature:** trượng tụ nước → projectile có trail → splash đúng collider; hook `muzzle` gắn tay phải.
- **Audio signature:** water gather mềm; đạn nước có tiếng rít nhẹ; hit là splash ngắn, không phải explosion lửa.

**Gỏi Cuốn Diệp Nhi — `chr_goicuon_diepnhi`**

- **Silhouette:** mái tóc vàng xanh, vòng hoa/lá bên đầu, váy lá cong ra hai bên; tạo cảm giác nhanh và nhẹ.
- **Palette:** `#E8F8B1`, `#92D978`, `#38886A`, `#F9F2D9`.
- **Idle riêng:** lá trên tóc chuyển động lệch nhịp thở, có cánh hoa bay rất ít.
- **Skill signature:** rễ mọc từ chân mục tiêu, bông hoa nở lúc áp dụng heal/buff. VFX socket `feet` và `target.spine`.
- **Expression đặc biệt:** `shy` che miệng, `victory` dang tay với hoa nở.
- **Audio signature:** đàn gõ gỗ mềm, tiếng lá, bloom chime; tránh sound quá nặng như boss.

**Bánh Bao Bạch Ngọc — `chr_banhbao_bachngoc`**

- **Silhouette:** cơ thể tròn trắng kem, mũ đầu bếp nhỏ và thìa gỗ; không dựng trên rig xương humanoid.
- **Palette:** `#FFF8EA`, `#F5CF9D`, `#F2A8AB`, `#8ACB7F`.
- **Rig:** body squash/stretch ±10%, 2 mắt + má + mũ; chân cực ngắn có contact shadow.
- **Idle riêng:** nhún chậm, chớp mắt, thỉnh thoảng mũ nghiêng và trở về vị trí.
- **Shield signature:** phồng lên trong 0.2s → tạo bubble có ring ngoài → bounce khi nhận đòn → pop tan nếu phá khiên.
- **Audio signature:** tiếng `boing` rất ngắn, shimmer của shield, âm vỡ mềm không chói.

**Cà Phê Dạ Vũ — `chr_caphe_davu`**

- **Silhouette:** áo khoác dài xanh tím than, tóc tím sẫm, trang sức vàng đồng; hình ảnh tinh tế, không quá u tối so với game.
- **Palette:** `#312B52`, `#825BC3`, `#C19A6B`, `#E8D9F5`.
- **Idle riêng:** hơi cà phê tạo vòng trăng nhỏ rồi tan, không che mặt.
- **Skill signature:** dash shadow → crescent slash → espresso-toned mist; có dấu hiệu cảnh báo trước khi teleport/stealth.
- **Expression đặc biệt:** `smirk` cười nhẹ, `thinking` nhìn sang bên, `hurt` cố giữ bình tĩnh.
- **Audio signature:** reverse airy sweep, low hit, chime âm thấp; không làm voice hoặc UI bị che.

**Checklist chung 5 nhân vật:** mọi skin phải giữ nguyên rig sockets và hitbox gameplay; các màu chỉ là palette đề xuất để artist chốt trong character bible, không phải giá trị cuối cùng được duyệt.

## D. State machine animation — dùng chung các chế độ

| State | ID animation | Duration target | Có thể ngắt? | Event bắt buộc |
|---|---|---:|---|---|
| Idle | `idle_loop` | 2.4–3.2 s loop | có | `idle_blink` ngẫu nhiên |
| Walk | `walk_8dir` | 0.65 s/cycle | có | `footstep_l`, `footstep_r` |
| Run | `run_8dir` | 0.45 s/cycle | có | `footstep_l`, `footstep_r` |
| Attack A | `attack_a` | 0.50 s | ngắt theo luật | `cast`, `hit_window_open`, `hit`, `recover` |
| Attack B | `attack_b` | 0.62 s | ngắt theo luật | `cast`, `hit`, `recover` |
| Skill | `skill_01` | 0.9–1.3 s | khóa tới cast release | `cast`, `projectile_spawn`, `hit` |
| Ultimate | `ultimate_01` | 2.5 s | chỉ ngắt bởi trận kết thúc | `cutin_start`, `hit`, `cutin_end` |
| Hit | `hit_react` | 0.20–0.32 s | được | `hit_flash` |
| Stun | `stun_loop` | theo trạng thái | chỉ ngắt giải choáng | `stun_enter`, `stun_exit` |
| Defeat | `defeat` | 0.8 s + hold | không | `unit_downed` |
| Victory | `victory` | 1.2–1.8 s | có khi đổi scene | `voice_victory` |
| Interact | `interact_wave` | 0.9–1.4 s | có | `gesture_peak` |

**Quy tắc:** trạng thái logic combat do game-state điều khiển; animation phản ánh state, không tự quyết định sát thương; sự kiện trùng ID chỉ được thực thi một lần mỗi attack-instance.

## E. Folder convention & key names

```text
assets/characters/chr_bunbo_holinh/
  art/full_v001.webp
  art/portrait_v001.webp
  art/card_v001.webp
  art/cutin_ultimate_v001.webp
  icon/avatar_v001.webp
  icon/skill_01_v001.webp
  rig/skeleton.json
  rig/atlas_0.webp
  rigs_meta/skin_default.json
  animations/events.json
  audio/voice_victory_vi_v001.ogg
```

**Animation keys:** `chr_bunbo_holinh.anim.attack_a`, `chr_bunbo_holinh.anim.ultimate_01`.
**VFX key:** `vfx_fire_bunbo_ultimate_impact`, fallback `vfx_fire_hit_medium` chỉ khi thiết kế cho phép.
**Audio key:** `sfx_chr_bunbo_slash_a`, `vo_chr_bunbo_ultimate_vi`.

## F. Implementation/QA rules

1. Source layered tách ít nhất: tóc trước/sau, face, mắt, miệng, thân, hai tay, chân, phụ kiện, vũ khí, shadow.
2. Nhân vật có atlas được nén, giữ nguyên anchor/hitbox giữa các skin, và không cắt mất vũ khí lúc chuyển động.
3. Animation tween theo timeline; VFX spawn tại socket đã khai báo, không hardcode offset ở scene.
4. Mọi biểu cảm cần được gọi bằng `expression_id` từ dialogue/relationship, không lưu 8 file riêng lẻ bằng URL ngẫu nhiên trong code.
5. Khi giảm FPS, combat result giữ nguyên nhờ đồng hồ logic cố định; animation và SFX có thể bỏ frame không quan trọng.
6. Không dùng hình ảnh món ăn thật hay ảnh stock làm body nhân vật khi bản sắc đã chốt anime chibi.

**Acceptance:** kiểm tra 5 nhân vật trên nền sáng/tối, scale world 80–112 px, TCG card nhỏ 96 px, Auto Chess 50–70 px; nhận diện được silhouette, không bể texture/nhòe mặt; 100% event animation gọi được; không thiếu atlas/skeleton/socket.
