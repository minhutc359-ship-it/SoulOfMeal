# Bộ đồ họa anime chibi của bản chơi thử

Bộ này triển khai nhận diện trong Project Bible và hồ sơ `examples/characters/` cho năm Vị Linh. Mỗi nhân vật có tám pose chiến đấu RGBA mới, atlas WebP, mười clip mẫu, chân dung và cut-in riêng. Bún Bò Hỏa Linh có thêm 12 pose đi bản đồ với bốn hướng vẽ riêng. Asset chiến đấu hiện dùng góc 3/4 hướng đông cho các Vị Linh, kể cả lúc đứng ở nửa sân đối diện. Góc tây riêng vẫn cần vẽ trước khi duyệt mỹ thuật. Lilia dùng tranh nhân vật. Bếp Trưởng Hỏa Diệm, Nấm Lạc Vị và Tiêu Tinh có sprite chiến đấu hướng tây.

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
- Hai bếp giữ hộ thuẫn dùng [sprite bếp than đất nung](../../client/assets/original/props/boss_stove.webp) tạo mới với alpha. Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets boss_stove`. Vệt đạn theo mục tiêu bếp và hiệu ứng vỡ/ngắt chiêu theo sự kiện mô phỏng.
- Ấn Bát Rỗng dùng [đạo cụ đàn đá và bát men](../../client/assets/original/props/empty_bowl_seal.webp) tạo mới với alpha, dùng chung trên bản đồ và trong trận. Đàn đá đứng yên. Các lớp sương và dấu mục tiêu hiển thị theo tick mô phỏng. Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets empty_bowl_seal`. Tình trạng duyệt mỹ thuật và quyền phát hành ghi trong manifest nguồn.
- Hải Vực Hương Biển dùng [nền bến cảng](../../client/assets/original/scenes/harbor.webp) và [đạo cụ tù và vỏ ốc](../../client/assets/original/props/tidal_conch.webp) tạo mới. Nền dùng cho cả khám phá và giao tranh. Vùng báo sóng và điểm chạm do mô phỏng xác định. Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets harbor tidal_conch`. Tình trạng duyệt mỹ thuật và quyền phát hành ghi trong manifest nguồn.
- Hai sheet được tạo riêng bằng công cụ tạo ảnh tích hợp. Tên nguồn, SHA-256 và prompt nằm trong [manifest nguồn](ORIGINAL_ART_SOURCES.json). Có thể build lại bằng `python3 scripts/build_original_art.py /path/to/sheets boss_bep_truong combat_effects`.
- [Kiểm tra xuất sprite](../../client/assets/characters/boss_bep_truong/original_battle/qa.json) đạt strict validator. Duyệt tay nhận diện, động tác và quyền sử dụng vẫn mở.

- Chương cuối dùng hai nền anime mới [Núi Lửa Gia Vị](../../client/assets/original/scenes/caldera.webp), [Điện Hội Vô Vị](../../client/assets/original/scenes/sanctum.webp) và [sprite Vạc Vô Vị](../../client/assets/original/props/hollow_cauldron.webp). Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets caldera sanctum hollow_cauldron`. Lò Than dùng đạo cụ bếp lửa nguyên bản đã tích hợp. Prompt và SHA-256 nguồn nằm trong [manifest](ORIGINAL_ART_SOURCES.json). Duyệt mỹ thuật và quyền phát hành đang chờ.

