# Dữ liệu mẫu cho môi trường demo

Script tạo dữ liệu mẫu (4 khu, 17 ngựa gồm 4 ngựa giống đã giải nghệ làm ông bà trong phả hệ, tài khoản, giáo án, lớp thử, y tế, kho…) qua REST API, không đụng DB trực tiếp. Chạy lại không tạo trùng: mọi thứ được tìm trước theo email, tên khu, mã ô, số chip, tên môn, tên giáo án, mã lớp, tên vật tư.

Cần Node 20 trở lên. Không cần cài thư viện.

## Chạy

Mở terminal ở thư mục repo FE (PowerShell hay Git Bash đều được), gõ lệnh rồi nhập mật khẩu chung của các tài khoản khi được hỏi. Chữ gõ vào không hiện ra, không lưu vào file nào.

```bash
node scripts/seed-demo/seed.mjs check --api https://api.horse.io.vn/api/v1
node scripts/seed-demo/seed.mjs run --api https://api.horse.io.vn/api/v1
```

Không muốn nhập mỗi lần thì đặt biến môi trường `SEED_PASSWORD` trước (PowerShell: `$env:SEED_PASSWORD = "..."`).

Script chỉ gọi API (api.horse.io.vn), không cần build hay deploy lại FE.

| Lệnh | Làm gì |
|---|---|
| `check` | Đăng nhập 5 tài khoản có sẵn, in vai trò. Không ghi gì |
| `run` | Chạy `check` rồi tạo toàn bộ dữ liệu. Lần đầu mất khoảng 5 phút vì có 2 buổi chạy thử thật (mỗi buổi chờ khoảng 1 phút rồi chạy 20 giây) |
| `daily` | Thêm dữ liệu của hôm nay: số đo, tick checklist, một buổi chạy thử xong cho mỗi lớp thử. Chạy mỗi ngày trước buổi demo để biểu đồ, báo cáo tuần có nhiều điểm |

Bỏ `--api` thì chạy vào `http://localhost:3000/api/v1`.

## Nên chạy khi nào

- `run`: 2 đến 3 ngày trước buổi demo cho thầy. Dữ liệu mang ngày giờ lúc chạy (BE không cho lùi ngày khám, ngày tạo ngựa, phí nuôi).
- `daily`: mỗi ngày sau đó, một lần.
- Tránh chạy quanh 00:00 giờ Việt Nam (job 00:05 đóng checklist của ngày cũ).

## Tài khoản

5 tài khoản có sẵn: `club.manager`, `head.trainer`, `horse.owner`, `groom`, `veterinarian` (đuôi `@horse.test`).

Script tạo thêm (cùng mật khẩu): `head.trainer2`, `head.trainer3`, `groom2`, `groom3`, `groom4`, `veterinarian2`, `horse.owner2`, `horse.owner3`.

| Tài khoản | Dùng để |
|---|---|
| head.trainer | HLV demo, quản Khu A và Khu B. Chỉ có giáo án, không có lớp (lớp tạo trong lúc demo) |
| head.trainer2, head.trainer3 | Khu C, Khu D, mỗi người một lớp thử để test Flow 2 |
| groom | Groom demo (Khu A), dùng trên iPhone |
| horse.owner | Chủ ngựa demo |

Ô A-04, A-05, A-06 để trống cho 3 bộ demo (thử, thầy, hội đồng).

## Lỗi thường gặp

| Câu báo | Cách xử lý |
|---|---|
| `Tài khoản chưa được cấp` | Tài khoản có trong Keycloak nhưng chưa có dòng trong bảng `users` của app. Nhờ nhóm BE chèn (lệnh `check` in sẵn mẫu SQL) |
| `POST /users → 502` | Service account của BE thiếu quyền quản lý user trong Keycloak. Nhờ BE chạy bước 5 của `scripts/configure-keyclock.mjs` trên Keycloak thật |
| `Tài khoản hoặc mật khẩu không chính xác` | Sai `SEED_PASSWORD`. Không thử lại quá 4 lần: Keycloak khóa tạm sau 5 lần sai |
| `check` in "trong app là … <email khác>" | Không phải lỗi. BE nối tài khoản đăng nhập với dòng `users` theo id Keycloak, không theo email, nên họ tên và email trong trang Nhân sự là của dòng `users` mà BE đã chèn. Muốn trang Nhân sự hiện đúng email `@horse.test` thì nhờ BE sửa cột `email`, `full_name` của 5 dòng đó |
| Dừng giữa chừng vì lỗi khác | Sửa nguyên nhân rồi chạy lại `run`, các phần đã tạo sẽ được bỏ qua |

Đã chạy `run` bằng bản cũ thì chạy lại bằng bản mới: script tự cập nhật nội dung giáo án, gắn cha mẹ còn thiếu, thêm lần đo và buổi tập còn thiếu.

## Sửa dữ liệu

Toàn bộ tên, số liệu nằm trong `data.mjs`. Đổi tên ngựa hay khu sau khi đã chạy lên prod thì script sẽ coi là mục mới (tìm theo tên, số chip), nên chỉ đổi trước lần chạy đầu.

Ảnh ngựa thêm trên giao diện: đăng nhập Quản lý CLB → hồ sơ ngựa → bấm vào ảnh để thay.
