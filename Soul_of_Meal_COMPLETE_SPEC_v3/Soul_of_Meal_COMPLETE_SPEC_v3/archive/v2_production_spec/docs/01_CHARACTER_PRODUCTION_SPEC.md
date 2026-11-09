# 01 — CHARACTER SHEET / CHARACTER PRODUCTION SPECIFICATION

**Phụ trách:** Art Director, Character Artist, Rigger, Animator, Gameplay Engineer, QA.  
**Tham chiếu hình:** `design_pack_v1/01_character_sheet/CHARACTER_CONCEPT_PLATE.png` và `CHARACTER_BLUEPRINT.svg`.  
**Kết quả bàn giao:** có thể dùng cùng nhân vật trong màn Home, Adventure, TCG, Auto Chess; không thay đổi nhận diện.

## A. Character bible — bất biến nhận diện
Mỗi nhân vật có `character_id` ổn định; dùng ID xuyên art, voice, gameplay, save và UI. Bắt buộc có `identity.md`: silhouette, motif ẩm thực, màu chủ đạo HEX, mắt/tóc, vũ khí/cầm tay, trang phục, độ tuổi biểu đạt (nếu có), giới hạn skin, reference gốc, owner, giấy phép.

| Character ID | Chủ đề | Điểm nhận dạng bắt buộc | Role + element | Chú ý khi đổi skin |
|---|---|---|---|---|
| `chr_bunbo_holinh` | Bún bò | tóc đỏ cam, mắt hổ phách, hoa văn gia vị, hỏa đao, nơ đỏ | fighter/fire | giữ lọn tóc, cấu trúc vũ khí và màu lửa |
| `chr_pho_lamvu` | Phở | tóc lam bạc, tay áo lụa, dải hơi nước, pháp trượng | mage/water | không biến dòng nước thành lửa/sét |
| `chr_goicuon_diepnhi` | Gỏi cuốn | tóc xanh sáng, hoa/lá, quạt lá, dây leo | support/wood | giữ biểu tượng lá trên tóc |
| `chr_banhbao_bachngoc` | Bánh bao | thân kem tròn, má hồng, mũ đầu bếp, thìa gỗ | guardian/light | giữ dáng tròn mềm và biểu cảm hiền |
| `chr_caphe_davu` | Cà phê | tóc tím đen, áo khoác tối, họa tiết đồng, song đao/tinh thể | assassin/shadow | giữ tương phản tím/đồng và chuyển động nhanh |

## B. Output checklist / size / format
| Asset | Kích thước MASTER | Runtime/output | Alpha & safe zone | Ưu tiên |
|---|---|---|---|---|
| `full` | 2048×3072 px | WebP 1024/2048 adaptive | RGBA, safe 300px | P0 |
| `portrait` | 2048×2048 px | WebP adaptive + expression layers | vùng mặt ở trung tâm 60% | P0 |
| `card` | 768×1024 px | WebP 1x/2x khi hợp lý | artwork KHÔNG có chữ/khung | P0 |
| `cutin_ultimate` | 2048×1152 px | WebP/texture split | không dính HUD | P0 cho 1 gold sample |
| `chibi_turnaround` | 2048×2048/board | PNG/PDF nội bộ | 4 góc: trước, 3/4, bên, sau | P0 |
| `chibi_rig` | 768px+ source height | skeleton + atlas ≤2048²/trang | pivot tại chân | P0 |
| `avatar` | 512×512 px | WebP/icon texture | tâm mặt trong safe circle 80% | P0 |
| `skill_icon` | 256×256 px | WebP/PNG alpha | không chèn chữ | P0 |
| `expression` | 1024px face region source | 8 state trên rig/atlas | không trượt mắt/miệng | P0 |
| `skin_variant` | cùng rig / atlas riêng | chọn qua skin ID | giữ sockets/hitbox | P1 |

**Chốt kỹ thuật:** 2.4–2.8 đầu với humanoid chibi, mascot Bánh Bao 1.1–1.4 đầu; chiều cao hiển thị Adventure ~80–112 world px, combat ~112–160 world px, Auto Chess ~50–70 world px. Đây là tỉ lệ **hiển thị**, không dùng để scale physics capsule một cách mù quáng.

