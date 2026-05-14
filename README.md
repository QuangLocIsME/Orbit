# Orbit

**BIM Collaboration Platform** — Real-time design review & clash detection for construction projects.

## 👥 Team Members & Contributions

| Student ID | Group Member | Role | Key Contributions |
| :--- | :--- | :--- | :--- |
| **2274801030026** | **Bùi Thảo Duyên (Leader)** | Frontend | Project Page, Overview, Packages, Documents, Version, Change Request, Task, Activity, Settings, 3D Viewer, Workflow, Trash |
| **2274801030072** | **Nguyễn Gia Khánh** | Frontend | Login, Registration, Project Clash |
| **2274801030066** | **Lê Minh Duy Khang** | Backend | Authentication support, small backend APIs |
| **2274801030031** | **Ngô Thành Đạt** | Frontend | Landing Page, Home Page |
| **2274801030086** | **Nguyễn Quang Lộc** | Backend, Database | Backend core, Database schema, Business logic, API integration |

---

## ✨ Features

- **3D Model Viewer** — View IFC, Navisworks, DWG files with xeokit SDK
- **Clash Detection** — Automatic collision detection between models
- **Change Requests** — Track design changes with attachments
- **Task Management** — Assign, review, and approve tasks
- **Real-time Sync** — CDC-powered live updates via WebSocket
- **PDF Report Generation** — Export clash reports and tasks to PDF
- **Team Management** — Roles, permissions, and project invitations
- **File Versioning** — Track multiple versions of uploaded models

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Astro + React 19 + TypeScript |
| **Backend** | Express.js + MongoDB + Redis |
| **Queue** | RabbitMQ |
| **Storage** | Supabase S3 |
| **3D Engine**| xeokit SDK |
| **Auth** | JWT + Google OAuth 2.0 |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 6+
- Redis 7+
- RabbitMQ 3+

### 1. Clone & Install

```bash
git clone https://github.com/your-org/Orbit.git
cd Orbit

# Backend
cd Backend
cp .env.example .env
# Edit .env with your credentials
npm install

# Frontend
cd ../Frontend
npm install
```

### 2. Configure Environment

Edit `Backend/.env`:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Supabase S3
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### 3. Run Development

```bash
# Terminal 1 - Backend
cd Backend
npm run dev

# Terminal 2 - Backend CDC Worker
cd Backend
npm run worker:cdc

# Terminal 3 - IFC Conversion Worker
cd Backend
npm run worker:ifc

# Terminal 4 - Frontend
cd Frontend
npm run dev
```

### 4. Architecture (Production)

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   MongoDB   │
│   (Astro)   │◀────│  (Express)  │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │ WebSocket         │ Queue             │ CDC
       │ (real-time)       │ (RabbitMQ)        │ (Change Streams)
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Redis     │     │   Workers   │     │ Supabase S3 │
│   (Cache)   │     │ (IFC→XKT)   │     │  (Storage)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 📁 Project Structure

```text
Orbit/
├── Backend/
│   ├── controllers/     # API route handlers
│   ├── models/          # Mongoose schemas
│   ├── services/        # Business logic
│   ├── repositories/    # Data access layer
│   ├── workers/         # Background job processors
│   └── utils/           # Helpers
├── Frontend/
│   └── src/
│       ├── components/
│       │   ├── features/  # Page components
│       │   ├── layout/    # Layout components
│       │   └── ui/        # shadcn/ui components
│       ├── hooks/         # Custom React hooks
│       ├── stores/        # Zustand state
│       └── lib/           # Utilities
└── docker-compose.yml
```

## 🔌 API Endpoints

### Projects
- `GET /api/projects` — List user projects
- `POST /api/projects` — Create project
- `GET /api/projects/:id` — Get project details

### Packages
- `POST /api/projects/:id/packages` — Upload package
- `GET /api/packages/:id/versions` — List versions
- `POST /api/packages/:id/versions` — Add new version

### Tasks
- `GET /api/tasks` — List tasks
- `POST /api/tasks` — Create task
- `PATCH /api/tasks/:id` — Update task

### Clash
- `POST /api/projects/:id/clash/run` — Run clash detection
- `GET /api/projects/:id/clash/results` — Get clash results

## 📄 Supported File Formats

| Format | Extension | Notes |
| :--- | :--- | :--- |
| **IFC** | `.ifc` | 3D model standard |
| **Navisworks** | `.nwd, .nwf, .nwc` | Clash analysis |
| **DWG** | `.dwg` | AutoCAD |
| **DXF** | `.dxf` | CAD exchange |
| **Revit** | `.rvt` | BIM models |
| **SketchUp** | `.skp` | 3D design |
| **PDF** | `.pdf` | Documents |
