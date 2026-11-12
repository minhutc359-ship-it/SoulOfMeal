# Sprite, Animation, Rig & Atlas — Production Spec v3.0

Bản web đích dùng adapter Phaser cho sprite atlas và Spine. Xem [pipeline tích hợp v3.2](WEB_ASSET_PIPELINE.md) để biết hợp đồng runtime, bundle và phát hành.

## 1. Nguyên tắc
Concept sheet / poster ≠ sprite sheet runtime. Sprite chạy game phải gồm **mỗi frame PNG RGBA có alpha thật** (hoặc source rig + exports), uniform anchor, không chữ/label/border/nền/hậu cảnh. Hình AI thường không đồng đều giữa các frame: cần cleanup và QA bằng mắt ở 1x, không đưa trực tiếp bản AI tổng hợp vào trận chiến.

## 2. Hai đường sản xuất
- **Frame-based P0**: tạo character turnaround và key-pose → khung hình động từng động tác → kiểm tra nhất quán → clean alpha → individual PNG → pack atlas → animation metadata JSON → test in engine.
- **Rig-based P1**: source PSD/KRA layers → skeleton/mesh rig/skin slots → animation clips → export runtimes + optional sprite rasterization. Quy trình rig phù hợp nhân vật dùng đi dùng lại ở ba chế độ; robot/mascot có thể dùng frame sprite cho chiêu đặc biệt. Không ép mọi source sang cùng công nghệ.

## 3. Quy chuẩn kích thước
| Asset | Source master | Runtime suggestion | Notes |
|---|---|---|---|
| `portrait` | 2048×2048 PNG/RGBA | WebP size adapted | tách background, no typography |
| `card_art` | 768×1024 | WebP 1x/2x | frame/title overlay riêng UI |
| `cutin` | 2048×1152 | WebP/texture | landscape cinematic |
| `avatar` | 512×512 | WebP/PNG | mặt trong safe 80% |
| `icon_skill` | 256×256 | PNG alpha/WebP | 5-element color guide |
| `sprite_frame_master` | 512×512 | atlas RGBA packed | 8% padding around pose |
| `sprite_frame_runtime` | 256×256 or 512×512 | atlas ≤2048²/page | choose after benchmark |
| `small_chibi` | 256×256 | atlas | reduced for village NPCs |
| `atlas_texture` | ≤2048×2048 per page | PNG/WebP with tested alpha | multiple pages allowed |

**Pixel vs world units:** 512px source frame can render at 112 world pixels character height. Never map pixel sprite dimensions directly to collision size. All animations need `anchor_normalized` (default [0.5,0.9]), `hitbox_world` and optional `sockets`. If character jumps, anchor at ground projection, not visual foot position during airborne phase.

## 4. Canonical animation list
| Clip | Frames baseline | FPS baseline | Loop | Event timing |
|---|---:|---:|---|---|
| `idle` | 8 | 8 | yes | idle variation optional |
| `walk` | 8 | 12 | yes | left foot frame 2, right foot frame 6 |
| `run` | 8 | 16 | yes | footsteps 2/6 |
| `attack_a` | 12 | 16 | no | cast frame 0, contact frame 7 |
| `attack_b` | 12 | 16 | no | cast 0, contact 8 |
| `skill_01` | 16 | 16 | no | projectile frame 6, hit **sim event** |
| `ultimate_01` | 24 | 16 | no | cut-in frames are separate timeline |
| `hit` | 6 | 12 | no | no damage emission |
| `victory` | 12 | 12 | no | optional voice |
| `defeat` | 10 | 10 | no | battle state drives it |

These are art proposals not enforced combat simulation lengths; the key is synchronizing event metadata to the sim event stream. Do not produce all 24 ultimate frames in one AI mosaic if identity drift becomes severe; create multiple coherent 4×2 poses then hand-fix interpolations. Frames can be rendered out of sequence and still be named chronologically.

## 5. Directions and mirroring
Characters must have agreed `directions`: default battle chibi `E` + `W` via safe horizontal mirror; over-world `N,E,S,W` with bespoke views for back and weapon-handed characters. **Never auto mirror asymmetric weapon, embroidered costume or text logos without review.** For 8 directions render a true 8-direction turn-around or use documented pose blending; not invented frame copies.

## 6. Naming convention
- Character root: `assets/characters/chr_bunbo_holinh/default/`.
- Raw frame: `animations/attack_a/E/chr_bunbo_holinh_default_attack_a_e_f000.png`.
- Atlas: `atlases/chr_bunbo_holinh_default_a00.png` + `...a00.json`.
- Manifest: `sprites/chr_bunbo_holinh_default.json`.
- Audio: `audio/sfx/fire/sfx_fire_slash_01.ogg`.
- VFX: `vfx/fire/vfx_fire_slash_hit_a.json`.
- JSON IDs stable snake_case; **no whitespace/diacritics**, even if human-facing names are Vietnamese.

## 7. Color/VFX identities
| Element | Core hues | Motif | SFX |
|---|---|---|---|
| fire | #F45129 / #FFB038 / #FFF1A3 | lưỡi lửa, tia gia vị, tàn nóng | whoosh + heat crackle |
| water | #2F91EF / #90E5FF | sóng, giọt, hơi nước | splash + chime |
| wood | #48B875 / #C6EF71 | dây leo, lá, hoa | leaf flutter + stem stretch |
| light | #FFD66B / #FFF8D8 | vòng bảo hộ, tia sao | clear bell + shield shimmer |
| shadow | #7D4CC9 / #2E2157 | sương, tinh thể, bóng tối | low whoosh + echo |

VFX uses Cast→Travel→Impact→Aftermath, *not geometric placeholder shapes*; VFX can use particles and shapes as support, but final animation should have hand-painted character and hit motifs. Glow should respect screen readability. SFX playback follows named game events, not raw render callbacks.

## 8. Batch export criteria
- No cropped limbs/weapon at extremes, no random hair accessory changes, palette stable under every angle.
- Transparent borders; 8px logical padding within frame; no photographic background, shadow must be intentional independent layer.
- Every frame same dimensions per clip, consistent anchor, character feet stable when grounded.
- Atlas contains all expected frames and no duplicates/unreferenced IDs; cross-check with manifest.
- At 64/112/160 world height silhouette readable; at 30/60 render FPS no changes to collision result.
- license/provenance: `source_reference_id`, `created_with`, `reviewer`, `right_to_use`.

## 9. Agent execution
Read `.agents/skills/soul-of-meal-sprite/SKILL.md` and invoke the skill pipeline. Source JPG/PNG sheet in `references/visuals` provides **reference, not actual per-frame asset**. Each generation cycle needs human `review_identity` before mixing source frames and adding to canonical registries.
