# Hoàn thiện danh mục và minh họa ba chế độ

Ngày kiểm tra: **15/11/2026**. Nền: `codex/three-mode-spec-upgrade`, sau `e711988`, giữ các thay đổi mobile-navigation-combat.

## Phần đã triển khai

| Phạm vi | Kết quả |
| --- | --- |
| Danh mục chung | Đủ 24 Vị Linh trong Adventure, 79 thẻ TCG và 27 quân Auto Chess (24 Vị Linh, Tiêu Tinh, Nấm Lạc Vị và Lilia). ID, hệ và nhận diện dùng chung; chỉ số theo từng chế độ. |
| Minh họa | 79 ảnh thẻ riêng và một mặt sau thẻ, mỗi ảnh gốc 1024×1536, WebP HD và preview 512×768. 24 hồ sơ Vị Linh lấy đúng minh họa theo ID. Không thay sprite di chuyển/rig bằng tranh thẻ. |
| Giao diện | Bộ sưu tập ở sảnh và trình sửa bộ bài, tìm theo tên, lọc thẻ/Vị Linh và hệ, xem ảnh HD. Khung thẻ hiển thị mana, hệ, vai trò, độ hiếm, luật và ATK/DEF lấy từ catalog. |
| Combo TCG | **Hương Vị Bùng Nổ** cho ván v4 mới: trong lượt của mình, thi triển thành công phép Hỏa, Thủy, Mộc và có quân sống thuộc đủ ba hệ. Một lần mỗi lượt; gây 350 lên từng quân địch và 200 HP chủ soái. Thông số **PROPOSED**, nằm trong `tcgCombos.proposed.json`. Phép bị hóa giải hoặc mất mục tiêu không đóng góp. |
| Âm thanh | Chuyển nhạc bằng crossfade 800 ms, dùng `epic_boss_battle` chung cho ba chế độ. Bỏ module, MP3, TTS và tùy chọn voice; giữ đối thoại chữ. Không thay soundtrack đang dùng. Giữ nhịp trình diễn 70%. |
| Ngoại tuyến | Gói cơ bản có preview; 80 ảnh HD là gói tải thêm trong Cài đặt. SHA-256 kiểm tra từng tệp. Lỗi tải HD dọn phần tải dở và giữ gói chơi. Chặn tải HD nếu build thay đổi giữa hai lần đọc danh mục. |
| Tương thích | Giữ save v2. Ván TCG thiếu `elementalComboVersion` giữ luật cũ. Ván Auto Chess mới lưu `catalogSnapshot`; ván cũ dùng tám quân, giá và chỉ số lịch sử. Cấp độ/trang bị Adventure không cộng vào chỉ số hai chế độ chiến thuật. |

## Kiểm tra

- Mốc kiểm tra gameplay trước: **186/186 JavaScript**, **66/66 Python**, TypeScript và Vite production build đạt. Lượt kiểm tra đồng bộ Git có thêm ba bài về gói nguồn ảnh; xem [báo cáo nghiệm thu mã nguồn](RELEASE_READINESS_AUDIT.md) cho kết quả mới và phạm vi chưa được nghiệm thu.
- Kiểm tra SHA-256, định dạng WebP, kích thước, tính riêng biệt của 79 ảnh thẻ và ánh xạ đủ 24 Vị Linh. Đã xem bốn bảng tổng hợp của 80 minh họa: nhận diện nhân vật, trọng tâm cảnh và độ rõ ở kích thước preview.
- Kiểm thử combo bao gồm lưu/tải giữa chuỗi phép, bị hóa giải, thiếu quân sống, giới hạn một lần và reset lượt, tương thích ván cũ. Crossfade kiểm tra đổi cảnh liên tục, chuyển boss/quay lại, mute và hoàn tất nhạc cũ. Kiểm thử MP3/Web Audio cũng xác nhận hai nhạc trộn trong thời gian chuyển cảnh, nhạc cũ dừng khi hết fade và mọi nhạc dừng khi tắt tiếng.
- Gói build hiện tại: **346 tệp cơ bản, 62,3 MiB**; **80 tệp HD tùy chọn, 49,0 MiB**. Kích thước có thể thay đổi theo build.
- Chromium headless bị môi trường chặn tạo socket (`Operation not permitted`); trình duyệt kiểm thử từ xa không truy cập được địa chỉ localhost của preview. **Chưa nghiệm thu DOM/giao diện mới, nghe chuyển nhạc trực tiếp hoặc thiết bị iOS/Android thật trong lần này.** Bằng chứng trình duyệt cũ ở tài liệu trước không được tính là kết quả cho bộ minh họa mới.

## Nghiệm thu tiếp trên preview của PR

Lượt kiểm tra đồng bộ Git ngày 15/11/2026 ghi tại [RELEASE_READINESS_AUDIT.md](RELEASE_READINESS_AUDIT.md). Gói nguồn khôi phục ảnh trước khi chạy kiểm thử; file index kiểm tra cả nguồn và ảnh runtime. Chưa bổ sung bằng chứng DOM, nghe nhạc hoặc viewport thiết bị cho bộ minh họa mới. Việc cập nhật tài liệu làm rõ phạm vi sprite và các tùy chọn âm thanh hiện có; không bổ sung lại narration.

1. Hồ sơ khách mới → nhận starter → mở bộ sưu tập; kiểm tra đủ 79 thẻ/24 Vị Linh, lọc từng hệ và tìm tên tiếng Việt.
2. Xem thẻ, đọc mana/ATK/DEF, mở HD rồi đóng để trở lại đúng hộp thoại; thử màn dọc 390×844 và ngang 844×390.
3. Tải gói cơ bản, ngắt mạng, mở ảnh preview của từng hệ. Tải thêm HD, ngắt mạng và mở lại HD. Giả lập thiếu dung lượng khi tải thêm.
4. Adventure vào/ra boss; TCG khiêu chiến; Auto Chess vòng boss: nghe nhạc vào/ra liên tục, thử mute, chuyển tab và quay lại.
5. Chơi combo đủ ba hệ và thử hóa giải phép thứ ba. Tải lại khi mới dùng hai hệ; kiểm tra thưởng/trạng thái ván không đổi ngoài luật combo.

Nguồn gốc, hash và prompt theo từng ảnh: [SPLASH_ART_JOBS.json](../02_art/SPLASH_ART_JOBS.json). Bộ art là bản nháp có kiểm tra kỹ thuật và rà hình tổng hợp; vẫn cần duyệt mỹ thuật và quyền phát hành của con người. Cân bằng danh mục mới vẫn **PROPOSED**.
