# TablePulse — QR Table Ordering & Restaurant OS

> Multi-tenant SaaS for independent restaurants: customers scan a QR code on
> their table, browse the menu, order to the kitchen, track preparation, and
> pay — all from their phone, no app download.

---

## ✨ What works today (Phases 0–5)

- **Auth & multi-tenancy** — owner registration, JWT login, per-tenant data isolation, staff logins (manager / waiter / kitchen)
- **Restaurant & menu setup** — restaurants, branches, tables with QR codes, categories, items with photos, veg/non-veg, modifiers
- **Customer ordering** — QR → menu → item customization → cart → order tracking → session bill
- **Kitchen Display (KDS)** — live NEW / PREPARING / READY board with timers, chime, and one-tap status flow
- **Waiter floor** — table statuses, ready alerts, serve + close-session, waiter assignment
- **Table ops** — occupied-guard deletes, bulk delete with partial success, number reuse for inactive tables

Roadmap: payments & billing (mock next) → analytics → deploy & pilot.

---

## 🧱 Tech stack

| Layer | Choice |
| :--- | :--- |
| Backend | Java 21, Spring Boot, Spring Security (JWT), Spring Data JPA, Flyway, PostgreSQL 16, ZXing (QR) |
| Frontend | React 19, Vite, React Router, MUI, Tailwind |
| Realtime (now) | Polling (7s KDS, 5s order tracker); WebSocket planned |

---

## 📂 Structure

```text
tablepulse/
├── tablepulse-api/   # Spring Boot backend (port 8081)
│   └── src/main/java/com/tablepulse/
│       ├── auth/        # register/login/JWT/staff
│       ├── restaurant/  # restaurants + branches
│       ├── table/       # tables + QR codes
│       ├── menu/        # categories/items/modifiers + public menu
│       ├── order/       # sessions/orders/bill + staff order APIs
│       ├── kitchen/     # (Phase 4 lives in order + frontend)
│       ├── payment/     # planned (Phase 6)
│       └── analytics/   # planned (Phase 7)
├── frontend/           # React app (port 5173)
│   └── src/
│       ├── pages/customer/  # menu, cart, tracker, bill
│       ├── pages/admin/     # restaurants, menu manager, tables, staff
│       ├── pages/kitchen/   # KDS board
│       └── services/        # API clients
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites

- Java 21 JDK, Node.js 20+, PostgreSQL 16

### 1. Database

```sql
CREATE DATABASE tablepulse_db;
CREATE USER tablepulse_user WITH PASSWORD 'tablepulse123';
GRANT ALL PRIVILEGES ON DATABASE tablepulse_db TO tablepulse_user;
```

Flyway runs migrations (`V1–V8`) automatically on backend start.

### 2. Backend (port 8081)

```powershell
cd tablepulse-api
.\mvnw spring-boot:run
```

Health check: `GET http://localhost:8081/api/health` → `{"status":"UP"}`

### 3. Frontend (port 5173)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` — register an owner, create a restaurant,
add a branch + tables + menu, then open a table's customer link
(`/r/{slug}/t/{table}?b={branchId}`) to order like a customer.

---

## ⚙️ Configuration (environment variables)

The backend reads all secrets from the environment with local dev defaults.
Defaults in `tablepulse-api/src/main/resources/application.yml` are **dev-only**.

| Variable | Default (dev) | Required in production? |
| :--- | :--- | :--- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/tablepulse_db` | Yes — your managed Postgres URL |
| `SPRING_DATASOURCE_USERNAME` | `tablepulse_user` | Yes |
| `SPRING_DATASOURCE_PASSWORD` | `tablepulse123` | Yes — strong unique password |
| `APP_JWT_SECRET` | `dev-only-change-me-...` | **Yes — random 32+ chars, rotate on every deploy if leaked** |
| `APP_JWT_EXPIRATION` | `86400` | No |
| `APP_UPLOAD_DIR` | `uploads` | No (use a persistent volume) |
| `APP_PUBLIC_BASE_URL` | `https://tablepulse.in` | Yes — your real domain |
| `APP_CORS_ORIGINS` | `http://localhost:5173` | Yes — comma-separated frontend origins |

Example (PowerShell):

```powershell
$env:SPRING_DATASOURCE_PASSWORD="strong-unique-password"
$env:APP_JWT_SECRET="random-32-plus-char-secret-here"
.\mvnw spring-boot:run
```

> ⚠️ Never commit real secrets. If a production secret ever lands in git,
> rotate it immediately — removing the file later does not erase history.

---

## 🔑 Key API groups

```text
POST /api/auth/register, /api/auth/login, GET/PUT /api/auth/me
POST /api/staff, GET /api/staff              # owner/manager only
CRUD /api/restaurants, /api/branches, /api/.../tables, /api/.../categories, /api/.../items
POST /api/branches/{id}/tables/bulk-delete {tableIds}  # partial success: {deleted[], blocked[{tableNumber, reason}]}
GET  /api/public/restaurants/{slug}, /{slug}/menu      # customer, no auth
POST /api/public/sessions, /api/public/orders, GET .../bill
GET  /api/orders, PATCH /api/orders/{id}/status        # staff (JWT)
GET  /api/branches/{id}/tables/status, POST /api/sessions/{id}/close  # waiter floor
```

## 📄 License

All rights reserved — source available for review. Contact the owner for reuse.