## C. Turnaround + layer breakdown
Tối thiểu 4 góc trong cùng một sheet; mỗi góc có đường trục cơ thể, thước tỷ lệ và bóng chân. Chọn một bên vũ khí chính và ghi rõ `dominant_hand`. Đối tượng bất đối xứng không được flip ngang khiến vũ khí đổi tay hoặc ký tự trên trang phục đảo chiều.

Layer tách tối thiểu: `hair_back`, `hair_front`, `face_base`, `eye_l`, `eye_r`, `brow_l`, `brow_r`, `mouth`, `body`, `arm_l`, `arm_r`, `hand_l`, `hand_r`, `leg_l`, `leg_r`, `weapon`, `accessory_front`, `accessory_back`, `shadow`. Phần chuyển động vải/tóc nếu lớn cần mesh deform, không chỉ xoay cứng.

**Pivot:** `root` ở trung tâm hai chân (0,0) khi đứng; in-game y dương xuống. Socket định nghĩa trong local art space và có thể được engine chuyển đổi, không hardcode screen pixel.

## D. Rig contract / sockets
| Socket | Mục đích | Ràng buộc |
|---|---|---|
| `root`, `feet`, `hip`, `spine`, `head` | transform/sort/camera | không đổi tên giữa skin |
| `hand_l`, `hand_r` | cầm vũ khí hoặc item | rotate cùng bone |
| `muzzle`, `blade_tip` | projectile spawn, slash | phải test cả attack A/B |
| `target_lock`, `hit_center` | VFX/target marker | tách collider gameplay khỏi artwork |
| `shield_center`, `fx_back` | khiên, aura | dùng khi nhân vật có state tương ứng |

**Animation API (proposal):** `playAnimation(characterId, animId, {blendMs, speed, loop, instanceId})` / `setExpression(characterId, expressionId)` / `getSocketWorldPosition(actor, socketId)`; combat state quyết định hành động, animation chỉ trình diễn.

## E. Animation state machine
```text
spawn → idle ↔ walk/run
idle/walk → attack_a/attack_b → recover → idle
idle → cast_skill → recover → idle
idle → ultimate → recover → idle
* → hit (non-lethal) → previous legal state
* → stun → idle (when released)
* → defeat (terminal in battle)
victory → idle_social (outside battle)
```
Không cho phép `hit` ngắt main-hit đã server-confirm nếu luật quy định chiêu không thể bị gián đoạn; trạng thái gián đoạn phải dựa trên combat rule và animation cancellation policy. Mỗi attack có ba đoạn `anticipation`, `active`, `recover`; tránh bước chân trượt trên đất.

| Clip | Khung tham chiếu @60fps | Loop? | Event chính | Tiêu chí |
|---|---:|---|---|---|
| `idle` | 96–150f | yes | idle_variation optional | chân bám đất, tóc/áo chuyển động nhẹ |
| `walk` | 36–48f/chu kỳ | yes | footstep L/R | tiếp xúc chân đúng quỹ đạo |
| `run` | 28–40f/chu kỳ | yes | footstep L/R | không moonwalk khi thay speed |
| `attack_a` | 30f (mẫu Bún Bò) | no | cast, hit, recover | sync với combat event |
| `attack_b` | 36–48f | no | hit/optional double hit | khác silhouette attack_a |
| `skill_01` | 60–90f | no | projectile_spawn/hit | socket không lệch |
| `ultimate_01` | 150f cinematic sample | no | cutin/impact/recover | có chế độ short/reduced-motion |
| `hit` | 10–18f | no | none | không gây thêm damage |
| `stun` | loop khi buff active | yes | none | có VFX trạng thái bên ngoài rig |
| `victory` | 60–90f | no | voice_optional | rõ biểu cảm, không clip cạnh màn |
| `interact` | 30–60f | no | response | tương tác touch/chào |

**Lưu ý:** khung là chỉ dẫn visual; mốc áp dụng damage theo combat simulation, không phụ thuộc FPS hiển thị.

## F. Expression set: 8 mẫu + optional
| ID | Mắt / miệng | Ngữ cảnh | Không được |
|---|---|---|---|
| `neutral` | mắt mở, miệng thư thái | mặc định | trông tức giận vô cớ |
| `smile` | mắt sáng, mép cong | chào/tăng thân thiết | che toàn bộ mắt bằng tóc |
| `laugh` | mắt cong/nhắm, miệng rộng | thắng nhỏ/niềm vui | thay đổi vị trí mặt |
| `surprised` | mắt to, miệng O | mở rương, phản ứng | phồng mặt quá khác model |
| `angry` | mày xếch, miệng quyết tâm | boss/đối thoại | biểu cảm hung dữ lệch rating |
| `sad` | mắt cụp, miệng buồn | story | khó nhìn ở 112 px |
| `hurt` | mắt nhắm một phần, đau | hit | trạng thái kéo quá lâu |
| `victory` | tươi cười, đôi khi giơ vũ khí | thắng | va chạm vũ khí với HUD |

