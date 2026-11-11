# Soul of Meal · Bản chơi thử trên trình duyệt

Từ thư mục chứa `client/` và `examples/`, chạy:

```bash
python3 -m http.server 4173
```

Mở `http://localhost:4173/client/`. Trên máy tính, dùng WASD hoặc phím mũi tên để di chuyển, E để tương tác và phím 1–5 để dùng tuyệt kỹ. Trên màn hình cảm ứng, chạm điểm đến, NPC, rương hoặc cổng. Nhạc và hiệu ứng bắt đầu sau thao tác đầu tiên. Tiến trình và bộ bài lưu trên thiết bị.

## Lối chơi

- **Adventure** · Nhận nhiệm vụ từ Lilia, mở rương, vào rừng, đánh hai đợt quái, nhận thưởng và trở lại làng. Đội năm Vị Linh tự di chuyển theo tầm đánh. Bún Bò chém diện rộng, Phở bắn đạn làm chậm, Gỏi Cuốn hồi máu, Bánh Bao tạo lá chắn và Cà Phê kết liễu mục tiêu yếu máu.
- **TCG** · Đấu bot với bộ 36 lá, đổi bài mở màn một lần, xây bộ bài trong danh mục 22 lá, triệu hồi Vị Linh, đặt bẫy úp và phản ứng theo lượt ưu tiên. Bộ bài đã lưu dùng khi bắt đầu ván mới.
- **Auto Chess** · Mua quân, hợp thể ba bản sao, xếp đội hình, nâng cấp cửa hàng và chơi tối đa mười vòng. Hai nhân vật khác nhau cùng hệ Hỏa, Mộc hoặc Quang kích hoạt hiệp lực tương ứng. Phát lại giao tranh dùng vị trí, đòn đánh và HP do mô phỏng ghi lại.

## Tích hợp và tài nguyên

Adventure chạy mô phỏng ở 30 Hz. Chuỗi `attack_started` / `cast_started` → `projectile_spawned` (nếu có) → `hit_resolved` đồng bộ clip, hiệu ứng và âm thanh. Các sự kiện `heal_resolved` và `shield_applied` dùng cùng đồng hồ mô phỏng. Dữ liệu thử nghiệm nằm trong `src/modes/adventureBalance.js` và `examples/`. Renderer và playback chỉ đọc sự kiện.

- Sprite đi map bốn hướng lấy từ Golden Sample, đã được kiểm tra 190 frame. Model chiến đấu anime chibi Bún Bò dùng tám pose RGBA gốc ở [thư mục nhân vật](assets/characters/chr_bunbo_holinh/battle/), phát qua [atlas và clip manifest](assets/golden/bunbo_battle.json). Bốn Vị Linh đồng đội dùng sprite đã có trong repo.
- Atlas Golden Sample, atlas Hỏa và SFX OGG có thể tái tạo từ ZIP Golden Sample bằng `python3 scripts/import_golden_sample.py <golden-sample.zip>`. Nhạc và ambience có thể tái tạo bằng `python3 scripts/build_music.py` với FFmpeg.
- Hình tiêu đề, nền làng, nền chiến đấu, cut-in và hai quái được tạo cho Soul of Meal. Xem [nguồn tài nguyên](../docs/02_art/LICENSE_AND_PROVENANCE.md#browser-playtest-assets) và [QA frame anime chibi](assets/characters/chr_bunbo_holinh/battle/qa.json).

## Kiểm thử và phạm vi

```bash
node --test client/tests/*.test.js
python3 -m unittest discover -s tests -v
python3 scripts/validate_package.py .
```

Bản này chạy Canvas 2D và bot cục bộ. Các phần còn cần hoàn thiện trước phát hành gồm rig/animation đầy đủ cho cả đội, duyệt mỹ thuật và quyền sử dụng, voice, benchmark renderer WebGL trên thiết bị thật, cân bằng dài hạn và nội dung các chương sau. Bản chơi thử lưu mốc nhiệm vụ/phần thưởng, ván TCG và vòng Auto Chess. Adventure bắt đầu lại cuộc chạm trán nếu tải lại giữa trận.
