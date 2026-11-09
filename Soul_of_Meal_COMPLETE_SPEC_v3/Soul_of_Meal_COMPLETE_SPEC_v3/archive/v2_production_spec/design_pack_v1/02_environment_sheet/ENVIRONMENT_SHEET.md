# 02 — Environment Sheet: Thế giới / Bản đồ / Công trình / NPC

**Mục tiêu sheet:** đóng vai trò bản layout production cho level designer, environment artist, gameplay engineer, UI/minimap và technical artist.

## A. Chuẩn bản đồ và asset môi trường

| Hạng mục | Đơn vị/kích thước | Ghi chú |
|---|---:|---|
| Art world tile | 64 × 64 world units | tile ground/mask/collision độc lập |
| Atlas tile | 2048 × 2048 px/trang | texture WebP/PNG, mipmaps nếu engine hỗ trợ |
| Map demo `env_village_square` | 64 × 48 tile = 4096 × 3072 world units | chia 4×3 chunks |
| Chunk streaming | 16 × 16 tile = 1024 × 1024 world units | preload chunk lân cận |
| Nhà nhỏ | footprint 4×4 đến 6×5 tile | art roof overshoot footprint hợp lý |
| Quán lớn / guild hall | 8×6 đến 10×8 tile | collision theo tường, mái có alpha fade khi khuất |
| NPC chibi | 64–96 world px cao | socket `foot`, `talk_icon`, `quest_mark` |
| Cửa chính | trigger 64 × 32 units | đặt theo threshold trước cửa, có debounce |
| Tương tác NPC | bán kính 1.25 tile (~80 units) | ưu tiên NPC gần nhất có LOS |
| Camera Adventure | view mục tiêu 12–18 tile ngang tùy aspect | pan có damping, zoom được khóa theo scene |
| Minimap | 256×256 master / viewport 160×160 dp | icon map riêng, không nhúng chữ ảnh |

### Lớp bản đồ đề xuất

`ground_base` → `ground_detail` → `walkable_decal` → `obstacle_bottom` → `entity` → `obstacle_top` → `light_overlay` → `weather` → `postprocess`.

Dùng Y-sort theo tọa độ chân entity; mỗi vật cản có `sort_foot_y`. Không dùng sorting theo top của texture vì cây và mái nhà sẽ che sai.

## B. Sơ đồ Làng Ẩm Thực — scene P0

**Mục tiêu:** người chơi vào làng biết hướng đi, thấy ít nhất 5 đối tượng tương tác trong màn hình đầu, NPC chuyển động hợp lý, không có công trình “chỉ để lấp chỗ trống”.

```text
                 [Cổng Rừng Nguyên Liệu / zone exit]
          [Vườn nguyên liệu] --- [Cầu gỗ / dòng suối]
                      |                    |
[Nhà dân A] -- [Bảng nhiệm vụ] -- [QUẢNG TRƯỜNG] -- [Guild Hall]
    |                  |            |               |
[Quán bánh] ------- [Tượng Bánh Bao] -- [Bếp của Lilia] -- [Lối chợ]
    |                  |                            |
[Ngõ nhỏ/rương] -- [Trạm nghỉ] --------------- [Cổng vào làng]
```

- **Spawn:** `spawn_village_south` — tại Cổng vào làng, nhìn lên quảng trường; camera 1 s focus.
- **Điểm định hướng:** tượng Bánh Bao lớn, cây hoa, mái nhà đỏ, cổng rừng, biển hiệu Guild.
- **Tuyến đầu game:** spawn → NPC Lilia → bảng nhiệm vụ → rương → cổng rừng; đường chính 3–4 tile rộng, lối phụ 2 tile.
- **World bounds:** x=0…4096, y=0…3072. Không đặt actor tại góc camera out-of-bounds.

### Khu vực con & nội thất

| Map ID | Kết nối | Nội dung | Trạng thái |
|---|---|---|---|
| `env_village_square` | hub chính | quảng trường, bảng nhiệm vụ, Lilia | ngày/đêm, event |
| `env_village_lilia_kitchen` | cửa quán Lilia | nấu ăn, giao nhiệm vụ, shop nhỏ | open/closed/busy |
| `env_village_guild_hall` | guild door | tổ đội, thử thách | unlocked/locked |
| `env_village_market` | đường chợ | mua nguyên liệu, hội thoại | market_open/night |
| `env_forest_entrance` | cổng phía bắc | combat encounters, quest | locked/cleared |

### Tổng thể thế giới ngoài làng

- `env_forest_ingredients`: màu ngọc bích, nấm và cây phát sáng; NPC hái lá; cơ chế dây leo.
- `env_sea_huongbien`: bến cảng, đảo nổi, san hô, cầu gỗ; cơ chế thủy triều.
- `env_volcano_giavi`: đá đen, lò bếp, sông dung nham; hơi nóng, quái Hỏa.
- `env_mystic_void`: tàn tích tím, cầu đá lơ lửng; câu đố liên quan ký ức.

## C. Danh mục props và công trình P0

