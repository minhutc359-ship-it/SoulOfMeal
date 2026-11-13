# World Interaction V2 — Nghiệm thu P0

Baseline Git `ab4ca49`. Thay đổi áp dụng cho web client trong trình duyệt.

| ID | Trạng thái | Đã thực hiện | Còn thiếu |
| --- | --- | --- | --- |
| P0-01 | PARTIAL | Polygon và mask che khuất cho Làng Ẩm Thực. Kiểm tra spawn và tọa độ đích từ registry khi nạp. | Công cụ Tiled/LDtk hoặc trình chỉnh sửa polygon trực quan. Các vùng khác vẫn dùng dữ liệu cản hiện có. |
| P0-02 | DONE | Quy chiếu theo tọa độ map, hitbox và bóng tại chân, sắp thứ tự nhân vật và vật thể theo chân. Mask riêng cho mái cổng. | |
| P0-03 | DONE | Dùng cùng một phép thử va chạm liên tục cho di chuyển, từng cạnh đường đi và truy cập cổng/cửa. Có xử lý vị trí cũ nằm trong vật cản. | |
| P0-04 | PARTIAL | Khung bàn 16:9 giữ tỷ lệ khi thay đổi viewport. Ô chuẩn bị vẫn là HTML, replay dùng canvas. | Chuyển phần bàn chuẩn bị sang renderer nếu cần cho bản mỹ thuật sau. |
| P0-05 | DONE | Gameplay chiếm viewport. Điều hướng sảnh ẩn trong trận. | |
| P0-06 | DONE | Nhiệm vụ, minimap và thao tác theo góc màn hình. Đội hình thu về nút mở drawer khi đi bộ. | |
| P0-07 | PARTIAL | Hồ sơ 60/40, art/rig, đơn vị chỉ số, bốn ô trang bị, thử kỹ năng, lọc danh sách và thao tác đội hình. | Asset HD và gesture mới, so sánh trang bị chuyên biệt. |
| P0-08 | PARTIAL | Mulligan theo lớp, tay bài dễ đọc hơn, điểm đặt hợp lệ, đường chỉ mục tiêu, xem bài lớn. Luật v3 vẫn dùng 4 ô Vị Linh và 1 ô bẫy mỗi bên. | Chưa hoàn tất playtest một ván có đủ chặn, phép nhanh và bẫy trong cùng luồng UI. |
| P0-09 | DONE | Ẩn grid từ lúc khóa đội hình, chỉ hiện canvas giao tranh, kết quả ở popup. Có thể kéo thẳng quân mua vào ô trống hoặc chạm để mua vào ghế. | |
| P0-10 | PARTIAL | Unit test đường đi, va chạm và vị trí cổng. Smoke test Chromium cho desktop, tablet và hai hướng mobile. | Safari iOS và Chrome Android trên thiết bị thật, QA hiệu năng và đo safe area thực tế. |

## Đo ở 844 × 390

| Vùng | Trước | Sau |
| --- | ---: | ---: |
| Bàn Auto Chess | 825 × 135 px | 430 × 242 px |
| Bàn TCG ở mulligan | 825 × 252 px | 825 × 344 px |
| Vùng chân dung Vị Linh | 363 × 181 px | 485 × 281 px |

Ở landscape thấp, shop đặt bên phải và bench vẫn nằm dưới bàn. Portrait có bố cục dọc và đặt shop dưới sân. Lobby dùng một thanh shortcut và Vị Linh đồng hành. Bản này tái sử dụng art và âm thanh hiện có.

## Sửa hình học map

`examples/maps/village.json` là nguồn dữ liệu runtime cho Làng Ẩm Thực. Khai báo `collision.obstacles` bằng `rect` hoặc `polygon` lồi với mảng `[x, y]` theo tọa độ world. Tách hình lõm thành nhiều polygon lồi. Mỗi vùng `layers.occlusion` lấy lại phần tranh nền đã cắt và hiển thị khi nhân vật có tọa độ chân nhỏ hơn `depth`. Ghi điểm thao tác bên ngoài collider và khai báo spawn bên map đích. Registry kiểm tra world bounds, mask, spawn và đích của transition đã đăng ký.

## Chạy lại

```bash
npm --prefix client test
npm --prefix client run typecheck
npm --prefix client run build
python3 -m unittest discover -s tests
python3 scripts/validate_package.py .
# Khi Vite đã chạy ở cổng 4173 và Playwright đã có Chromium
SOM_UI_OUTPUT=/tmp/soul-of-meal-qa node client/scripts/smoke-web-client.cjs
```
