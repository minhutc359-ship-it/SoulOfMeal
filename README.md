# Soul of Meal

Game anime chibi về các Vị Linh của ẩm thực Việt Nam. Bản web có tuyến Phiêu lưu tại Làng Ẩm Thực, Thẻ chiến thuật và Đấu trường linh thú với bot.

```bash
cd Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3
npm --prefix client ci
npm --prefix client run dev
```

Mở [http://localhost:4173/client/](http://localhost:4173/client/).

- [Điều khiển, lối chơi và kiểm thử](Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/client/README.md)
- [Đặc tả game, mỹ thuật và kiến trúc](Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/README.md)

- [SPEC v3.2 Web Client–Server](Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/docs/03_engineering/ENGINE_ARCHITECTURE.md)
- [Đối chiếu concept với bản chơi thử](Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/docs/04_qa/PLAYTEST_CONCEPT_GAP.md)

- [Chạy tài khoản và lưu trên máy chủ](Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/server/README.md)

## Production trên Vercel

Project `soul-of-meal` dùng GitHub `minhutc359-ship-it/SoulOfMeal`, Production Branch `main` và Node.js 24.x. Giữ Root Directory ở gốc repository để Vercel đọc `vercel.json` và lấy dữ liệu `examples/` khi build. Mỗi push vào `main` cần xuất hiện trong Deployments với môi trường **Production** và đúng SHA GitHub. Địa chỉ chơi là [soul-of-meal-roan.vercel.app/client/](https://soul-of-meal-roan.vercel.app/client/).
