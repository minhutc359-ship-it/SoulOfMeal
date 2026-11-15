# Nguồn minh họa thẻ

`splash/manifest.json` liệt kê 160 ảnh WebP (80 HD và 80 preview), kích thước, SHA-256 và 17 gói nguồn. Các gói gzip chứa JSON/base64 của đúng byte ảnh đã đăng ký; bước khôi phục không tạo lại hoặc nén lại hình.

Từ thư mục gốc của gói v3:

```bash
node client/build/materializeSplashAssets.js
```

`npm --prefix client ci`, Vite dev và Vite build cũng khôi phục ảnh. Mọi gói và ảnh được kiểm tra trước khi ghi, ảnh đúng hash được giữ nguyên, ảnh thiếu/hỏng được thay bằng ghi tệp tạm rồi đổi tên. Gói thiếu hoặc hỏng làm lệnh thất bại. Đường dẫn runtime và danh mục ngoại tuyến giữ nguyên.

Khi thay ảnh, cập nhật đăng ký/provenance tại `docs/02_art/SPLASH_ART_JOBS.json` và catalog, sau đó chạy:

```bash
python scripts/pack_splash_sources.py .
node client/build/materializeSplashAssets.js
python scripts/update_file_index.py .
python scripts/validate_package.py .
```

Commit gói nguồn, manifest, catalog và file index; các WebP khôi phục được bỏ qua bởi Git. `FILE_INDEX.json` vẫn kiểm tra cả ảnh runtime lẫn gói nguồn. Gói nguồn chỉ phục vụ phát triển/build, không nằm trong bản web hay gói tải ngoại tuyến. Quy trình này bảo toàn nguồn ảnh và hash; việc duyệt mỹ thuật/quyền phát hành vẫn theo báo cáo QA.
