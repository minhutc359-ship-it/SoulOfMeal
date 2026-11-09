# Soul of Meal — Project Bible v3.0

## Elevator pitch
Anime fantasy về **Vị Linh** — những linh hồn sinh từ món ăn, nguyên liệu và ký ức. Người chơi là Người Kết Vị, khám phá Làng Ẩm Thực và các vùng đất khi một hiện tượng **Thất Vị** khiến hương vị và ký ức biến mất. Trục chính Adventure; TCG và Auto Chess là hai lối chơi chiến thuật dùng chung thế giới, nhân vật, mood, animation motifs.

## IP/brand
- Tên làm việc: **Soul of Meal — Hành Trình Vị Linh**.
- Tagline: *Mỗi món ăn đều mang một linh hồn. Mỗi hương vị đều kể một câu chuyện.*
- Mood: tươi sáng, ngon mắt, kỳ ảo, ấm áp, phiêu lưu; chuyển sang epic khi gặp boss.
- Hình ảnh: 2D anime HD (tranh tĩnh/cutin/card) + nhân vật chibi 2.5D có hoạt ảnh trong map/battle. Giao diện vàng mật ong/kem/nâu gỗ cùng màu nguyên tố.
- Năm hệ: `fire`, `water`, `wood`, `light`, `shadow`. Giữ motif, palette, hình dạng tia phép theo hệ.
- Âm nhạc: orchestral anime fantasy kết hợp chất liệu nhạc cụ Việt; SFX theo nguồn tác động. **Tất cả tài nguyên âm nhạc phát hành phải được sáng tác/thu âm/cấp phép hợp lệ.**
- Không copy nội dung bảo hộ của ba game tham khảo. Không tạo clone của nhân vật/tên kỹ năng/UI hoặc asset họ.

## Vòng lặp trải nghiệm
Explore → Encounter → Fight → Reward → Recruit/Develop → Build Team/Deck → Unlock → Explore. Ba mode phải chia sẻ identity, glossary, progression hub, nhưng **không tự chia sẻ cùng scale HP/ATK**.

## Character baseline
| id | Name | Element | Function | Identity invariant |
|---|---|---|---|---|
| `chr_bunbo_holinh` | Bún Bò Hỏa Linh | fire | fighter | tóc đỏ cam, hỏa đao, hoa gia vị, khăn/nơ đỏ |
| `chr_pho_lamvu` | Phở Lam Vũ | water | mage | tóc xanh bạc, lụa nước, dòng hơi/giọt nước |
| `chr_goicuon_diepnhi` | Gỏi Cuốn Diệp Nhi | wood | support | tóc xanh, hoa lá, dây leo, quạt lá |
| `chr_banhbao_bachngoc` | Bánh Bao Bạch Ngọc | light | guardian | mascot trắng kem, mũ bếp, thìa, má hồng |
| `chr_caphe_davu` | Cà Phê Dạ Vũ | shadow | assassin | tóc tím đen, ánh đồng, bóng tối pha cà phê |

## Core experiences
- **Adventure:** village, NPC/dialogue, chest/quest, travel, 1 main protagonist + 4 Vị Linh, auto basic attack/manual ultimate, deterministic hits and boss tells.
- **TCG:** deck composition, visible 5-unit rows, 2 hidden traps, alternating priority/reactions, readable combat log and fair PvP via standardized card stats.
- **Auto Chess:** buy/merge/position/synergy/economy, fair board/shop, battle resolves automatically with real trajectories and clear events.
- **PWA:** install icon, versioned assets, update notification, local-only practice offline if assets downloaded, server-required competitive modes.

## P0 slice acceptance
1. Home → village → talk Lilia → quest → chest → enter Rừng Nguyên Liệu → enemies → ultimate → rewards → reload preserved.
2. Five Vị Linh share identities; `chr_bunbo_holinh` is Golden Sample with all key poses + 1 ultimate.
3. TCG complete bot match with face-down trap + response; Auto Chess complete bot match with buy/merge/synergy.
4. Correct visual/audio event response; mobile layout and accessible settings; device benchmark and license provenance before launch.

## Design truth hierarchy
Approved decisions > these v3 rulebooks (PROPOSED) > specialist v2 specification in `archive/` > old v1 SVG/MD > image previews. Screenshot text is non-authoritative; all numbers, including 8000 HP and 36 cards, are placeholders until approved.
