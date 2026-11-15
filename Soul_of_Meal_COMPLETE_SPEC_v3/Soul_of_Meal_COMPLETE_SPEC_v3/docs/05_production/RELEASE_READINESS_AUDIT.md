# Kiểm tra trạng thái Soul of Meal

Ngày: **15/11/2026**. Nhánh: `codex/three-mode-spec-upgrade`; nền GitHub trước khi đồng bộ: `e711988`. Phần gameplay và art được tiếp nối từ commit cục bộ `76fe9cb`.

## Kết luận

**Đã có bản chơi thử ba chế độ; chưa đạt nghiệm thu phát hành 1.0 hay hoàn thiện 100% theo đặc tả.** Kết quả test tự động kiểm tra luật, dữ liệu và build; không thay thế việc chơi thử và đo hiệu năng trên thiết bị thật.

| Phạm vi | Đã có | Còn cần nghiệm thu/triển khai |
| --- | --- | --- |
| Adventure | Sáu chương, nhiệm vụ, khám phá có đường đi/va chạm, đội năm người, boss, checkpoint và thưởng. | Chơi trọn hành trình mới trên thiết bị thật; cân bằng; duyệt rig, biểu cảm, hướng và hiệu ứng theo production spec. |
| TCG | 79 thẻ, 24 Vị Linh, bot, ván mới năm vị trí/hai bẫy, phản ứng và combo Hỏa–Thủy–Mộc; ván cũ giữ phiên bản. | Cân bằng bộ bài/bot, thao tác trên điện thoại và phục hồi cửa sổ phản ứng. PvP/reconnect theo quyền xem ở mốc riêng. |
| Auto Chess | 27 quân, bàn lục giác, chín ghế, kho quân, hợp thể, hiệp lực, trang bị và lobby bảy bot; ván mới giữ catalog snapshot. | Cân bằng kinh tế/AI, giao diện ngang thấp và playtest nhiều ván. Phòng online/matchmaking ở mốc riêng. |
| Hình ảnh/âm thanh | 79 minh họa thẻ riêng và mặt sau, mỗi ảnh có HD/preview; crossfade 800 ms, nhạc boss chung; hội thoại chữ, nhịp trình diễn 70%. | Duyệt mỹ thuật/nguồn quyền phát hành, nghe chuyển nhạc và đo texture/audio trên thiết bị. |
| Client và dữ liệu | Lưu khách, tài khoản ASP.NET Core/PostgreSQL theo thiết kế hiện có; xuất save và ngoại tuyến kiểm tra SHA-256. | Luật chiến đấu/thưởng/inventory do server quyết định, hoàn thiện chuyển battle sang Phaser và benchmark WebGL/Spine. Backend chưa được build hoặc chạy lại trong lượt kiểm tra này. |

Thông số cân bằng chưa được duyệt tiếp tục **PROPOSED**. Xem [kế hoạch production](PRODUCTION_PLAN.md), [đối chiếu concept](../04_qa/PLAYTEST_CONCEPT_GAP.md) và [QA danh mục/minh họa](SHARED_ROSTER_SPLASH_QA.md).

## Hoàn thiện đóng gói để đồng bộ Git

- Giữ bộ nguồn 160 WebP trong 17 gói gzip và manifest SHA-256. `npm ci` hoặc Vite khôi phục ảnh đúng đường dẫn; không thay đổi byte/hình/chất lượng. Gói nguồn không được đưa vào bản web hay tải ngoại tuyến.
- Ngừng theo dõi bản WebP sinh ra trong Git; giữ tệp cục bộ và kiểm tra chúng trong `FILE_INDEX.json`. Hướng dẫn checkout mới chạy bước khôi phục trước kiểm tra.
- Bổ sung ba kiểm thử về khôi phục/ảnh hỏng, gói thiếu/hỏng và chặn đường dẫn ra ngoài thư mục ảnh. Sửa kiểm tra chân dung của script smoke để dùng đúng mapping splash hiện tại.

## Bằng chứng của lượt kiểm tra

Kiểm tra trên bản xuất từ Git index, không mang theo `node_modules`, `dist` hay ảnh WebP sinh ra của thư mục làm việc:

- `npm --prefix client ci`: **đạt**, postinstall khôi phục đủ **160/160 ảnh**; đối chiếu độc lập kích thước/SHA-256 của từng ảnh đều khớp manifest.
- JavaScript: **189/189 đạt**; Python: **66/66 đạt**.
- TypeScript và Vite production build: **đạt**. Vite còn cảnh báo chunk Phaser lớn; cần đo hiệu năng thực tế.
- Package validator: **đạt, 925 tệp, không có lỗi**. Gói ngoại tuyến cơ bản **346 tệp / 62,3 MiB** và HD tùy chọn **80 tệp / 49,0 MiB**; không chứa gói nguồn.
- Chromium headless bị môi trường chặn tạo socket (`Operation not permitted`), chưa mở được trang. Không có bằng chứng trình duyệt, nghe nhạc hoặc iOS/Android thật mới trong lượt này. Sửa script smoke được kiểm tra cú pháp; chưa được tính là đã chạy smoke giao diện.

## Ưu tiên tiếp theo

1. Chơi thử ba chế độ trên Safari iOS/Chrome Android thật, cả ngang và dọc; kiểm tra preview/HD, xoay màn hình, âm thanh sau quay lại app và save khi mất mạng.
2. Duyệt art/rig và cân bằng danh mục qua nhiều ván; ghi quyết định được duyệt trước khi chốt giá trị.
3. Hoàn thiện quyền quyết định luật/thưởng và inventory trên server, kiểm tra triển khai/khôi phục và chỉ chốt phát hành khi đủ tiêu chí QA.