Mở rộng khi có asset: `sleepy`, `shy`, `determined`, `thinking`. Tham chiếu cảm xúc bằng ID, không nhúng asset URL trực tiếp trong story JSON.

## G. Kỹ năng + hook cho 5 character mẫu
| ID | Attack | Skill chủ đạo | Ultimate | VFX socket | Audio |
|---|---|---|---|---|---|
| `chr_bunbo_holinh` | slash lửa | dash + burn | Ngọn Lửa Ẩm Thực | `blade_tip`, `fx_back`, `target_lock` | `sfx_fire_whoosh_a`, `vo_chr_bunbo_ultimate_vi` |
| `chr_pho_lamvu` | water bolt | ring + slow | Vũ Điệu Hương Phở | `muzzle`, `feet`, `hit_center` | `sfx_water_splash_medium` |
| `chr_goicuon_diepnhi` | leaf projectile | vine bind | Khu Vườn Tươi Mát | `hand_r`, `target_lock` | `sfx_wood_vine_bind` (tạo mới) |
| `chr_banhbao_bachngoc` | spoon bop | bubble shield | Hấp Khí Hộ Thể | `shield_center`, `head` | `sfx_light_shield_pop` (tạo mới) |
| `chr_caphe_davu` | shadow blades | mark + teleport | Dạ Khúc Đắng Ngọt | `hand_l/r`, `fx_back` | `sfx_shadow_dash` (tạo mới) |

Các skill ID/cân bằng combat chỉ là gợi ý cho prototype; cần data-driven rules được duyệt ở `07_GAME_RULES_AND_OPEN_DECISIONS`.

## H. Asset metadata — ví dụ đúng format
```json
{
  "character_id": "chr_bunbo_holinh",
  "skin_id": "default",
  "rig_id": "rig_chr_bunbo_default",
  "root_socket": "feet",
  "asset_ids": {"portrait":"chr_bunbo_holinh_portrait","card":"chr_bunbo_holinh_card"},
  "animations": ["idle","walk","run","attack_a","attack_b","skill_01","ultimate_01","hit","victory","defeat"],
  "expression_ids": ["neutral","smile","laugh","surprised","angry","sad","hurt","victory"],
  "sockets": ["feet","spine","head","hand_l","hand_r","blade_tip","target_lock","shield_center"],
  "license": {"owner":"TBD", "status":"pending_review"},
  "status":"draft"
}
```
Không thêm socket placeholder dùng khi không có hitbox/rig tương ứng; validator yêu cầu chỉ socket được gọi bởi animation/VFX mới bắt buộc có tọa độ.

## I. Pipeline + nghiệm thu
1. Character brief → moodboard/motif riêng (không sao chép IP tham khảo) → silhouette 6 thumbnails → 1 mẫu chọn.
2. Turnaround/front/side/back → palette HEX → prop/vũ khí → biểu cảm → phê duyệt identity.
3. Source PSD/KRA phân layer → rig pass → animation blockout → polish.
4. Integrate sandbox scene (bright/dark background; 80/112/160px) → gắn projectile/VFX socket → QA.
5. Xuất atlas tối ưu, registry hợp lệ, ghi license/author và source editable.

**Đạt chuẩn khi:** silhouette nhận diện ở 64px; không tóc/vũ khí bị cắt tại animation cực trị; không flip sai tay; chuyển động chân không trượt khi speed 0.8–1.2×; mọi animation có play/stop/interrupt đúng; SFX/VFX đúng socket; hạ FPS không nhân đôi hit; source và runtime atlas có trong manifest; mọi biểu cảm bật bằng ID.

**Chặn release:** nhân vật chỉ có ảnh tĩnh thay cho animation trọng tâm; missing rig socket; skill dùng placeholder hình học ở nhân vật mẫu; art chưa được quyền sử dụng; tên ID không đồng bộ với content.
