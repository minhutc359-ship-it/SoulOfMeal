# Soul of Meal Web Client–Server · SPEC v3.2

**Ngày** 2026-11-11 · **Trạng thái** Bản chơi thử đã có vỏ game, màn chơi khách và sảnh với lớp nền Phaser. Migration gameplay/server và benchmark còn mở. [D-018](../00_foundation/decisions/D-018.md) quy định phạm vi thay đổi. Xem [đối chiếu concept](../04_qa/PLAYTEST_CONCEPT_GAP.md) để biết trạng thái mã nguồn.

## 1. Nền tảng đích

Soul of Meal chạy qua một đường dẫn HTTPS trên Chrome, Edge và các trình duyệt đạt ma trận hỗ trợ. Một web app, một phiên đăng nhập và một viewport game phục vụ Home, Làng Ẩm Thực, Adventure, TCG, Auto Chess, Vị Linh và Triệu Hồi. Người chơi vào game theo luồng Login → Loading → Home hoặc khu vực hợp lệ trên server. Game tải phiên bản nội dung và tài nguyên qua mạng.

| Thành phần | Thiết kế đích |
|---|---|
| Client | Phaser 4, TypeScript và WebGL. Một instance Phaser sở hữu map, camera, scene, combat HUD, animation và VFX. |
| React | Login, đăng ký, khôi phục tài khoản, cài đặt và overlay cần form, focus hoặc công nghệ hỗ trợ. Dùng chung viewport và session với Phaser. |
| Animation | `@esotericsoftware/spine-phaser-v4` cho rig được duyệt, sprite atlas cho asset dạng frame, cùng một hợp đồng clip và socket. |
| Audio | Web Audio qua một mixer chung cho Music, SFX, Voice, Ambience. Chọn Phaser Sound Manager hoặc Howler ở bước thử tích hợp dựa trên nhu cầu của canvas và overlay. |
| Server | ASP.NET Core trên .NET 10 LTS, REST cho account/progression và lệnh theo lượt, SignalR qua WebSocket cho kênh realtime. Bắt đầu với một ứng dụng có các module rõ ràng. |
| Dữ liệu | PostgreSQL cho account, profile, inventory, mốc quest, deck, sổ cái phần thưởng và dữ liệu phục hồi trận. Redis cho cache, presence, phiên trận nóng và phối hợp giữa các instance. |
| Nội dung | Object Storage + CDN cho manifest, gói scene, atlas, rig, VFX và audio. Dữ liệu gameplay có catalog version. |

