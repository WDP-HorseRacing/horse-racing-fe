# CI/CD cho FE với GitHub Actions và Portainer

- Workflow: `.github/workflows/ci-cd.yml`
- Docker image dùng Caddy để phục vụ FE: GHCR, theo tên repository GitHub
- Portainer stack: `horse-fe`, cấu hình trong `deploy/portainer/stack.yml`

## Quy trình

- Pull request vào `main`: cài dependencies và build FE.
- Push lên `main`: build FE, tạo image Docker, push các tag `latest` và `sha-<commit>` lên GHCR; sau đó workflow tự tạo stack nếu chưa có, hoặc cập nhật stack hiện tại trong Portainer.
- Tạo tag `v*`: build và push image có tag release.

## Cấu hình build production

Workflow gắn hai job build và deploy với GitHub Environment `Deploy-FE`. Build đọc `VITE_API_URL` và `VITE_SOCKET_URL` từ **Settings → Environments → Deploy-FE → Variables**. Khai báo hai biến này để cấu hình địa chỉ BE và WebSocket cho FE.

Nếu thiếu một trong hai biến `VITE_*`, workflow dùng giá trị tương ứng trong `deploy/portainer/env.production` làm phương án dự phòng. Các biến `VITE_` được đóng gói vào frontend nên người dùng có thể xem; không đặt password hoặc token riêng tư ở đây.

## Cấu hình Portainer

Portainer cần được truy cập từ GitHub Actions runner qua HTTPS. Tạo API access token trong Portainer tại **My account → Access tokens**, rồi khai báo `PORTAINER_URL`, `PORTAINER_ENDPOINT_ID` và các biến liên quan dưới **Deploy-FE → Variables** hoặc **Actions → Variables**. Lưu token `PORTAINER_API_KEY` dưới **Deploy-FE → Secrets** hoặc **Actions → Secrets**.

**Variables**

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `PORTAINER_URL` | Có | URL gốc, ví dụ `https://portainer.example.com:9443` |
| `PORTAINER_ENDPOINT_ID` | Có | ID số của Docker environment/VPS trong Portainer |
| `PORTAINER_REGISTRY_ID` | Nếu GHCR private | ID registry GHCR đã cấu hình trong Portainer |

**Secret**

| Tên | Mô tả |
| --- | --- |
| `PORTAINER_API_KEY` | API access token của Portainer |

Stack được tạo tự động với tên `horse-fe`. Nếu GHCR package là private, hãy tạo registry GHCR trong Portainer bằng credential có quyền `read:packages`, rồi đặt `PORTAINER_REGISTRY_ID` trước lần deploy đầu tiên. Nếu package public thì không cần biến registry này. Biến Actions `WEB_PORT` tùy chọn, mặc định là `8081`.

Stack dùng Docker network external `racehorse-net`. Tạo network này một lần trong Portainer **Networks → Add network** với driver `bridge`, nếu chưa có; sau đó gắn cả stack Caddy và FE vào network này. FE publish cổng `8081` trên các interface của VPS, nên có thể truy cập `http://<IP-VPS>:8081` sau khi mở TCP `8081` trong firewall/security group. Caddy cài trực tiếp trên VPS có thể proxy tới `localhost:8081`.

Nếu Caddy chạy trong Docker, proxy qua network chung bằng alias `horse-racing-fe:80`:

Trong stack Caddy, khai báo network dùng chung:

```yaml
services:
  caddy:
    networks:
      - racehorse-net

networks:
  racehorse-net:
    external: true
```

Sau đó, trong Caddyfile của stack Caddy:

```caddyfile
fe.example.com {
    reverse_proxy horse-racing-fe:80
}
```

Đổi `fe.example.com` theo domain. Caddy ngoài xử lý domain/HTTPS; Caddy trong container FE phục vụ file frontend. Nếu `8081` đã được dùng, đặt `WEB_PORT` trong GitHub Actions Variables thành cổng trống khác và mở cổng TCP tương ứng trong firewall/security group.