| Asset ID | Art target | Collision | Interaction | Feedback |
|---|---|---|---|---|
| `env_prop_banhbao_statue` | 384×512 px transparent | base ellipse 2×2 tile | Inspect | pop-up lore + mắt tượng nháy |
| `env_build_lilia_kitchen` | 1024×1024 px | footprint 7×5 tile | Enter / Talk | door open 0.28s; sound bell |
| `env_build_guild_hall` | 1536×1024 px | footprint 9×6 tile | Enter/locked | icon khóa + toast lý do |
| `env_prop_questboard` | 256×384 px | 1×1 tile | OpenQuest | scroll unroll 0.20s |
| `env_prop_chest_wood` | 256×256 px | base 1×1 tile | Loot | closed→opening→open→empty |
| `env_prop_berry_bush` | 256×256 px | decor 1×1 tile | Harvest | ripe→gather→depleted→respawn |
| `env_prop_bridge_wood` | modular 4×1 tile | passable | WalkOver | footsteps material wood |
| `env_prop_door_generic` | 128×192 px | nav blocker when closed | Enter | door transition |
| `env_prop_sign_forest` | 256×256 px | no hard collision | Inspect | tooltip destination |
| `env_prop_lantern` | 128×256 px | 1 tile decor | LightOn | night glow emissive |

Mọi công trình có 4 trạng thái được xét: `visible`, `interactive`, `locked`, `interior_connected`. Một building có thể dùng chung art nhưng không được hiển thị nút tương tác giả khi chưa có hành vi.

## D. NPC sheet

**NPC mở đầu:** `npc_lilia` (Cô Bếp Lilia), `npc_market_merchant`, `npc_guild_guard`, `npc_ingredient_collector`, `npc_child_explorer`.

Mỗi NPC có:

- Render chibi rig hoặc sprite ở cùng tỷ lệ với player; bust portrait 1024×1024 cho hội thoại quan trọng.
- `idle`, `walk`, `talk`, `wave`, `surprised`, `quest_new`, `quest_ready`, `interact`.
- Quest marker 32×32 dp: `!` khi có nhiệm vụ mới, `?` khi đủ điều kiện hoàn thành; không khắc cứng vào sprite.
- `sight_range`, `interact_radius`, `schedule_id`, `dialogue_id`, `quest_id` tách config.

### Lịch trình ví dụ cho Lilia

| Khoảng giờ in-game | Location | Behavior |
|---|---|---|
| 06:00–11:00 | Kitchen outside | idle cook / talk / offer quest |
| 11:00–16:00 | Kitchen inside | sell/serve / talk |
| 16:00–20:00 | Village square | walk / story interaction |
| 20:00–06:00 | Kitchen | closed; quest terminal vẫn có fallback |

Giờ trong game không buộc trùng giờ thiết bị. Quest blocker không được khiến player không thể tiếp tục nếu đến sai “giờ”.

## E. Tương tác và state machine

**Cửa:** `closed → approach → opening → transition → entered`; `locked → show_reason` nếu chưa đủ điều kiện. Nếu load scene thất bại: trả về `closed` và UI `error_retry`, không dịch nhân vật qua tường.

**Rương:** `closed → opening → reward_modal → opened`; dữ liệu loot được xác nhận 1 lần bởi save service; thao tác lặp không nhân đôi thưởng.

**NPC:** `idle/patrol → player_in_range → focus → dialogue → quest_accept/complete → idle`; khi mất tương tác phát `dialogue_close`.

**Nguyên liệu:** `ripe → harvesting → depleted → respawn`; có animation hand + SFX tương ứng.

**Chiến đấu:** vùng enemy `patrol → aggro → encounter_transition → battle_scene`; nếu battle fails loading thì quay lại scene với enemy state an toàn.

### Contract đối tượng tương tác

```json
{
  "id": "env_prop_chest_wood_003",
  "prefab": "env_prop_chest_wood",
  "map_id": "env_village_square",
  "tile": {"x": 17, "y": 29},
  "collision": {"shape": "rect", "w": 54, "h": 32, "offset_y": 18},
  "interaction": {"kind": "loot", "range_units": 80, "action": "chest.open", "once": true},
  "state_id": "save.chests.env_prop_chest_wood_003"
}
```

## F. Render, navigation, streaming

- Collision polygon dựa footprint của vật thể, không dựa alpha; nhân vật có capsule collider giản lược.
- Pathfinding dùng grid navigation hoặc navmesh từ dữ liệu walkable; NPC không đi xuyên cây/nhà/đạo cụ.
- Interaction có icon nổi khi trong bán kính và line-of-sight; dùng nút `E` trên PC và tap trên mobile.
- Camera follow giảm rung, giữ nhân vật trong safe zone màn hình; zoom không cắt UI HUD.
- Transition nội thất: 250–400 ms fade / door close / load / reveal. Preload scene cạnh và cache asset chung.
- Baked ambient occlusion cho props; bóng chân runtime riêng; nguồn sáng event/đèn có texture mask.
- Zone ambience SFX và music crossfade 0.5–1.5 s; không restart BGM khi đi qua cùng một chunk.
- Mini-map có fog-of-war đơn giản, marker quest/chest/NPC và legend. Marker có ID và click focus.

## G. Environment acceptance checklist

1. Có sơ đồ map vẽ tay và layout collision rõ ràng; đủ 5 NPC mẫu và 10 loại tương tác.
2. Player vào/ra ít nhất 2 nội thất; save/return giữ đúng vị trí và trạng thái rương.
3. Trong 30 giây đầu, người chơi thấy ít nhất 3 hành vi NPC và 5 điểm đáng tương tác, không cần cuộn bản đồ mù mờ.
4. Mái nhà fade opacity khi che player; không có clipping hoặc z-sort sai quá 1 giây.
5. Hiệu năng không drop frame nghiêm trọng khi chuyển chunk; mọi loading có retry.
6. Mỗi object có **gameplay value** hoặc **worldbuilding justification** được mô tả trong object registry.
