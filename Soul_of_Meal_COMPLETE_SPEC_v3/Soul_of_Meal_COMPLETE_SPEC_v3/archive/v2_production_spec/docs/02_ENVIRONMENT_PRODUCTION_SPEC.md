# 02 — ENVIRONMENT SHEET / LEVEL PRODUCTION SPECIFICATION

**Phụ trách:** Environment Artist, Level Designer, Gameplay/Engine Engineer, Narrative Designer, QA.  
**Reference:** `design_pack_v1/02_environment_sheet/{ENVIRONMENT_CONCEPT_PLATE.png,ENVIRONMENT_BLUEPRINT.svg}`.  
**Kết quả:** bản đồ làng có đường đi dễ đọc, tương tác thực sự, NPC có hành vi, nhiều điểm khám phá và chuyển khu vực không lỗi.

## A. Chuẩn map, camera, layer
| Hạng mục | Quy định production | Ý nghĩa |
|---|---|---|
| Tile base | `64×64 world units` | đơn vị tọa độ art/map |
| Prototype village | `64×48 tiles` = `4096×3072 world units` | scene `env_village_square` |
| Chunk | `16×16 tiles`, 4×3 chunks | streaming/preload |
| World camera | nhìn thấy 12–18 tile ngang tùy thiết bị | zoom không che vật thể/nhân vật |
| Tile atlas | tối đa 2048×2048px/trang khuyến nghị | quản lý RAM/GPU |
| House small | 4×4–6×5 tiles footprint | art mái có thể vượt footprint |
| Guild/hall | 8×6–10×8 tiles footprint | nhiều state/door |
| Interact range | 80 world units mặc định (1.25 tile) | có LOS, ưu tiên gần nhất |
| Door trigger | 64×32 units | debounce; không double transition |
| NPC displayed | 64–96 world px | chia sẻ rig style |

Lớp render: `ground_base → ground_detail → decal → decor_back → entity_y_sort → decor_foreground → canopy/roof_fade → light_overlay → weather → UI_overlay`.
`foot_y` quyết định z-sort; collider gameplay là polygon/capsule độc lập sprite alpha. Mái nhà hoặc tán cây che player phải fade, không làm player biến mất.

## B. Sơ đồ chức năng Làng Ẩm Thực
```text
                    CỔNG RỪNG (combat gate)
                         │
       VƯỜN NGUYÊN LIỆU ─ CẦU GỖ ─ NHÀ HỘI
                 │                  │
NHÀ DÂN ─ BẢNG NHIỆM VỤ ─ QUẢNG TRƯỜNG ─ CHỢ
                 │          │          │
            RƯƠNG/NGÕ ─ TƯỢNG BÁNH BAO ─ BẾP LILIA
                         │
                     CỔNG LÀNG
```
P0 **đường xuyên map**: `spawn_village_south → lilia → questboard → chest → forest_gate`. Camera 1 giây đầu giới thiệu quảng trường. Spawn không nằm trong collider, không dưới mái. Đường chính rộng 3–4 tile; đường phụ ≥2 tile hoặc xử lý nav special-case.

### Điểm quan tâm / POI yêu cầu
| POI ID | Loại | Hành động chính | Min content | Trạng thái |
|---|---|---|---|---|
| `poi_lilia_kitchen` | building + NPC | trò chuyện, nhận nhiệm vụ, shop | 1 cuộc hội thoại + 1 quest | open/busy/closed |
| `poi_questboard` | prop | xem/track quest | 3 quest entries mẫu | idle/new/available |
| `poi_banhbao_statue` | landmark | inspect/lore | 1 trang lore | idle/inspect |
| `poi_wooden_chest` | lootable | mở rương | 1 reward claim idempotent | closed/opening/opened |
| `poi_berry_patch` | harvest | hái nguyên liệu | số lượng + cooldown | ripe/depleted |
| `poi_guild_hall` | building | mở menu đội hình/thử thách | locked reason + unlock | locked/open |
| `poi_forest_gate` | zone transfer | đi rừng | unlock requirement | locked/ready/loading |
| `poi_market_stall` | vendor | mua/bán item | >=3 hàng demo | open/closed |
| `poi_rest_bench` | social | ngồi + idle animation | 1 animation | idle/occupied |
| `poi_town_sign` | info | xem bản đồ chỉ dẫn | open minimap | idle/focused |

