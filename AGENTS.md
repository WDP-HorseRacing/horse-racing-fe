# RaceOS Web Design Constraints & Rules

## 1. Brand Color
- Sử dụng màu **Xanh lá (Grass Green)** làm màu chủ đạo. Màu xanh này phải thể hiện sự phóng khoáng, tự nhiên của đồng cỏ tại trường đua ngựa.
- **TUYỆT ĐỐI CẤM:** Không sử dụng gradient Xanh dương-Tím (Blue-to-purple) dưới bất kỳ hình thức nào.

## 2. Typography
- **Cấm dùng font Inter** (trừ trường hợp cố ý dùng system-ui).
- Lựa chọn font chữ có cá tính hơn (VD: Outfit, Geist, Cabinet Grotesk).

## 3. Layout & Structure
- **Cấm sử dụng layout đối xứng 3 cột (3 feature cards)**.
- Bắt buộc dùng lưới bất đối xứng (asymmetric grid), masonry, bento box.

## 4. UI Components (Anti-Chrome)
- Không dùng chữ IN HOA toàn bộ (uppercase) cho eyebrow labels.
- Không dùng viền và đổ bóng giống hệt nhau trên mọi card. Đổ bóng nên có màu (tinted shadow).
- Không thêm số bước 01/02/03 máy móc.

## 5. Tech Stack Guidelines
- Tailwind CSS + Radix UI: Tự style dựa trên Radix primitives, tránh dùng Shadcn mặc định.
- Sử dụng motion, gsap, lenis cho mượt mà.
