# Bộ đồ họa anime chibi của bản chơi thử

Bộ này triển khai nhận diện trong Project Bible và hồ sơ `examples/characters/` cho năm Vị Linh. Mỗi nhân vật có tám pose chiến đấu RGBA mới, atlas WebP, mười clip mẫu, chân dung và cut-in riêng. Bún Bò Hỏa Linh có thêm 12 pose đi bản đồ với bốn hướng vẽ riêng. Asset chiến đấu hiện dùng góc 3/4 hướng đông cho các Vị Linh, kể cả lúc đứng ở nửa sân đối diện. Góc tây riêng vẫn cần vẽ trước khi duyệt mỹ thuật. Lilia, Nấm Lạc Vị và Tiêu Tinh dùng tranh nhân vật. Bếp Trưởng Hỏa Diệm có bộ sprite chiến đấu hướng tây.

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

## Tranh màn mở đầu

Tranh dùng ở màn chơi khách. Nguồn PNG được tạo bằng công cụ tạo ảnh tích hợp cho Soul of Meal, SHA-256 `49c6f111cac2334bc771d9a19770fd88efaba8a0c5a4265eb5f14d9f9e795c5d`. Bản WebP tích hợp nằm ở `client/assets/original/scenes/title.webp`. Cần duyệt tạo hình Phở Lam Vũ trước khi phát hành.

> Create one original panoramic 16:9 anime illustration for the browser title scene of Soul of Meal, a Vietnamese culinary fantasy adventure. Image only, absolutely no lettering, logos, borders, cards, interface or watermarks. Warm red paper lanterns hang over the tiled wood storefronts of Làng Ẩm Thực at dusk, lush misty blue hills and flowering trees in the distance, glowing gold spice wisps. On the right half, a joyous young adult heroine Bún Bò Hỏa Linh with huge red-orange ribboned twin-tails, a gold spice blossom in her hair, red, ivory and black Vietnamese-inspired fantasy jacket, and a curved ember saber; the tiny cream steamed-bun guardian Bánh Bao Bạch Ngọc, with a red scarf, wooden spoon and chef hat, beside her. Behind them on the far right is Phở Lam Vũ, silver-blue long-haired water mage with elegant pale silk and a blue water ribbon. Expressive bright faces, tasteful non-sexual character design, original Japanese anime game illustration with lightly chibi proportions and exceptional clean linework, painterly lush background, rich teal shadows and copper light. Reserve the entire left 38 percent for quiet dark teal and midnight indigo atmosphere with just subtle foliage and soft lantern glow, because a readable interactive title and button will be placed there later. All characters belong entirely to the right 60 percent, with heroine’s face close to x=68%, y=43%, in a group composed for responsive portrait cropping. Keep lower edge softly shaded. Full bleed, high contrast, cohesive production artwork.

## Bếp Trưởng Hỏa Diệm và hiệu ứng giao tranh

- [Nhận diện boss](../../examples/characters/boss_bep_truong/identity.json) ghi tạo hình tham chiếu, hướng W và trạng thái duyệt.
- [PNG RGBA từng tư thế](../../client/assets/characters/boss_bep_truong/original_battle/poses/) và [GIF duyệt tư thế](../../client/assets/characters/boss_bep_truong/original_battle/preview/poses.gif) gồm tám tư thế. [Atlas runtime](../../client/assets/original/atlases/boss_bep_truong.json) có chín clip, gồm tư thế ra đòn tại lúc giải phóng kỹ năng.
- Hiệu ứng pháp ấn dưới boss và Vị Linh dùng danh sách mục tiêu từ mô phỏng. Hiệu ứng vệt chém và vỡ khiên theo sự kiện `boss_cast_released` và `shield_broken`. Hộ thuẫn Quang có asset trong suốt để vẫn thấy nhân vật bên trong.
- Hai sheet được tạo riêng bằng công cụ tạo ảnh tích hợp. Tên nguồn, SHA-256 và prompt nằm trong [manifest nguồn](ORIGINAL_ART_SOURCES.json). Có thể build lại bằng `python3 scripts/build_original_art.py /path/to/sheets boss_bep_truong combat_effects`.
- [Kiểm tra xuất sprite](../../client/assets/characters/boss_bep_truong/original_battle/qa.json) đạt strict validator. Duyệt tay nhận diện, động tác và quyền sử dụng vẫn mở.