## C. Environment asset specifications
| Asset ID v1 | Master art | Footprint/collision | Behavior |
|---|---|---|---|
| `env_build_lilia_kitchen` | 1024×1024 px RGBA | 7×5 tiles | enter/open/closed; roof fade |
| `env_build_guild_hall` | 1536×1024 px | 9×6 tiles | gate + tooltip unlock |
| `env_prop_banhbao_statue` | 384×512 px | ellipse 2×2 tiles | inspect lore |
| `env_prop_questboard` | 256×384 px | 1×1 tile | quest menu |
| `env_prop_chest_wood` | 256×256 px | 1×1 tile | loot once / opened state |
| `env_prop_berry_bush` | 256×256 px | 1×1 tile | harvest respawn |
| `env_prop_bridge_wood` | modular 4×1 tile | walkable | wood footsteps |
| `env_prop_door_generic` | 128×192 px | blocker/trigger | transition |
| `env_prop_sign_forest` | 256×256 px | soft collision | tooltip navigation |
| `env_prop_lantern` | 128×256 px | 1 tile decor | glow by in-game time |

Bàn giao environment `.psd`/`.kra` có layer `base`, `occluder`, `foreground`, `glow`, `shadow`, `mask`; file tile có seam test bốn cạnh; vật thể tương tác phải có silhouette nhận diện và feedback `focus / active / locked`.

## D. NPC behavior bible
| NPC | ID | Routine | Tương tác | Fallback |
|---|---|---|---|---|
| Cô Bếp Lilia | `npc_lilia` | bếp → quảng trường → bếp | onboarding / quest / shop | hướng dẫn luôn có thể mở qua journal |
| Thương nhân | `npc_market_merchant` | đi quanh quầy | buy/sell | quầy đóng có biển giờ |
| Thợ rèn | `npc_guild_guard` (ID v1; **đổi tên sau nếu vai trò đổi**) | canh guild | unlock gate | giải thích điều kiện |
| Người hái nguyên liệu | `npc_ingredient_collector` | vườn → rừng | collect side quest | quest không missable |
| Trẻ thám hiểm | `npc_child_explorer` | chạy quanh quảng trường | lore/tutorial chest | không gây kẹt path |

**Animation NPC tối thiểu:** `idle`, `walk`, `talk`, `wave`, `surprised`, `interact`; quest marker là UI layer, không vẽ cứng vào texture. Hội thoại có `dialogue_id`, `speaker_id`, `expression_id`, `choices`, `next_node` và điều kiện mở khóa.

Lịch Lilia minh họa: 06–11 bếp ngoài; 11–16 trong bếp; 16–20 quảng trường; 20–06 bếp đóng. Toàn bộ là **giờ trong game**, không lấy đồng hồ thiết bị; nhiệm vụ bắt buộc không được bị chặn vĩnh viễn do schedule.

## E. State machine và persistence
**Door:** `closed → opening → loading → entered` / `locked → reason`. Lỗi load → `closed + retry`; debounce 500ms khi kích hoạt.  
**Chest:** `closed → claim_pending → opening → reward_modal → opened` / `claim_error → retry`; thưởng được server/save xác nhận *một lần* bằng `claim_id`.  
**Harvest:** `ripe → gather_pending → depleted → cooldown → ripe`; không tăng inventory hai lần khi double tap.  
**NPC:** `idle/patrol → in_range → focused → dialogue → quest_update → idle`; modal khóa input movement.  
**Enemy:** `patrol → aggro → encounter_loading → battle → outcome`; khi failure giữ vị trí an toàn.