- [Minh họa sáu chương](../../client/assets/original/chronicle), [bàn TCG](../../client/assets/original/scenes/tcg_table.webp) và [sân Auto Chess](../../client/assets/original/scenes/chess_court.webp) là art mới theo nhận diện Vị Linh, bố cục trong storyboard và tuyến nhiệm vụ của game. Chữ, lá bài, quân cờ và số liệu được client vẽ riêng. Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets chronicle tcg_table chess_court`. [Prompt và SHA-256](ORIGINAL_ART_SOURCES.json) lưu theo ID nguồn. Duyệt mỹ thuật và quyền sử dụng trước phát hành vẫn đang chờ.

- Nấm Lạc Vị và Tiêu Tinh có tám pose chibi mới cho mỗi nhân vật. [Khung PNG, mốc chân và báo cáo Nấm](../../client/assets/characters/mob_mushroom_01/original_battle), [khung PNG, mốc chân và báo cáo Tiêu Tinh](../../client/assets/characters/mob_pepper_01/original_battle) và atlas WebP dùng chung giữa các chế độ. Pose gốc hướng tây. Bản chơi thử phản chiếu hướng đông cho hai quái này. Duyệt nhận diện, chuyển động và quyền sử dụng đang chờ. Xuất lại bằng `python3 scripts/build_original_art.py /path/to/sheets mob_mushroom_01 mob_pepper_01`.

## Rig Bún Bò Hỏa Linh

Các trận Adventure dùng bộ rig 16 xương, 12 lớp hình và 10 clip. Tay, chân, tóc, dây áo và hỏa đao có khớp riêng. Rig phản chiếu hướng tây trong trận. Bản đồ dùng bộ khung PNG bốn hướng của nhân vật. Khi asset rig tải lỗi, trận dùng atlas chiến đấu sẵn có.

`hit_resolved` xác nhận thời điểm trúng đòn. Client lấy vị trí đầu đao tại mốc `blade_contact` để vẽ vệt Hỏa và phát tiếng chém. Sát thương, vị trí mục tiêu và điểm lưu trận do mô phỏng quản lý.

Hình tách lớp được tạo riêng cho dự án theo pose `chr_bunbo_holinh/original_battle/poses/pose_00.png`. SHA-256 sheet RGBA nguồn là `e3222c0aca3fa7bc2e5cd167dfd0b474bf530c61f3473a2e8cc3ee6bc39159be`. Duyệt tay tạo hình, chuyển động và quyền sử dụng đang chờ.

```bash
python3 scripts/bunbo_rig.py --pack /path/to/source-sheet.png
python3 scripts/bunbo_rig.py --export /path/to/bunbo-editor
python3 scripts/build_compatibility_audio.py
```

Bộ xuất chứa `bunbo.json` và 12 PNG trong thư mục `images/`, theo định dạng Spine 4.2. Client dùng Canvas để chạy rig. Gói âm thanh tạo bằng FFmpeg chỉ được tải trên trình duyệt có Web Audio và thiếu giải mã Ogg Vorbis.

## Rig đội hình Vị Linh

Cả năm rig dùng atlas WebP RGBA 704×528, mỗi rig có 12 lớp gắn xương và 10 clip. Atlas lấy lại từ các sheet gốc đã ghi SHA-256, tối đa 168 px cho mỗi lớp. Kích thước của khớp trong trận độc lập với số pixel của lớp hình. Điểm neo đầu của Phở, Gỏi Cuốn và Cà Phê căn về cổ áo. Đầu và mũ Bánh Bao căn với thân tròn. Phở hạ góc giữ trượng để mặt dễ thấy ở tư thế nghỉ.

| Nhân vật | ID thư mục | Xương | Mốc trình bày |
|---|---|---:|---|
| Phở Lam Vũ | `chr_pho_lamvu` | 15 | Đạn xuất hiện ở đầu trượng theo tick phóng |
| Gỏi Cuốn Diệp Nhi | `chr_goicuon_diepnhi` | 15 | Đạn và hiệu ứng mở hồi máu lấy đầu quạt làm neo |
| Bánh Bao Bạch Ngọc | `chr_banhbao_bachngoc` | 15 | Tiếng đòn thường theo va chạm, hiệu ứng mở khiên lấy đầu thìa làm neo |
| Cà Phê Dạ Vũ | `chr_caphe_davu` | 16 | Hai đòn luân phiên lấy hai đầu dao làm neo |

Adventure, TCG và Auto Chess dùng chung rig cho năm ID Vị Linh. TCG và Chess phát hoạt ảnh ở mốc trình bày của trận hoặc replay. Bản đồ khám phá tiếp tục dùng bộ bốn hướng của Bún Bò. Rig chiến đấu dùng hướng đông và phản chiếu hướng tây. Khi tải rig lỗi, nhân vật dùng atlas pose sẵn có. Logic giao tranh quyết định sát thương, hồi máu và hộ thuẫn theo tick của trận.

```bash
python3 scripts/bunbo_rig.py --character chr_pho_lamvu --export /path/to/pho-editor
python3 scripts/bunbo_rig.py --character chr_pho_lamvu --pack /path/to/pho-sheet.png
```

Dùng ID trong bảng cho ba nhân vật còn lại, hoặc bỏ `--character` để xuất Bún Bò. File JSON trong mỗi thư mục rig chứa các xương, slot và keyframe. Bộ xuất có 12 PNG riêng để gắn ảnh trong editor. Sân TCG dùng khung logic 128×104 và cấp pixel theo kích thước thực trên màn hình. Adventure, TCG và Auto Chess cấp tối đa DPR 3, với cạnh dài canvas tối đa 2048 px. Duyệt mỹ thuật trên thiết bị thật, quyền sử dụng và thao tác nhập trên Spine Editor đang chờ. Prompt và mã nguồn ảnh được ghi trong [manifest nguồn](ORIGINAL_ART_SOURCES.json).

## Nội thất Làng Ẩm Thực

Ba nền anime mới phục vụ đi bộ trong Nhà Bếp, Hội Quán và Tiệm Nguyên Liệu. Map định nghĩa riêng vùng sàn, cửa, quầy và điểm trở về làng. Xuất bằng `python3 scripts/build_original_art.py /path/to/sheets village_kitchen village_guild village_merchant`. Tên sheet, prompt và SHA-256 nằm trong [manifest nguồn](ORIGINAL_ART_SOURCES.json). Duyệt mỹ thuật và quyền sử dụng đang chờ.
