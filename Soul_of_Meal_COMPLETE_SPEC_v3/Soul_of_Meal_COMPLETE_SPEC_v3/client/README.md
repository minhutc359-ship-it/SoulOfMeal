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

## Lối chơi

- **Adventure** · Chơi chương mở đầu **Hương Vị Đầu Tiên**. Gặp Lilia, mở rương, tìm hai manh mối Thất Vị trong rừng, đánh hai đợt và trở về làng nhận thưởng, xem cảnh kết. Dùng **Dẫn đường** trên bản đồ hoặc trong **Nhật ký hành trình**. Nhật ký lưu manh mối đã tìm và cho đọc lại đối thoại đã mở. Đội năm Vị Linh tự di chuyển theo tầm đánh. Bún Bò chém diện rộng, Phở bắn đạn làm chậm, Gỏi Cuốn hồi máu, Bánh Bao tạo lá chắn và Cà Phê kết liễu mục tiêu yếu máu.
- **TCG** · Đấu bot với bộ 36 lá, đổi bài mở màn một lần, xây bộ bài trong danh mục 22 lá, triệu hồi Vị Linh, đặt bẫy úp và phản ứng theo lượt ưu tiên. Bộ bài đã lưu dùng khi bắt đầu ván mới.
- **Auto Chess** · Mua quân, hợp thể ba bản sao, xếp đội hình, nâng cấp cửa hàng và chơi tối đa mười vòng. Hai nhân vật khác nhau cùng hệ Hỏa, Mộc hoặc Quang kích hoạt hiệp lực tương ứng. Phát lại giao tranh dùng vị trí, đòn đánh và HP do mô phỏng ghi lại.

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
- **TCG.** Chạm lá phép để chọn, rồi chạm chủ soái hoặc Vị Linh địch trên bàn, hoặc chọn trong danh sách. Nút **Thi triển** và **Hủy chọn** xuất hiện ở đầu khu tay bài. Khi bot tấn công, khu này chuyển sang chọn quân chặn. Nút **Bài trên tay** mở danh sách lá bài trong lúc chọn. Cả hai phía hiển thị hai ô bẫy úp, tên bẫy hiện khi lật. Nhật ký mở trong trận.
- **Auto Chess.** Hai nửa bàn cùng hiển thị theo hướng của bản phát lại. Mua quân rồi kéo từ ghế hoặc chạm quân và ô để đặt. Kéo quân từ bàn về ghế để rút, kéo lên ô có quân để đổi chỗ. Chọn quân để hiện nút **Bán quân** hoặc **Rút về ghế**. Đồng hồ luyện tập 30 giây tạm dừng khi mở hộp thoại. Khi hết giờ hoặc bấm **Chiến đấu**, trận bắt đầu sau một giây. Ở khung ngang thấp, chạm **Hiệp lực** để xem các mốc hệ. Phát lại hỗ trợ tạm dừng và tốc độ 2×. Kết quả hiển thị thu nhập và nút sang vòng ở khu điều khiển.
- **Giảm chuyển động.** Tùy chọn trong **Cài đặt** giảm chuyển cảnh, hiệu ứng lật bẫy và chuyển động minh họa mà luật giao tranh vẫn chạy theo tick.

Đòn thường, đạn rời tay, va chạm, hộ thuẫn và tuyệt kỹ có tín hiệu âm thanh riêng. Bước chân đổi theo quãng đường đã đi và bề mặt. TCG phát vệt đòn theo hệ từ quân ra đòn tới mục tiêu. Auto Chess phát tiếng vung hoặc phóng trước mốc va chạm trong bản phát lại.

Nấm Lạc Vị và Tiêu Tinh có sprite chibi cho đứng, đi, tấn công, trúng đòn và gục. Quân có atlas dùng cùng tạo hình trên sân TCG, bàn Auto Chess và bản phát lại. Chuyển động và hình va chạm bám sự kiện giao tranh.

## Hồ sơ Vị Linh

Chạm chân dung trong Adventure hoặc mở **Vị Linh** ở thanh điều hướng. **Thông tin** hiển thị HP, ATK, DEF, tốc độ và mức tăng trước khi nâng cấp. **Kỹ năng** hiển thị tuyệt kỹ, năng lượng và thời gian hồi. **Trang bị** có bốn món để chế tác, đeo hoặc tháo về kho. Mỗi món chỉ có một bản, có thể chuyển giữa các Vị Linh. **Quan hệ** dùng tinh hoa để tặng quà và mở ký ức khi đạt mức Tin cậy.

Cấp 1–5, công thức và giá là cân bằng thử nghiệm. Nâng cấp và trang bị ảnh hưởng các trận Adventure bắt đầu sau thay đổi. Khi thua, chọn **Chuẩn bị đội hình** để chỉnh Vị Linh rồi quay lại điểm giao tranh. TCG và Auto Chess dùng bảng chỉ số riêng. Tiến trình được lưu trong cùng bản luyện tập.

## Giao tranh TCG

- Sau khi kết thúc giai đoạn triển khai, chạm các Vị Linh đang sẵn sàng để chọn nhóm tấn công. Các Vị Linh sẵn sàng được chọn mặc định.
- Khi bot tuyên bố tấn công, chọn một quân chặn cho từng đường muốn bảo vệ rồi chọn **Chốt phòng thủ**. Một Vị Linh chỉ chặn một đường. Chỉ số sát thương dự kiến cập nhật ngay khi đổi lựa chọn.
- Sau khi chọn quân chặn, dùng tốc chú nếu cửa sổ phản ứng mở. Nếu quân chặn rời sân trước khi giao tranh được xử lý, đòn của đường đó đi thẳng vào chủ soái.
- Tiến trình đang chờ chọn quân chặn được giữ khi rời trận hoặc tải lại. Lựa chọn chưa chốt chỉ dùng để xem trước.
- Chọn **Chi tiết** trên tay bài hoặc tên thẻ trong trình sửa bộ bài để xem điều kiện dùng và hiệu ứng. **Mộ bài** cho xem các lá của bạn đã rời ván. Nút **Đầu hàng** kết thúc ván và ghi kết quả vào nhật ký.

## Chuẩn bị Auto Chess

- Dùng **Do thám** để xem đúng đối thủ kế tiếp, nửa bàn và vị trí quân của họ. Số lãi dự kiến cập nhật theo vàng hiện có.
- Chọn một quân trên bàn rồi bấm **Rút về ghế** để giữ quân và số sao. Ghế có chỗ thì có thể triển khai lại ở vị trí khác trước khi khóa đội hình.

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
