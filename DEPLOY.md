# CI/CD cho FE với GitHub Actions và Portainer

- Workflow: `.github/workflows/ci-cd.yml`
- Docker image dùng Caddy để phục vụ FE: GHCR, theo tên repository GitHub
- Portainer stack: `horse-racing-fe`, cấu hình trong `deploy/portainer/stack.yml`

## Quy trình

- Pull request vào `main`: cài dependencies và build FE.
- Push lên `main`: build FE, tạo image Docker, push các tag `latest` và `sha-<commit>` lên GHCR; sau đó workflow tự tạo stack nếu chưa có, hoặc cập nhật stack hiện tại trong Portainer.
- Tạo tag `v*`: build và push image có tag release.

## Cấu hình build production

Workflow dùng `deploy/portainer/env.production` làm cấu hình build production. File này cần có:

```dotenv
VITE_API_URL=https://api.example.com/api/v1
VITE_SOCKET_URL=https://api.example.com/events
```

Thay bằng URL production thật trước khi push. Các biến `VITE_` được đóng gói vào frontend và người dùng có thể xem được; không đặt secret trong đó.

Commit file này cùng source. Workflow chép nó thành `.env.production` ở thư mục gốc ngay trước khi chạy Vite build.

## Cấu hình Portainer

Portainer cần được truy cập từ GitHub Actions runner qua HTTPS. Tạo API access token trong Portainer tại **My account → Access tokens**, rồi khai báo trong GitHub repository **Settings → Secrets and variables → Actions**.

**Variables**

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `PORTAINER_URL` | Có | URL gốc, ví dụ `https://portainer.example.com:9443` |
| `PORTAINER_ENDPOINT_ID` | Có | ID số của Docker environment/VPS trong Portainer |
| `WEB_PORT` | Không | Cổng mở trên VPS; mặc định `8080` |
| `PORTAINER_REGISTRY_ID` | Nếu GHCR private | ID registry GHCR đã cấu hình trong Portainer |

**Secret**

| Tên | Mô tả |
| --- | --- |
| `PORTAINER_API_KEY` | API access token của Portainer |

Stack được tạo tự động với tên `horse-racing-fe`. Nếu GHCR package là private, hãy tạo registry GHCR trong Portainer bằng credential có quyền `read:packages`, rồi đặt `PORTAINER_REGISTRY_ID` trước lần deploy đầu tiên. Nếu package public thì không cần biến registry này.

Container Caddy phục vụ FE qua HTTP tại cổng `80`; stack chỉ bind cổng VPS ở `127.0.0.1:<WEB_PORT>`. Nếu Caddy đã cài trực tiếp trên VPS, thêm site vào Caddyfile của VPS:

```caddyfile
fe.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Đổi `fe.example.com` theo domain và `8080` theo `WEB_PORT`. Caddy trên VPS xử lý domain/HTTPS; Caddy trong container phục vụ file FE. Nếu Caddy cũng chạy trong Docker, cần cho hai container dùng chung Docker network và proxy tới service của FE thay vì `127.0.0.1`.