Backend render Spine dùng Mesh2D của Phaser yêu cầu `phaser >= 4.2.1` và `@esotericsoftware/spine-phaser-v4 >= 4.3.11`. Dùng bộ phiên bản đã thử cùng nhau, pin patch bằng lockfile. Runtime Spine và Spine Editor xuất rig phải khớp major.minor. Đưa một rig Golden Sample qua thử nghiệm trình duyệt và kiểm tra điều khoản giấy phép trước khi tích hợp Spine vào bản phát hành. [Phaser 4.2](https://phaser.io/news/2026/07/phaser-4-2-spine-renderer-mesh2d-stencil) · [Spine Phaser](https://esotericsoftware.com/spine-phaser) · [.NET Support Policy](https://dotnet.microsoft.com/en-us/platform/support/policy)

## 2. Luồng vào game và giao diện

| Màn / scene | Hành vi và tiêu chí nghiệm thu |
|---|---|
| Boot → Login | Khung anime toàn viewport ngay khi vào. Logo và form ở bên trái trên desktop, dàn Vị Linh và làng đèn ở phần còn lại theo ảnh đăng nhập đính kèm. Tách illustration, logo, lớp tiền cảnh và form để hỗ trợ ngôn ngữ, bàn phím và màn hẹp. |
| Login | Có tài khoản/email, mật khẩu, đăng nhập, đăng ký và phục hồi qua các luồng đã cấu hình. Google/Facebook/Apple trong concept là tuỳ chọn theo provider. Chỉ hiển thị phương thức hoạt động. Tóc, vạt áo, lá và đèn lồng chuyển động nhẹ bằng lớp ảnh hoặc rig được duyệt. Có chế độ giảm chuyển động. |
| Loading | Sau xác thực, lấy bootstrap từ server và tải gói tối thiểu cho Home/Làng. Hiện tiến độ theo tài nguyên bắt buộc đã tải, có thử lại và thông báo lỗi theo bước. Mở scene khi profile và gói bắt buộc đã sẵn sàng. |
| Home / Làng Ẩm Thực | Hub trong game có nhân vật, khung tài nguyên và lối vào Adventure, TCG, Auto Chess. Vị Linh, Nhiệm Vụ, Cài Đặt và Triệu Hồi dùng scene hoặc overlay cùng viewport theo phạm vi tính năng. |
| Adventure | Bản đồ, quest, party, HP/năng lượng, tương tác và kỹ năng trong HUD. Bàn phím và cảm ứng dùng chung lớp input. |
| TCG | Bàn đấu, hàng quân, mana, HP, stack, vùng bẫy và tay bài trong một viewport chiến thuật. Chi tiết thẻ dùng overlay. |
| Auto Chess | Bàn cờ, bench, shop, hiệp lực, bộ đếm pha và kết quả trong một viewport chiến thuật. Chuẩn bị và chiến đấu cùng scene. |
| Vị Linh và Triệu Hồi | Dùng portrait, clip, chỉ số, kỹ năng và inventory cùng ID. Cảnh reveal hiển thị kết quả server. Trang bị, thân thiết, banner và lịch sử được bật theo phạm vi nội dung. |

Thiết kế desktop theo canvas logic **1920×1080, 16:9**. Scale theo tỉ lệ. Canvas và React overlay dùng cùng phép tính viewport/insets. Login/Home có bố cục gọn cho màn portrait. Các trận chiến thuật ưu tiên landscape, với thao tác chính truy cập được trong viewport. Toàn màn hình trình duyệt là tuỳ chọn từ nút trong game. Quy đổi toạ độ input về logical pixels sau khi scale. [Phaser Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager)

Mỗi scene đăng ký bundle, điều kiện vào, vòng đời input/audio và quy tắc thoát. Overlay quản lý focus và tắt input gameplay khi đang nhập form. Rời scene giải phóng listener, timer, camera effect và bundle riêng khi hết người dùng. Nếu hết phiên, trả về Login và tiếp tục scene từ bootstrap hợp lệ.

## 3. Quyền quyết định trạng thái

| Miền | Server | Client |
|---|---|---|
| Account và profile | Xác thực, tạo session, truy cập dữ liệu theo account và xác định cảnh có thể vào. | Form, phản hồi lỗi, settings trình bày. |
| Adventure | Xác nhận lệnh ảnh hưởng tiến trình, lịch đánh, năng lượng, HP, quest, rương, phần thưởng. | Nội suy di chuyển, camera, HUD, hình ảnh, âm thanh. |
| TCG | Luật lượt/ưu tiên, deck, bài úp, mana, stack, kết quả. Tạo view riêng từng người chơi và lược bài đối thủ trước khi gửi. | Hiển thị bài được phép biết, thao tác, hiệu ứng và lịch sử công khai. |
| Auto Chess | Shop, vàng, đội hình, tỉ lệ, đối thủ, resolve và payout. | Bố trí xem trước, hiển thị combat và replay từ sự kiện hợp lệ. |
| Kinh tế và Triệu Hồi | Transaction cho trừ tài nguyên, kết quả, inventory và sổ cái. Tỉ lệ/banner theo cấu hình đã duyệt. | Hiện banner, tỉ lệ và kết quả từ server. Animation reveal hỗ trợ bỏ qua hoặc phát lại. |

Render đọc sự kiện đã xác nhận để phát animation, VFX và âm thanh. HP, vàng, inventory, mana và tiến trình chỉ thay đổi qua bộ luật. Adventure giữ bước mô phỏng 30 tick/s theo baseline, độc lập với tốc độ render. TCG xử lý theo thứ tự lệnh và stack. Dùng cùng fixture, seed, thứ tự sự kiện và quy tắc làm tròn để đối chiếu JavaScript/Python hiện có với C# khi chuyển từng mode sang server. Quy tắc gameplay lấy từ rulebook, ADR và catalog.

## 4. API, phiên đăng nhập và phục hồi

Các endpoint là hợp đồng đề xuất để bắt đầu triển khai.

| Endpoint / kênh | Hành vi |
|---|---|
| `POST /api/v1/auth/login` và `POST /api/v1/auth/logout` | Đăng nhập và thu hồi session. Phương án cơ sở dùng ASP.NET Core Identity với cookie `Secure`, `HttpOnly`, `SameSite` phù hợp và bảo vệ CSRF cho thao tác thay đổi trạng thái. |
| `GET /api/v1/me/bootstrap` | Trả profile, quyền vào mode, settings, `save_revision`, phiên trận có thể nối lại, `catalog_version` và `asset_build_id`. |
| `POST /api/v1/matches` | Tạo trận được phép, xác thực sở hữu đội hình/deck và pin rules/catalog cho trận. |
| `POST /api/v1/matches/{id}/commands` hoặc SignalR `SubmitCommand` | Lệnh có `command_id`, `expected_revision`, loại lệnh và payload theo schema. Server suy ra account từ phiên và xác thực quyền, pha, mục tiêu, chi phí. |
| `GET /api/v1/matches/{id}/snapshot` hoặc SignalR `ResumeMatch` | Snapshot theo quyền xem và sự kiện sau cursor còn giữ. Nếu quá phạm vi phát lại, dùng snapshot và cursor mới. |
| `POST /api/v1/rewards/{rewardId}/claim` | Ghi một lần cho phần thưởng hợp lệ. Retry dùng cùng định danh để nhận kết quả đã ghi. |
| `POST /api/v1/summon` | Dành cho mốc có banner đã duyệt. Kiểm tra điều kiện và tài nguyên, ghi kết quả trước khi trả cho màn reveal. |

Dùng cùng origin cho web shell và API qua reverse proxy. Giới hạn origin cho realtime, xác thực quyền từng phòng, giới hạn tần suất lệnh và loại token khỏi log. Phân biệt mất mạng, hết phiên, state cũ và lệnh từ chối bằng mã lỗi. Ràng buộc duy nhất theo người gửi và `command_id` để xử lý lệnh lặp. Khi revision xung đột, tải lại trạng thái có thẩm quyền, hiển thị phản hồi và chỉ phát lại thao tác còn hợp lệ. [ASP.NET Core antiforgery](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0) · [SignalR security](https://learn.microsoft.com/aspnet/core/signalr/security?view=aspnetcore-10.0)

Sự kiện trình bày có `match_id`, `rules_version`, `catalog_version`, `tick` hoặc `action_seq`, `stream_seq`, `type`, `source_id`, `target_id` và payload theo quyền xem. Cursor client dùng `stream_seq` của view đó. Dedupe theo `(match_id, stream_seq)`, phục hồi khoảng trống bằng resume/snapshot. PostgreSQL giữ dữ liệu bền và sổ cái giao dịch. Redis giữ trạng thái nóng, có thể tái dựng từ snapshot/event đã ghi bền.

Save của bản chơi thử có thể mở trong chính bản chơi thử. P0 online tạo profile server khi đăng nhập. Nếu sau này cần nhập tiến trình demo, thiết kế quyền nhập và ánh xạ riêng trước khi ghi inventory online. Local data dùng cho settings, cache hoặc luyện tập cục bộ.

## 5. Phân phối và cập nhật

Bootstrap pin `asset_build_id` và `catalog_version`. Manifest tải qua CDN. Các file theo hash có thể cache dài, con trỏ phát hành được kiểm tra lại khi vào game. Tải bundle bắt buộc trước khi chuyển scene. Một trận đang chạy tiếp tục theo phiên bản đã pin. Tải nội dung mới ở nền và áp dụng ở Home hoặc phiên kế tiếp. Giữ các build cũ trong thời hạn phiên cần dùng và thử đường rollback. Xem [pipeline asset](../02_art/WEB_ASSET_PIPELINE.md).

## 6. Thứ tự triển khai và cổng xác nhận

| Mốc | Đầu ra | Điều kiện qua |
|---|---|---|
| 1. Web shell và thử renderer | Phaser + TypeScript + React, Login/Loading/Home; một map, năm sprite và một Golden Sample rig khi có dữ liệu hợp lệ. | Chrome/Edge mở được, input scale đúng, scene lifecycle và asset tải lại ổn định. Đo CPU/GPU, FPS và texture memory. |
| 2. Tài khoản và save | ASP.NET Core, PostgreSQL, session, bootstrap và progression tối thiểu. | Đăng nhập lại từ trình duyệt khác đọc đúng profile. Retry nhận thưởng, hết phiên và lỗi mạng xử lý đúng. |
| 3. Chuyển ba chế độ | Adventure → TCG → Auto Chess trong cùng app. Chuyển quyền xử lý và dữ liệu bền sang server theo từng mode. | Một vòng chơi có đầu/cuối cho mỗi mode, kết quả theo fixture, UI và reconnect qua checklist. P0 là đấu bot theo D-004. |
| 4. Nội dung và phát hành | Nghiệm thu rig/cut-in/HUD và audio, asset CDN và rollback. | Bằng chứng trên trình duyệt và thiết bị thật. PvP và gacha trả phí theo các mốc phê duyệt riêng. |

Mục tiêu trên PC phù hợp là **60 FPS** ở viewport tham chiếu 1920×1080. Đo trên Chrome/Edge với Golden Sample, năm Vị Linh, boss, HUD và VFX đồng thời. Lưu cấu hình máy, engine, độ phân giải, frame time p50/p95, draw calls, bộ nhớ texture và thời gian tải cold/warm. Đo thêm máy phổ thông và thiết bị giới hạn. Kiểm thử mất WebGL context, hiển thị lỗi có thể thử lại.
