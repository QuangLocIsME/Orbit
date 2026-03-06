# API Endpoints (cho nối backend)

Các service đã gọi sẵn các endpoint sau. Khi có backend thật, có thể:
1. Set `PUBLIC_API_URL` trong `.env` trỏ tới API server (vd: `https://api.example.com`)
2. Hoặc thay thế các file trong `src/pages/api/` bằng proxy tới backend

## Endpoints

| Method | Path | Service | Mô tả |
|--------|------|---------|-------|
| GET | `/api/dashboard/projects/recent` | dashboard-service | Dự án gần đây |
| GET | `/api/events/upcoming` | event-service | Sự kiện sắp tới |
| GET | `/api/tasks` | task-service | Task của user |
| GET | `/api/folders` | folder-service | Danh sách thư mục |
| GET | `/api/projects/priority` | project-service | Dự án ưu tiên |
| GET | `/api/user/sidebar` | user-service (server) | User + favorites/shared/private cho Sidebar |
| POST | `/api/auth/login` | auth-service | Đăng nhập |
| POST | `/api/auth/register` | auth-service | Đăng ký |
