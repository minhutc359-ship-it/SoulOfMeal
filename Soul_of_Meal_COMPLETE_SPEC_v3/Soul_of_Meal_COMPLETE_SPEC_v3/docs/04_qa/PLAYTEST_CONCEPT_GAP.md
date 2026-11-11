# Đối chiếu bản chơi thử với concept Soul of Meal

**Mốc kiểm tra** Bản chơi thử với sảnh Phaser trên PR #1, ngày 2026-11-11. Đối chiếu chín ảnh đính kèm gồm các bảng thiết kế tổng hợp, character production pack, character sheet, bảng môi trường, UI wireframe, VFX/SFX và màn đăng nhập. Trạng thái dưới đây dựa trên mã nguồn và các tài nguyên đang có. Các con số hoặc tên kỹ năng khác nhau giữa ảnh được ghi nhận là ví dụ trình bày, còn rulebook, catalog và ADR quyết định giá trị chạy thật.

| Nhóm concept | Có trong bản chơi thử | Phần cần hoàn thiện theo concept |
|---|---|---|
| Login và vỏ game | Màn mở đầu anime toàn viewport, nạp catalog/atlas có tiến độ và nút thử lại. Sảnh và ba mode dùng chung khung và thanh điều hướng. Phaser trình bày nền và hạt sáng của màn mở đầu/sảnh. | Xác thực tài khoản, bootstrap từ server, bundle theo scene và chuyển các mode vào Phaser. |
| Adventure | Làng và rừng, NPC Lilia, quest, rương, chuyển map, đội năm Vị Linh, hai đợt gồm quái và boss, tuyệt kỹ và thưởng lưu cục bộ. Có WASD và chạm đường đi. | HUD, minimap và joystick như concept, nội thất và chuỗi tương tác công trình, boss/cảnh đa dạng hơn, bản đồ liên vùng, tiến trình server. |
| TCG | Đấu bot, deck 36 lá, danh mục 22 thẻ, đổi bài đầu trận, mana, đặt bẫy và giải quyết phản ứng. Có hình thẻ và hiệu ứng trúng đòn. | Bàn đấu và tay bài hoàn chỉnh về UX, bộ luật/hiệu ứng và nội dung thẻ được nghiệm thu, replay/reconnect theo quyền xem, PvP ở mốc riêng. |
| Auto Chess | Shop, bench, xếp quân, hợp thể, hiệp lực, nâng cấp, tự đánh và replay. Chạy tối đa mười vòng với danh sách bảy đối thủ mô phỏng. | Trải nghiệm bàn/đồng hồ/shop theo concept, thể thức tám người đầy đủ, AI và độ khó được cân bằng, kênh phòng và matchmaking ở mốc phù hợp. |
| Vị Linh và phát triển | Có màn đội hình, portrait, chỉ số và bộ nhận diện năm nhân vật dùng chung. | Hồ sơ theo tab, trang bị, nâng cấp, quan hệ/thân thiết, kho đồ, cảnh Triệu Hồi và lịch sử. Gacha trả phí theo quyết định riêng. |
| Character production | 40 pose chiến đấu, 12 pose di chuyển bốn hướng của Bún Bò, sáu atlas, năm chân dung chính và năm cut-in mới. Có art Lilia, hai quái, boss, bốn cảnh và tám đạo cụ. | Bộ clip/frame và biểu cảm đầy đủ, hướng chiến đấu tây riêng, layer nguồn và Spine rig, kiểm tra tính nhất quán và duyệt mỹ thuật. |
| VFX/SFX | Vệt đòn và va chạm theo năm hệ, đường bay dựa vào tick, cut-in, 10 âm thanh hệ và nhạc/ambience của playtest. | Dư quang và các lớp kỹ năng theo storyboard, motion/camera, voice, mix và tối ưu texture/audio ở chất lượng phát hành. |
| Client–Server | Save hiện tại dùng localStorage. Bản Vite có cảnh nền Phaser 4.2.1 viết bằng TypeScript. Game mode dùng gameplay JavaScript hiện có. | Chuyển battle sang Phaser, backend, PostgreSQL, Redis và kênh realtime. Lưu tài khoản, inventory, tiến trình và phục hồi trận trên server. CDN và benchmark thực tế. |

## Bằng chứng và mức nghiệm thu

- Bản chơi thử có cả ba vòng chơi với bot. Chạy cục bộ theo [hướng dẫn client](../../client/README.md).
- Các suite JavaScript và Python kiểm tra luật mẫu, save cục bộ, animation, tài nguyên và luồng chơi. Bản cập nhật trước đã chạy smoke test với DOM/Canvas. Kiểm tra đó chưa xác lập hiệu năng 60 FPS, WebGL/Spine, reconnect hoặc hệ thống server trên trình duyệt và thiết bị thật.
- Bộ concept là đích về mỹ thuật và trải nghiệm. Trạng thái phát hành được xác định qua [kế hoạch QA](ACCEPTANCE_TEST_PLAN.md) và cổng ở [SPEC Web Client–Server](../03_engineering/ENGINE_ARCHITECTURE.md).