### Map object contract đề xuất
```json
{
  "instance_id": "env_prop_chest_wood_003",
  "prefab_id": "env_prop_chest_wood",
  "map_id": "env_village_square",
  "tile": {"x":17,"y":29},
  "foot_y": 1888,
  "collider": {"shape":"rect","w":54,"h":32,"offset_y":18},
  "interaction": {"action":"chest.open","range_units":80,"requires_los":true,"once":true},
  "save_key": "world.env_village_square.chest_003",
  "visual": {"idle":"closed","after_claim":"opened"}
}
```
`instance_id` là duy nhất mỗi map; `prefab_id` chia sẻ art; không dùng `prefab_id` làm save ID cho nhiều rương.

## F. Spawn, collision, occlusion và navigation
- Player spawn tại `spawn_village_south`, phải có test `isWalkable(pos) == true` và khoảng cách tối thiểu 1 tile tới obstacle gần nhất.
- Grid navigation bake từ tile blockers, connector/cầu, door state; NPC pathfinding có tránh vật thể động cục bộ.
- Tương tác có LOS; khi 2 NPC cùng range, chọn `focus` gần tâm camera/đúng hướng di chuyển rồi hiển thị target.
- Object cao có tách thân và tán để `roof_fade` theo actor proximity; không dùng alpha sprite để tính collider.
- Camera follow dùng smoothing; giảm jitter; khi vào hẻm hẹp không zoom vượt mức khiến HUD hoặc sprite bị cắt.
- Transition interior: `onEnter` lưu exit transform → door animation → preload → scene swap → player spawn, có rollback khi failure.
- Collision chỉ chạy trên object cần thiết; object trang trí nhỏ không cản đường ngẫu nhiên.

## G. Tile/chunk pipeline
1. Artist bàn giao tile atlas, metadata `tile_id`, `terrain`, `collision`, `surface_sfx`, `render_layer`, `autotile_rule`.
2. Level designer dùng editor đặt tile và prefab; exporter tạo map JSON + chunk manifest.
3. Validator kiểm: thiếu tile ID, object ngoài bounds, NPC nằm trong vật cản, portal thiếu destination, rương duplicate save key, thiếu nav link.
4. Runtime preload chunk gần camera; preload các asset shared trước scene swap; cache có giới hạn, eviction rõ ràng.
5. Low setting giảm weather, bloom, parallax, particle; không ẩn vật thể/nhiệm vụ cần cho gameplay.

## H. Quest entry scenario cho vertical slice
- `Q001`: nói chuyện Lilia, nhận lời giới thiệu Vị Linh.
- `Q002`: tiếp cận bảng nhiệm vụ, xác nhận nhiệm vụ tìm nguyên liệu.
- `Q003`: mở rương tutorial, thưởng được đánh dấu đã claim.
- `Q004`: đi qua cổng rừng, đánh một quái encounter có telegraph.
- `Q005`: trở lại Lilia, nộp nguyên liệu và mở khóa team builder.

Từng bước cần hiển thị waypoint, thoại ngắn, cập nhật objective từ event rules. Không tạo quest chỉ dựa trên click UI không được xác nhận.

## I. Acceptance tests (ít nhất)
1. Từ spawn đến Lilia, chest, forest gate có đường đi hợp lệ (test nav graph + playtest).
2. Player vào/ra hai nội thất, vị trí và hướng nhân vật vẫn đúng; không mắc kẹt cửa khi bấm E nhanh.
3. Mọi chest có reward idempotency qua reload/offline reconnect; số lượng item không nhân đôi.
4. Ít nhất 5 điểm tương tác xuất hiện trên đường đi sớm, không có điểm sáng “giả” không hoạt động.
5. NPC không đi xuyên cây/nhà; nhiệm vụ main vẫn tiếp tục nếu Lilia vắng mặt do lịch trình.
6. Roof fade, depth sorting, shadow footprint hoạt động đúng khi đứng trước/sau công trình.
7. Mưa/đêm/particle không che quest marker hoặc làm FPS phá target preset.
8. Object làng dùng naming/ownership/geometry phù hợp, map build fail nếu missing destination hoặc duplicate save key.
