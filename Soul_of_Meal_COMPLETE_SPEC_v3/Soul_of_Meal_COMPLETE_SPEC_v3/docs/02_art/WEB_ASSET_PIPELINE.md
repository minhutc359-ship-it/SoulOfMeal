# Pipeline tích hợp asset cho Web Client–Server

## 1. Đầu vào và nhận diện

Dùng [Project Bible](../00_foundation/PROJECT_BIBLE.md), `examples/characters/*/identity.json`, [Sprite Pipeline](SPRITE_PIPELINE.md) và AI Sprite Agent hiện có. Một `character_id` liên kết portrait, card art, chibi map, chibi battle, skin và VFX trong các mode. Dữ liệu chỉ số theo từng mode. Concept art hướng dẫn hình dáng, màu sắc, bố cục và nhịp trình bày. Frame count, tên chiêu, thời gian và chỉ số lấy từ catalog/ADR đã duyệt.

Lưu sheet nguồn, layer và quyền sử dụng trong vùng sản xuất. Ghi prompt, công cụ/model, SHA-256, trạng thái duyệt và mục đích sử dụng. Tạo art mới từ đặc tả và giữ nhận diện giữa frame. Lưu PNG RGBA theo frame, cùng pivot/ground anchor và hướng. Dùng lệnh trong [hướng dẫn art](ORIGINAL_ART_PLAYTEST.md) để xuất và kiểm tra asset hiện có.

## 2. Hai đường tích hợp theo asset

| Đường | Nguồn và export | Cách phát trong Phaser |
|---|---|---|
| Sprite atlas | PNG RGBA từng frame, JSON clip, anchor và socket/cue. Compile atlas có metadata và padding. WebP hoặc PNG phù hợp với alpha và kiểm tra trình duyệt. | Loader nạp qua asset ID. Sprite adapter ánh xạ clip và hướng sang frame sequence, đặt pivot, scale và depth theo scene. |
| Spine 2D | Source `.spine` và layer, ảnh export, skeleton JSON hoặc binary, `.atlas`, texture pages. Ghi editor major.minor, runtime và phiên bản export. | `spine-phaser-v4` nạp skeleton/atlas. Adapter dùng chung clip/skin/socket IDs, quản lý pool và giải phóng instance theo scene. Kiểm tra bằng rig Golden Sample trước khi đưa vào catalog release. |

Hợp đồng chung gồm `asset_id`, `character_id`, `skin_id`, `renderer_kind`, `clips`, `directions`, `ground_anchor`, `sockets` và tên cue. Dùng cùng ground anchor và nhận diện cho frame và rig. Manifest có thể khai báo atlas nhẹ đã duyệt. Ghi rõ hướng hoặc clip chưa có trong manifest và QA. Projectile hiển thị theo socket khi có, theo quỹ đạo và va chạm do mô phỏng xác nhận. [Spine Phaser](https://esotericsoftware.com/spine-phaser) · [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license)

## 3. VFX, âm thanh và giao diện

- Mỗi kỹ năng ánh xạ Cast → Travel nếu có đường đi → Impact → Aftermath. Vòng cast, projectile, va chạm và dư quang là tài nguyên hoặc lớp render có thể kiểm thử độc lập. Buff, debuff, heal, shield và burst dùng nhận diện riêng.
- `hit_resolved` hoặc sự kiện gameplay tương ứng làm mốc impact. Cut-in có thể rút ngắn hoặc bỏ qua theo cài đặt. Dedupe cue audio/VFX khi nhận lại sự kiện sau reconnect. Clip Spine/frame chứa cue trình bày để đồng bộ âm thanh và camera.
- Chuẩn nguồn audio và mixer theo D-013. Kiểm thử codec, user gesture đầu tiên, mute độc lập và giảm chuyển động.
- Login cần illustration nền, logo, form React, lớp tiền cảnh/đèn lồng/lá, optional rig cho nhân vật. Xuất riêng các lớp để co giãn và tránh chữ/nút dính vào ảnh nền. Home và chiến đấu dùng cùng nhận diện khung, màu và icon.

## 4. Manifest và gói tải

Manifest versioned ghi schema, build ID, catalog version, tương thích client, `bundles` và các bundle phụ thuộc. Mỗi asset có ID, type, URL theo hash, SHA-256 và byte size. Metadata Phaser/Spine ghi các ID phụ thuộc. Resolve ID qua catalog trước lúc tải scene.

| Gói | Khi nạp | Ví dụ |
|---|---|---|
| `login` | Boot | Nền login, logo, UI font/khung tối thiểu |
| `core` | Sau login | HUD chung, icon, audio cơ bản và khung Home |
| `village`, `adventure` | Vào làng hoặc mở Adventure | Map, chibi, boss, VFX combat, ambience |
| `tcg`, `auto_chess` | Khi chọn mode, có thể prefetch ở Home | Bàn đấu, thẻ, shop, audio và VFX riêng |
| `character`, `summon` | Mở overlay hoặc scene phù hợp | Portrait độ phân giải cao, rig và reveal |

Pipeline build phát hiện ID trùng, clip/direction bắt buộc thiếu, sai alpha/neo frame, atlas vượt kích thước đã chọn, file/audio không giải mã được, rig–runtime không tương thích và thiếu provenance. Upload file theo hash trước, sau đó manifest và con trỏ release. Kích hoạt bundle khi các file bắt buộc đã sẵn sàng, giữ con trỏ cũ để rollback. Browser đo dung lượng tải, số texture đang sống và tài nguyên bị thiếu. CDN phục vụ các file theo phiên bản trận đang sử dụng và cấu hình CORS phù hợp.

## 5. Sản xuất bằng AI

Có thể tạo concept, pose nguồn, họa tiết và biến thể trong Gemini hoặc công cụ tạo ảnh hiện có rồi nhập PNG vào pipeline QA. Cách đơn giản là tạo bên ngoài và tải file đầu ra, dùng cùng mô tả nhận diện, kích thước, hướng và pose. Rig, chỉnh frame, thống nhất kiểu tóc/vũ khí, kiểm tra alpha, atlas và timing tiếp tục thuộc công việc sản xuất. Khi cần tạo hàng loạt có kiểm soát, công cụ nội bộ có thể dùng Gemini API qua khóa dự án với hạn mức riêng. Game client chỉ nạp asset đã xuất qua CDN. [Tạo ảnh trong Gemini](https://support.google.com/gemini/answer/14286560?hl=vi-VN) · [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key) · [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
