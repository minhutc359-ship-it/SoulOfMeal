# Kiểm thử Web Game Client

## Phạm vi và luồng cảnh

| Cảnh | Bố cục trước | Bố cục hiện tại và nguồn trạng thái |
| --- | --- | --- |
| Login và Sảnh | Trang mở đầu và các nút vào chế độ | Màn mở đầu toàn viewport, sảnh có Bánh Bao Bạch Ngọc chạy rig idle và mở hồ sơ. Sảnh giữ điều hướng chung. |
| Adventure | Canvas trong khung, nhật ký và tổ đội ngoài bản đồ | Canvas toàn viewport, camera giữ tỷ lệ và dùng chung phép chiếu với pointer. HUD, bản đồ, tương tác và nhật ký đọc trạng thái Adventure hiện hành. |
| TCG | Sân và bảng điều khiển hai cột | Sân rộng, bài trên tay và hành động ở mép dưới. Vị trí thả dựa vào luật của ván đấu. Menu chứa cài đặt, nhật ký và thao tác rời trận. |
| Auto Chess | Bàn cờ và shop hai cột | Bàn cờ, chín ghế và shop tích hợp. Giao tranh dùng canvas và kết quả dùng dialog. |
| Vị Linh, Gacha, Cửa hàng | Khung nội dung ở giữa trang | Hồ sơ chia khu vực art và chi tiết, có rig idle cho Vị Linh đã có rig. Gacha dùng nền điện triệu hồi. Cửa hàng dùng cảnh và NPC thương nhân. |

`client/src/shell/sceneNavigation.js` nối lịch sử trình duyệt với cảnh hiện tại. Dialog được ưu tiên khi Back. `client/scene.css` đặt safe area, viewport và bố cục HUD. Các cảnh giữ gameplay và dữ liệu lưu hiện có. Bản mobile dọc vẫn chơi được và có gợi ý xoay ngang cho TCG và Auto Chess.

## Kết quả Chromium

Kích thước vùng chơi đo bằng `getBoundingClientRect()` ở CSS px. Baseline là đầu nhánh v4 của PR #6. Cột Auto Chess đo bàn xếp đội, bên dưới còn có HUD, bench và shop.

| Viewport | Adventure trước → sau | TCG trước → sau | Auto Chess trước → sau |
| --- | --- | --- | --- |
| 1920×1080 | 1203×677 → 1920×1080 | 745×893 → 1884×824 | 745×756 → 1884×726 |
| 1366×768 | 974×548 → 1366×768 | 745×589 → 1335×517 | 745×464 → 1335×444 |
| 844×390 | 316×178 → 844×390 | 462×243 → 825×252 | 462×142 → 825×135 |
| 390×844 | 354×199 → 390×844 | 370×316 → 378×577 | 370×177 → 378×403 |
| 360×740 | 324×182 → 360×740 | 340×304 → 348×481 | 340×155 → 348×318 |
| 1024×768 | 686×386 → 1024×768 | 603×596 → 1000×517 | 603×473 → 1000×444 |

Smoke test thực hiện onboarding, đi tới NPC, mở map và nhật ký, đổi bài và mở kết quả TCG, mua và xếp quân Auto Chess, đổi Vị Linh, mở tỷ lệ Gacha và dialog mua vật phẩm. Kiểm tra ba sân chơi, menu Back, tràn GameShell, vị trí nút được đo, vùng ảnh bench, số ô bench, grid trong giao tranh và lỗi JavaScript của trang. Hướng dẫn chạy nằm trong `client/README.md`.

Phép đo ngắn với `requestAnimationFrame` trên Chromium 153 headless Linux ở 1366×768. Mỗi cảnh được lấy mẫu ba giây ở trạng thái nghỉ, có hiệu ứng mặc định.

| Cảnh | FPS trung bình | P95 khoảng cách giữa frame |
| --- | --- | --- |
| Adventure trong làng | 59,3 | 16,8 ms |
| TCG sau đổi bài | 60,0 | 16,7 ms |
| Auto Chess khi chuẩn bị | 60,0 | 16,7 ms |

Build cục bộ khoảng 73 MiB. Vite báo chunk Phaser 1,39 MB trước gzip. Mẫu `performance.memory` trả về khoảng 28 MiB heap JavaScript. RAM tiến trình, điện thoại thật và trận nhiều VFX cần phép đo riêng.

## Nghiệm thu còn mở

- Safari iOS thật, thay đổi thanh địa chỉ và safe area trên thiết bị. Môi trường này đã tải WebKit, còn thiếu các thư viện hệ thống để khởi chạy.
- Một số nút phụ Auto Chess ở màn hình ngang thấp và nút chi tiết bài TCG nhỏ hơn mục tiêu 44 px. Nút Chiến đấu Auto Chess cao 44 px.
- Cần người chơi nghiệm thu các chuỗi TCG phản ứng dài, Adventure boss và gacha hoặc thanh toán qua tài khoản thật. Bản smoke dùng save khách và thử mở dialog mua hàng.
- Cinematic nâng cao, preset 30 FPS, đồ họa và rig cho roster mở rộng, telemetry và xác nhận art nằm trong các đợt tiếp theo. Các quyết định về art, quy mô HUD và thiết bị tối thiểu vẫn thuộc chủ sản phẩm.

Nhánh thay đổi xếp trên PR #6. Khi đưa lên `main`, tích hợp bản v4 trước hoặc đưa cả hai thay đổi qua review. Có thể hoàn tác riêng commit UI mà vẫn giữ bản v4.
