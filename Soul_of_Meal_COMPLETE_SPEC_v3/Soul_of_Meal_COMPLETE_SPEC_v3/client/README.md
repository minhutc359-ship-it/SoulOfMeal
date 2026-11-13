# Soul of Meal · Bản chơi thử trên trình duyệt

Từ thư mục chứa `client/` và `examples/`, chạy với Node.js 22.12+:

```bash
npm --prefix client ci
npm --prefix client run dev
```

Mở [http://localhost:4173/client/](http://localhost:4173/client/) và chọn **Bắt đầu**. Màn mở đầu nạp catalog và atlas trước khi vào sảnh. Bản Vite dùng Phaser 4.2.1 cho nền và chuyển động ở màn mở đầu và sảnh. Có thể dùng `python3 -m http.server 4173` từ cùng thư mục để chạy với nền CSS. Hai cách đều dùng cùng luật chơi và định dạng save cục bộ.

Trên máy tính, dùng WASD hoặc phím mũi tên để di chuyển, E để tương tác và phím 1–5 để dùng tuyệt kỹ. Trên màn hình cảm ứng, chạm điểm đến, NPC, rương hoặc cổng. Có nút toàn màn hình ở thanh trên khi trình duyệt hỗ trợ. Nhạc và hiệu ứng bắt đầu sau thao tác đầu tiên.

Để kiểm tra bản build, chạy `npm --prefix client run build` rồi `npm --prefix client run preview`, mở lại đường dẫn trên. Kết quả build nằm trong `client/dist/` với entry `client/index.html` và catalog tương đối trong `examples/`.

Đây là bản chơi thử để đối chiếu gameplay và asset khi chuyển sang [Web Client–Server v3.2](../docs/03_engineering/ENGINE_ARCHITECTURE.md). Xem [đối chiếu concept](../docs/04_qa/PLAYTEST_CONCEPT_GAP.md) để phân biệt phần chạy được và hạng mục nghiệm thu.

## Tài khoản

Khi chạy với [máy chủ ASP.NET Core và PostgreSQL](../server/README.md), màn mở đầu có nút **Tài khoản**. Bản lưu của tài khoản có thể mở trên thiết bị khác. Chế độ khách tiếp tục lưu riêng trên trình duyệt.

## Cập nhật và quay lại bản phát hành trước

Tạo bản Vite rồi xuất sang một thư mục web riêng. Ví dụ chạy tại thư mục chứa `client/`:

```bash
npm --prefix client run build
python3 scripts/publish_web_release.py publish client/dist /path/to/web-root
python3 scripts/publish_web_release.py activate BUILD_ID /path/to/web-root
```

Lệnh đầu tiên của script trả mã build và chuyển con trỏ `release.json` sau khi đã kiểm tra các file. Lệnh `activate` dùng mã đã in để chuyển về bản có sẵn. Phục vụ thư mục web ở cùng origin với API nếu bật tài khoản. Entry công khai là `/client/`. Nên phục vụ `release.json` và thư mục launcher `/client/` với cache revalidation, còn `/releases/BUILD_ID/` có thể cache lâu vì nội dung bất biến. Giữ các thư mục build cũ trong thời gian còn phiên chơi.

Game đang mở lấy toàn bộ nội dung từ đường dẫn build của phiên đó. Sảnh hiện nút **Cập nhật** khi con trỏ thay đổi và cho áp dụng sau khi kết thúc trận đang lưu. Bản tài khoản chờ ghi tiến trình xong trước khi chuyển build. Lỗi kiểm tra cập nhật giữ phiên hiện tại có thể chơi tiếp.

## Lối chơi

- **Adventure** · Chơi sáu chương bắt đầu với **Hương Vị Đầu Tiên**. Dùng **Dẫn đường** trên bản đồ hoặc trong **Nhật ký hành trình**. Nhật ký lưu manh mối đã tìm và cho đọc lại đối thoại đã mở. Đội năm Vị Linh tự di chuyển theo tầm đánh. Bún Bò chém diện rộng, Phở bắn đạn làm chậm, Gỏi Cuốn hồi máu, Bánh Bao tạo lá chắn và Cà Phê kết liễu mục tiêu yếu máu.
- **TCG** · Đấu bot với bộ 24 lá từ danh mục 60 lá. Chọn độ khó và bộ bài bot riêng. Trình sửa có bốn ô lưu bộ bài, biểu đồ mana, bộ lọc và bảy bộ mẫu gồm **Khởi đầu**, **Hộ Trận**, **Tiên Phong**, **Triều Sương**, **Mầm Sống**, **Dạ Yến** và **Triều Hỏa**.
- **Auto Chess** · Xếp đội hình trên bàn lục giác, mua quân từ kho chung, hợp thể ba bản sao và mua XP. Ván mới có bảy bot đánh cùng lúc, các vòng quái thưởng linh kiện và kết thúc khi bị loại, về nhất hoặc đến giới hạn 37 vòng. Phát lại giao tranh dùng vị trí, đòn đánh, kỹ năng và HP do mô phỏng ghi lại. Ván lưu từ bản trước tiếp tục theo thể thức cũ.

## Bếp Trưởng Hỏa Diệm

- Ở 70% HP, boss tạo hộ thuẫn và nạp **Bếp Bùng Cháy** trong 6 giây mô phỏng. Bấm bếp trên sân, dùng nút bên cạnh thanh HP hoặc phím **6–7** để đội hình tập trung tấn công. Phá cả hai bếp trước hoặc đúng tick cuối để ngắt chiêu.
- Ở 30% HP, **Vòng Lửa** đánh vào ba Vị Linh được đánh dấu khi hết 1,2 giây báo trước. Dùng tuyệt kỹ của Bánh Bao để tạo lá chắn cho đội.
- Nút **Tạm dừng** hoặc phím **P** đóng băng trận. Bật **2×** để mô phỏng và hoạt ảnh cùng chạy nhanh gấp đôi.

## Chương 2 · Bí Mật Rừng Nguyên Liệu

- Sau cảnh kết Chương 1, nói chuyện với Lilia lần nữa. Ở rừng, thắp **đèn Mộc** rồi **đèn Quang**. Hai đèn mở đường đến đàn đá.
- Ấn Bát Rỗng báo trước **Sương Rút Vị** và **Triều Sương**. Khi boss tụ sương, dùng nút **Đèn Giữ Vị** hoặc phím **F** để giảm 60% sát thương của một đợt. Có một lượt dùng mỗi trận.
- Nhận thưởng sau trận và đem mảnh men về gặp Lilia để xem cảnh kết Chương 2. Nhật ký cho xem lại các đoạn đối thoại đã mở.

## Chương 3 · Hải Vực Hương Biển

- Sau khi nhận thưởng Chương 2 từ Lilia, đi tới bến thuyền ở Làng Ẩm Thực. Gặp Phở Lam Vũ ở cảng rồi kiểm tra lưới và vệt triều để mở trận Tù Và Hải Triều.
- Khi có báo sóng, nhấn **R** hoặc chọn **Lùi về vùng khô**. Vị Linh cần thời gian chạy về phía trái. Đội tạm ngừng đòn thường trong lúc lùi và tự giao tranh tiếp sau khi sóng qua. Tuyệt kỹ và đạn đã tung vẫn xử lý theo lịch cũ.
- Nhận thưởng giao tranh rồi báo tin cho Phở Lam Vũ. Có thể đi thuyền về làng và quay lại với tiến trình đã lưu.

## Chương 4–6 · Kết thúc Hành Trình Vị Linh

- **Lò Lửa Của Bếp Trưởng.** Báo tin cho Phở Lam Vũ rồi theo xe than ở cuối bến cảng. Đọc sổ chuyến than và bảng dẫn hơi. Khi Lò Than Mất Vị nạp đòn, gạt hai van theo thứ tự trên bảng giao tranh. Thứ tự đảo ở đợt sau.
- **Đại Tiệc Không Hương Vị.** Qua lối sau lò để vào Điện Hội Vô Vị. Gặp Cà Phê Dạ Vũ và đọc hai dấu vết trước khi đấu Vạc Vô Vị. Kích hoạt ba ấn ở đợt đầu và hai ấn ở đợt cuối để ngắt chiêu.
- **Bữa Tiệc Tái Sinh.** Mang ký ức về làng, gặp Lilia, nêm nước dùng rồi dọn bàn. Nói chuyện với Lilia để mở cảnh kết. Có thể trở lại các vùng đã mở và xem lại hội thoại trong Nhật ký.
- **Tiếp tục giao tranh.** Trận được ghi khi vào trận, sang đợt, mở hoặc kết thúc báo đòn, tạm dừng và có kết quả. Khi tải lại, trận đang diễn ra trở về mốc đã ghi và chờ **Tiếp tục**. Kết quả chưa nhận thưởng vẫn xuất hiện. Tài khoản đồng bộ các mốc lên máy chủ khi báo **Đã lưu**.

## Thao tác trong game

- **Giao tranh Adventure.** Năm tuyệt kỹ nằm dưới sân đấu. Mỗi ô hiển thị năng lượng, trạng thái sẵn sàng, thời gian hồi và trạng thái gục. Cột đối thủ chứa HP boss, báo chiêu và nút đối phó. Khi dẫn đường, bản đồ nhỏ vẽ tuyến còn lại và sân đánh dấu điểm đến.
- **Adventure.** Bản đồ nhỏ đánh dấu vị trí người chơi, lối đi và mục tiêu nhiệm vụ hiện tại. Trên màn hình cảm ứng, dùng cần điều khiển hoặc chạm đích để đi. Mở **Nhật ký hành trình** để đọc lại các cảnh đã mở kèm minh họa sáu chương.
- **Khiêu chiến boss.** Boss mở trong bảng khi đã thắng trận tương ứng ở cốt truyện. Tái đấu ở ba độ khó với đội hình đầy HP. Mỗi boss và độ khó có phần thưởng lần đầu, số lần thắng, thời gian tốt nhất và số Vị Linh sống sót cao nhất. Chỉ số và phần thưởng là cân bằng thử nghiệm.
- **Làng Ẩm Thực.** Chạm cửa hoặc đi đến trước Nhà Bếp, Hội Quán hay Tiệm Nguyên Liệu rồi nhấn E. Bàn chế tác mở kho trang bị. Bàn nhiệm vụ mở nhật ký. Tiệm đổi 30 vàng lấy 5 tinh hoa theo cân bằng thử nghiệm. Nút **Ra quảng trường** đưa nhân vật về đúng cửa. Bản lưu nhớ cả vị trí bên trong.
- **TCG.** Kéo thẻ từ tay tới ô trống, ô bẫy hoặc mục tiêu phép. Bạn cũng có thể chạm thẻ, chọn mục tiêu rồi xác nhận. Có thể xem hiệu ứng từng lá trong **Hàng chờ phản ứng**. Khi đủ điều kiện bẫy, bàn hiện **Kích hoạt bẫy** và **Giữ bẫy**. Tên bẫy địch chỉ hiện sau khi lật hoặc do thám.
- **Auto Chess.** Lưới dùng khi xếp quân. Khi giao tranh, sân chỉ hiện cảnh đấu, Vị Linh, thanh HP, năng lượng và hiệu ứng. Mua quân rồi kéo từ ghế hoặc chạm quân và ô để đặt. Kéo quân từ bàn về ghế để rút, kéo lên ô có quân để đổi chỗ. Chọn quân để hiện nút **Bán quân** hoặc **Rút về ghế**. Đồng hồ luyện tập 30 giây tạm dừng khi mở hộp thoại. Khi hết giờ hoặc bấm **Chiến đấu**, trận bắt đầu sau một giây. Phát lại hỗ trợ tạm dừng và tốc độ 2×.
- **Giảm chuyển động.** Tùy chọn trong **Cài đặt** giảm chuyển cảnh, hiệu ứng lật bẫy và chuyển động minh họa mà luật giao tranh vẫn chạy theo tick.

Đòn thường, đạn rời tay, va chạm, hộ thuẫn và tuyệt kỹ có tín hiệu âm thanh riêng. Bước chân đổi theo quãng đường đã đi và bề mặt. TCG phát vệt đòn theo hệ từ quân ra đòn tới mục tiêu. Auto Chess phát tiếng vung hoặc phóng trước mốc va chạm trong bản phát lại.

Nấm Lạc Vị và Tiêu Tinh có sprite chibi cho đứng, đi, tấn công, trúng đòn và gục. Quân có atlas dùng cùng tạo hình trên sân TCG, bàn Auto Chess và bản phát lại. Chuyển động và hình va chạm bám sự kiện giao tranh.

## Hồ sơ Vị Linh

Chạm chân dung trong Adventure hoặc mở **Vị Linh** ở thanh điều hướng. **Thông tin** hiển thị HP, ATK, DEF, tốc độ và mức tăng trước khi nâng cấp. **Kỹ năng** hiển thị tuyệt kỹ, năng lượng và thời gian hồi. **Trang bị** có bốn món để chế tác, đeo hoặc tháo về kho. Mỗi món chỉ có một bản, có thể chuyển giữa các Vị Linh. **Quan hệ** dùng tinh hoa để tặng quà và mở ký ức khi đạt mức Tin cậy.

Cấp 1–5, công thức và giá là cân bằng thử nghiệm. Nâng cấp và trang bị ảnh hưởng các trận Adventure bắt đầu sau thay đổi. Khi thua, chọn **Chuẩn bị đội hình** để chỉnh Vị Linh rồi quay lại điểm giao tranh. TCG và Auto Chess dùng bảng chỉ số riêng. Tiến trình được lưu trong cùng bản luyện tập.

## Giao tranh TCG

- Đặt tối đa bốn Vị Linh và một bẫy. Mỗi Vị Linh sẵn sàng đánh một lần trong lượt. Kéo hoặc chạm quân rồi chọn mục tiêu để xem sát thương, phản đòn và Xuyên kích trước khi xác nhận.
- Khi đối thủ còn Hộ vệ, chọn một Hộ vệ làm mục tiêu đòn thường. Khi hết Hộ vệ, chọn Vị Linh địch hoặc chủ soái. Đổi tối đa ba lá mở màn và tăng tối đa đến bảy mana.
- Năm combo theo hệ kích hoạt khi bạn nối triệu hồi với phép tương ứng trong cùng lượt. Mỗi combo dùng một lần mỗi lượt khi phép xử lý thành công.
- **Diệp Mộc Hồi Phục** hồi DEF qua hàng chờ tốc chú. **Ấn Bạch Ngọc** là tức chú dùng ngay và giữ ưu tiên. **Khai Hỏa Tiên Phong** là chậm chú tăng ATK. Hộ thuẫn và ATK cộng thêm hết hiệu lực cuối lượt hiện tại.
- Cộng hưởng giảm một mana cho lá lộ hệ thứ hai cùng hệ, tối đa một lần mỗi lượt. Năm tuyệt kỹ gắn với năm Vị Linh đầu. Vị Linh thi triển phải còn trên bàn khi phép xử lý.
- Mười hai bẫy phản ứng khi tấn công, dùng phép, triệu hồi hoặc đồng minh bị hạ. Bẫy sẵn sàng sau khi đổi lượt và có thể được giữ cho lần khác. **Soi Dấu Bẫy** làm lộ một ô, **Phá Ấn Thất Vị** gỡ một ô và **Phản Chú Hư Vị** hóa giải phép hoặc bẫy đang chờ.
- Bản lưu giữ cả cửa sổ chặn và cửa sổ bẫy đã mở. Ván lưu từ bản trước giữ nhịp bẫy và phép cũ. Mở **Ván mới** để dùng bộ bài đã lưu và các luật hiện tại.
- **Thử thách** trong menu trận có ba đối thủ với thế mở màn khác nhau. Bạch Ngọc vào sân với hộ thuẫn, Lam Vũ có bẫy đã sẵn sàng, Dạ Vũ mở màn bằng một quân Hút vị. Thắng sẽ lưu số vòng ít nhất cho từng thử thách.
- **Lửa Rạn Khiên** phá hộ thuẫn trước khi trừ DEF. **Triều Rút Về** đưa quân đối thủ về tay. **Mầm Về Đất** cho chọn Vị Linh trong mộ. **Ngọc Tái Chiến** mở thêm một đòn cho quân đã đánh trong lượt. **Sương Hạ Nhiệt** giảm ATK và **Dạ Yến** hồi HP chủ soái theo DEF thực sự gây mất.
- Chọn **Chi tiết** trên tay bài hoặc tên thẻ trong trình sửa bộ bài để xem điều kiện dùng và hiệu ứng. **Mộ bài** cho xem các lá của bạn đã rời ván. Nút **Đầu hàng** kết thúc ván và ghi kết quả vào nhật ký.

## Chuẩn bị Auto Chess

- Dùng **Do thám** để xem đúng đối thủ kế tiếp, nửa bàn và vị trí quân của họ. Số lãi dự kiến cập nhật theo vàng hiện có.
- Kéo thả bằng chuột hoặc cảm ứng. Thả vào vị trí đã có quân để đổi chỗ, kể cả khi bàn đã đủ quân hoặc cả chín ghế đã đầy. Giữ quân để xem chỉ số và số bản sao. Thả vào **Kéo để bán** hoặc chọn quân rồi bấm **Bán quân**.
- **Túi vật phẩm** cho gắn linh kiện lên quân. Gắn linh kiện thứ hai lên quân đang giữ một linh kiện để ghép thành món hoàn chỉnh. Bán quân trả vật phẩm về túi và trả bản sao về kho chung. Tỉ lệ cửa hàng, ngưỡng XP và các món là cân bằng thử nghiệm.

## Cài nhạc theo cảnh

Đặt file trong `client/assets/audio/` hoặc thư mục con như `client/assets/audio/custom/`. Sửa [soundtracks.json](assets/audio/soundtracks.json) và điền tên tương đối, chẳng hạn `"login": "custom/ten-file-login.mp3"`. Dùng MP3 hoặc OGG để có phạm vi tương thích rộng. Sau khi sửa, tải lại game. Nếu dùng bản build Vite, build lại để đưa file mới vào bản phân phối.

| Slot | Khi phát |
|---|---|
| `login` | Màn mở đầu, đăng nhập và đăng ký |
| `village` | Sảnh và Làng Ẩm Thực |
| `forest` | Khám phá Rừng Nguyên Liệu ngoài giao tranh |
| `tcg` | Đấu thẻ và chỉnh bộ bài |
| `chess` | Auto Chess, gồm chuẩn bị và xem giao tranh |
| `adventure` | Nhật ký hành trình trong Phiêu lưu |
| `adventure_battle` | Giao tranh đợt quái thường |
| `epic_boss_battle` | Từ lúc boss xuất hiện tới khi đóng kết quả trận |

Mỗi slot để `null` dùng nhạc mẫu. Nếu file tự chọn thiếu hoặc lỗi giải mã, game quay về nhạc mẫu của cảnh. Nhạc bắt đầu sau thao tác đầu tiên. Âm thanh môi trường rừng và SFX giao tranh điều chỉnh riêng trong **Cài đặt**.

## Tích hợp và tài nguyên

Adventure chạy mô phỏng ở 30 Hz. Chuỗi `attack_started` / `cast_started` → `projectile_spawned` (nếu có) → `hit_resolved` đồng bộ clip, hiệu ứng và âm thanh. Các sự kiện `heal_resolved` và `shield_applied` dùng cùng đồng hồ mô phỏng. Dữ liệu thử nghiệm nằm trong `src/modes/adventureBalance.js` và `examples/`. Renderer và playback chỉ đọc sự kiện.

- Cả năm Vị Linh dùng sprite anime chibi mới, với chân dung và cut-in riêng. Bún Bò Hỏa Linh có bộ sprite đi bản đồ bốn hướng. Boss Hỏa Diệm có bộ sprite hướng tây, pháp ấn báo mục tiêu và hiệu ứng chém riêng. Adventure, TCG và Auto Chess dùng chung nhận diện nhân vật.
- Tranh làng, rừng, sân đấu, đạo cụ, quái và thẻ phép/bẫy được vẽ riêng cho bản chơi thử. Xem [danh mục, nguồn art và cách tái tạo](../docs/02_art/ORIGINAL_ART_PLAYTEST.md).
- Rig biến dạng 2D đọc clip và atlas hiện có. Năm Vị Linh, hai quái và bộ di chuyển Bún Bò dùng các mốc chân, hông, thân và đầu để bổ sung chuyển động giữa các pose. Nghiệm thu Spine và chuyển động độc lập từng chi vẫn còn mở.
- Nhạc và âm thanh môi trường có thể tái tạo bằng `python3 scripts/build_music.py`. Dùng `python3 scripts/build_element_sfx.py` để tái tạo đòn năm hệ và `python3 scripts/build_combat_audio.py` cho bộ tuyệt kỹ, bước chân và tín hiệu giao tranh. Các lệnh xuất OGG cần FFmpeg.

## Kiểm thử và phạm vi

```bash
node --test client/tests/*.test.js
python3 -m unittest discover -s tests -v
python3 scripts/validate_package.py .
```

Battle Adventure và Auto Chess dùng Canvas 2D. Cả ba chế độ dùng bot. Tài khoản đồng bộ bản luyện tập lên PostgreSQL. Client xử lý luật chiến đấu. Các phần còn cần hoàn thiện trước phát hành gồm rig và hoạt ảnh đầy đủ, duyệt mỹ thuật và quyền sử dụng, voice, benchmark WebGL trên thiết bị thật và cân bằng dài hạn. Bản chơi thử lưu manh mối, mốc nhiệm vụ, phần thưởng, checkpoint Adventure, ván TCG và vòng Auto Chess. Khi tải lại Adventure giữa trận, game khôi phục mốc đã lưu và chờ người chơi bấm **Tiếp tục**.
