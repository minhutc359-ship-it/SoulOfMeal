# Tài khoản và lưu tiến trình luyện tập

Máy chủ dùng ASP.NET Core 10 và PostgreSQL. Bản chơi khách lưu riêng trên trình duyệt. Tài khoản mới bắt đầu từ hồ sơ mặc định. Sau khi đăng nhập, người chơi có thể tiếp tục nhiệm vụ, bộ bài, ván TCG, vòng Auto Chess và cài đặt trên thiết bị khác.

Máy chủ sở hữu tài khoản, phiên và quyền đọc/ghi bản lưu. Bản lưu luyện tập chứa snapshot do client tạo. PvP, phần thưởng và số dư dùng chung cần bộ luật xác nhận trên máy chủ trước khi phát hành.

## Chạy phát triển

Cần .NET 10 SDK, Node.js 22.12+ và một PostgreSQL có sẵn database trống. Đặt `ConnectionStrings__SoulOfMeal` thành chuỗi kết nối PostgreSQL, chẳng hạn `Host=127.0.0.1;Port=5432;Database=soul_of_meal;Username=som;Password=…`. Máy chủ tạo bảng ở lần khởi động đầu tiên.

Chạy các lệnh từ thư mục chứa `client/` và `server/`.

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://127.0.0.1:5080 \
  dotnet run --project server/SoulOfMeal.Server.csproj
```

Trong terminal khác:

```bash
npm --prefix client ci
SOM_API_TARGET=http://127.0.0.1:5080 npm --prefix client run dev
```

Mở [http://localhost:4173/client/](http://localhost:4173/client/) rồi chọn **Tài khoản** để đăng nhập hoặc tạo tài khoản. Vào **Cài đặt** để xem trạng thái lưu và đăng xuất. Nếu có thiết bị lưu trước, màn hình cho tải lại bản mới trên máy chủ sau khi xác nhận.

## Build cùng origin

```bash
SOM_ACCOUNTS=1 npm --prefix client run build
Web__ClientDirectory="$PWD/client/dist" dotnet run --project server/SoulOfMeal.Server.csproj
```

Khi triển khai, phục vụ qua HTTPS. Cấu hình `DataProtection__KeyPath` trỏ tới thư mục lưu khóa bền của máy chủ. Các instance cùng môi trường cần dùng chung khóa và database. Dùng kho cấu hình của môi trường cho chuỗi kết nối.

## Kiểm thử

Chạy `python3 server/verify_accounts.py http://127.0.0.1:5080` với database kiểm thử có thể xóa. Script tạo hai tài khoản thử để kiểm tra cookie, CSRF, quyền sở hữu bản lưu, ghi đồng thời, gửi lại cùng bản lưu và thu hồi phiên. Chạy `node --test client/tests/*.test.js` để kiểm tra hàng đợi đồng bộ, phiên hết hạn, xung đột và các luật chơi.

Máy chủ dùng thư viện [Npgsql](https://github.com/npgsql/npgsql) theo PostgreSQL License.

## Giao ước và hồ sơ v4

Khi tạo hồ sơ, máy chủ quay hai Vị Linh và ghi kết quả cùng hồ sơ vào PostgreSQL. Gửi lại cùng tên nhận lại đội khởi đầu đã lưu. Số dư Gacha, pity và kết quả triệu hồi được lưu trên máy chủ. Mỗi lượt Gacha dùng mã UUID để gửi lại cùng yêu cầu sau lỗi mạng. Cửa hàng, trang bị, cấp và sao Adventure dùng bản lưu luyện tập. Cân bằng của gacha và Adventure thuộc bản chơi thử.

Cấu hình thêm `Authentication__Google__ClientId` và `Authentication__Google__ClientSecret` để hiện nút Google. Đăng ký URI chuyển hướng `https://<game-origin>/signin-google` cho cùng origin phục vụ client và API. Tài khoản Google dùng định danh do Google cấp và phiên cookie của game. Chế độ khách có tùy chọn lưu trên máy chủ, với phiên gắn với trình duyệt. Bản Vercel tĩnh chạy chế độ lưu trên thiết bị khi chưa có API cùng origin.
