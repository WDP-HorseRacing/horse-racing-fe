# CI/CD cho FE với GitHub Actions và Portainer

- Workflow: `.github/workflows/ci-cd.yml`
- Docker image dùng Caddy để phục vụ FE: GHCR, theo tên repository GitHub
- Portainer stack: `horse-racing-fe`, cấu hình trong `deploy/portainer/stack.yml`

## Quy trình

- Pull request vào `main`: cài dependencies và build FE.
- Push lên `main`: build FE, tạo image Docker, push các tag `latest` và `sha-<commit>` lên GHCR; sau đó workflow tự tạo stack nếu chưa có, hoặc cập nhật stack hiện tại trong Portainer.
- Tạo tag `v*`: build và push image có tag release.

## Cấu hình build production

Workflow đọc `VITE_API_URL` và `VITE_SOCKET_URL` từ `deploy/portainer/env.production`, rồi chép file này thành `.env.production` ở thư mục gốc trước khi chạy Vite build.

Commit file `deploy/portainer/env.production` cùng source để GitHub Actions nhận được. File này chỉ nên chứa URL production; các biến `VITE_` được đóng gói vào frontend nên người dùng có thể xem, không đặt password hoặc token riêng tư ở đây.

## Cấu hình Portainer

Portainer cần được truy cập từ GitHub Actions runner qua HTTPS. Tạo API access token trong Portainer tại **My account → Access tokens**, rồi khai báo `PORTAINER_URL`, `PORTAINER_ENDPOINT_ID` và các biến liên quan tại **Settings → Secrets and variables → Actions → Variables**; lưu token `PORTAINER_API_KEY` dưới **Secrets**.

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

Stack được tạo tự động với tên `horse-racing-fe`. Nếu GHCR package là private, hãy tạo registry GHCR trong Portainer bằng credential có quyền `read:packages`, rồi đặt `PORTAINER_REGISTRY_ID` trước lần deploy đầu tiên. Nếu package public thì không cần biến registry này.

Stack dùng Docker network external `racehorse-net`. Tạo network này một lần trong Portainer **Networks → Add network** với driver `bridge`, nếu chưa có; sau đó gắn cả stack Caddy và FE vào network này. FE cũng bind cổng `8081` trên loopback của VPS (`127.0.0.1:8081`), nên Caddy cài trực tiếp trên VPS có thể proxy tới `localhost:8081`. Có thể đổi cổng bằng biến stack `WEB_PORT`.

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

Đổi `fe.example.com` theo domain. Caddy ngoài xử lý domain/HTTPS; Caddy trong container FE phục vụ file frontend. Mapping chỉ mở trên loopback, không chiếm cổng HTTP/HTTPS công khai `80/443` của Caddy. Nếu `8081` đã được dùng, đổi `WEB_PORT` trong biến môi trường của stack Portainer.
