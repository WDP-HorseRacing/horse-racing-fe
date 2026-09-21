# Ranh giới dữ liệu

Dữ liệu nghiệp vụ không còn nằm ở thư mục này. Ranh giới hiện tại:

- `src/types/domain.ts` — hợp đồng dữ liệu duy nhất của giao diện, bám theo thiết kế bảng của back end.
- `src/services/db.ts` — kho dữ liệu (hiện lưu ở `localStorage`, khóa `horseracing_db_v1`).
- `src/services/seed.ts` — dữ liệu khởi tạo, sinh theo ngày tương đối so với hôm nay.
- `src/services/*.service.ts` — tầng dịch vụ theo từng luồng nghiệp vụ. Màn hình chỉ gọi qua đây.
- `src/auth/permissions.ts` — bảng quyền dùng chung cho menu, nút bấm và tầng dịch vụ.

Khi nối back end: thay phần ruột của từng hàm trong `services/*.service.ts` bằng lời gọi API,
giữ nguyên chữ ký hàm và kiểu trả về. Màn hình không phải sửa.
