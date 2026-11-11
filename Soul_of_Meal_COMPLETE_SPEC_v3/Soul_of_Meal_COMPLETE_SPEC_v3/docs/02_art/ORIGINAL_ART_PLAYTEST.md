# Bộ đồ họa anime chibi của bản chơi thử

Bộ này triển khai nhận diện trong Project Bible và hồ sơ `examples/characters/` cho năm Vị Linh. Mỗi nhân vật có tám pose chiến đấu RGBA mới, atlas WebP, mười clip mẫu, chân dung và cut-in riêng. Bún Bò Hỏa Linh có thêm 12 pose đi bản đồ với bốn hướng vẽ riêng. Asset chiến đấu hiện dùng góc 3/4 hướng đông cho các Vị Linh, kể cả lúc đứng ở nửa sân đối diện. Góc tây riêng vẫn cần vẽ trước khi duyệt mỹ thuật. Lilia, Nấm Lạc Vị, Tiêu Tinh và Bếp Trưởng Hỏa Diệm dùng tranh nhân vật mới, với chuyển động trình diễn từ runtime.

| Vị Linh | Nhận diện | Tuyệt kỹ |
|---|---|---|
| Bún Bò Hỏa Linh | Tóc đỏ cam, hoa gia vị, khăn đỏ, hỏa đao | Hỏa Đao Liên Vũ với vệt đao lửa và bùng nổ Hỏa ở từng mục tiêu |
| Phở Lam Vũ | Tóc xanh bạc, lụa Thủy và trượng giọt nước | Lam Vũ Triều Dâng với thủy đạn bay và bọt sóng ở điểm chạm |
| Gỏi Cuốn Diệp Nhi | Tóc xanh, hoa vàng và quạt lá | Diệp Vũ Hồi Sinh với hiệu ứng lá nở khi đồng đội hồi máu |
| Bánh Bao Bạch Ngọc | Mascot trắng kem, má hồng, mũ bếp và thìa gỗ | Bạch Ngọc Hộ Trận với sen ánh vàng ở thời điểm tạo khiên và trong lúc lá chắn còn hiệu lực |
| Cà Phê Dạ Vũ | Tóc tím đen, ánh đồng và đôi đoản đao | Dạ Vũ Đoạn Ảnh với vệt chém và sương tím ở điểm chạm |

Adventure dùng tranh mới cho tiêu đề, làng, rừng, sân đấu và các đạo cụ tương tác. TCG dùng chân dung theo ID cho thẻ nhân vật và mười minh họa riêng cho Thủy Linh Suối Mơ, phép và bẫy. Auto Chess dùng chung sprite và bộ vệt đòn/va chạm năm hệ. Art runtime nằm trong `client/assets/original/`. Nguồn PNG từng pose và báo cáo kiểm tra nằm trong `client/assets/characters/<id>/original_battle/` hoặc `original_travel/`.

Hiệu ứng quan sát sự kiện gameplay. Adventure dùng tick `projectile_spawned` để dựng đường bay và `hit_resolved`, `heal_resolved`, `shield_applied` để dựng điểm chạm. Auto Chess dựng vệt đòn trước sự kiện va chạm có sẵn trong replay. Các giá trị sát thương và thời điểm áp dụng hiệu ứng trong mô phỏng lấy từ bộ luật hiện tại. Mười âm thanh ra chiêu và va chạm được tổng hợp từ năm mẫu âm sắc trong `scripts/build_element_sfx.py`.

## Tái tạo và kiểm tra

Tên và SHA-256 của từng sheet, prompt nguyên văn và trạng thái duyệt nằm trong [ORIGINAL_ART_SOURCES.json](ORIGINAL_ART_SOURCES.json). Đặt các PNG nguồn theo tên trong manifest vào một thư mục rồi chạy từ gốc gói:

```bash
python3 scripts/build_original_art.py /path/to/sheets
python3 scripts/build_element_sfx.py
node --test client/tests/*.test.js
python3 -m unittest discover -s tests -v
python3 scripts/validate_package.py .
```

Script giữ alpha, tìm đường phân cách giữa các ô, chuẩn hóa neo chân và chạy trình kiểm tra `--strict` cho từng bộ PNG. Clip dùng lại pose trong cùng nhân vật để phục vụ chơi thử. Số pose thực tế ít hơn ma trận hoạt ảnh đầy đủ trong Sprite Pipeline. Cần duyệt tay sự nhất quán tạo hình, chuyển động và quyền sử dụng trước khi phát hành.
