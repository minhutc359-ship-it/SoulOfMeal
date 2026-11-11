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

## Lối chơi

- **Adventure** · Nhận nhiệm vụ từ Lilia, mở rương, vào rừng, đánh hai đợt quái, nhận thưởng và trở lại làng. Đội năm Vị Linh tự di chuyển theo tầm đánh. Bún Bò chém diện rộng, Phở bắn đạn làm chậm, Gỏi Cuốn hồi máu, Bánh Bao tạo lá chắn và Cà Phê kết liễu mục tiêu yếu máu.
- **TCG** · Đấu bot với bộ 36 lá, đổi bài mở màn một lần, xây bộ bài trong danh mục 22 lá, triệu hồi Vị Linh, đặt bẫy úp và phản ứng theo lượt ưu tiên. Bộ bài đã lưu dùng khi bắt đầu ván mới.
- **Auto Chess** · Mua quân, hợp thể ba bản sao, xếp đội hình, nâng cấp cửa hàng và chơi tối đa mười vòng. Hai nhân vật khác nhau cùng hệ Hỏa, Mộc hoặc Quang kích hoạt hiệp lực tương ứng. Phát lại giao tranh dùng vị trí, đòn đánh và HP do mô phỏng ghi lại.

## Tích hợp và tài nguyên

Adventure chạy mô phỏng ở 30 Hz. Chuỗi `attack_started` / `cast_started` → `projectile_spawned` (nếu có) → `hit_resolved` đồng bộ clip, hiệu ứng và âm thanh. Các sự kiện `heal_resolved` và `shield_applied` dùng cùng đồng hồ mô phỏng. Dữ liệu thử nghiệm nằm trong `src/modes/adventureBalance.js` và `examples/`. Renderer và playback chỉ đọc sự kiện.

- Cả năm Vị Linh dùng sprite anime chibi mới, với chân dung và cut-in riêng. Bún Bò Hỏa Linh có bộ sprite đi bản đồ bốn hướng. Adventure, TCG và Auto Chess dùng chung nhận diện nhân vật.
- Tranh làng, rừng, sân đấu, đạo cụ, quái và thẻ phép/bẫy được vẽ riêng cho bản chơi thử. Xem [danh mục, nguồn art và cách tái tạo](../docs/02_art/ORIGINAL_ART_PLAYTEST.md).
- Nhạc và âm thanh môi trường có thể tái tạo bằng `python3 scripts/build_music.py`. Tái tạo âm thanh năm hệ bằng `python3 scripts/build_element_sfx.py` với FFmpeg.

## Kiểm thử và phạm vi

```bash
node --test client/tests/*.test.js
python3 -m unittest discover -s tests -v
python3 scripts/validate_package.py .
```

Battle Adventure và Auto Chess vẫn dùng Canvas 2D. Cả ba chế độ dùng bot và lưu tiến trình cục bộ. Xác thực tài khoản và server save thuộc mốc tiếp theo. Các phần còn cần hoàn thiện trước phát hành gồm rig/animation đầy đủ cho cả đội, duyệt mỹ thuật và quyền sử dụng, voice, benchmark renderer WebGL trên thiết bị thật, cân bằng dài hạn và nội dung các chương sau. Bản chơi thử lưu mốc nhiệm vụ/phần thưởng, ván TCG và vòng Auto Chess. Adventure bắt đầu lại cuộc chạm trán nếu tải lại giữa trận.
