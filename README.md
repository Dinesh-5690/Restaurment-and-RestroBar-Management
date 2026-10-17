# Restaurant Management Platform

Enterprise-grade restaurant POS, Kitchen Display, Approval Hub, and QR Ordering system.

## Architecture

```
Frontend (Next.js 14)          Backend (NestJS)
─────────────────────          ─────────────────
/pos           → POS           Auth, Users
/kitchen       → KDS           Tables + QR
/approval      → Hub           Menu (Categories + Items)
/admin/tables                  Orders (+ Order Items)
/admin/menu                    Kitchen (Batches + Fire)
/menu/[tableId] → Customer QR  Approval Hub
/login                         WebSocket Gateway
                               │
                               ├── PostgreSQL (main DB)
                               └── Redis (pub/sub + cache)
```

## Local Development

### Backend

```bash
cd backend
npm install
# Create PostgreSQL DB: restaurant_db
cp ../.env.example .env     # edit as needed
npm run start:dev
# API → http://localhost:3001/api
# WS  → ws://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
# Ensure NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local
npm run dev
# → http://localhost:3000
```

### Backend

```bash
cd backend
npm install
# Create PostgreSQL DB: restaurant_db
cp ../.env.example .env     # edit as needed
npm run start:dev
# API → http://localhost:3001/api
# WS  → ws://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
# Ensure NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local
npm run dev
# → http://localhost:3000
```

## Key Modules

| Module | Path | Description |
|--------|------|-------------|
| POS | `/pos` | Place orders, fire to kitchen, view active |
| Kitchen Display | `/kitchen` | Real-time per-station queue |
| Approval Hub | `/approval` | Approve/reject QR & online orders |
| QR Menu | `/menu/:tableId` | Customer-facing, no app install |
| Table Admin | `/admin/tables` | Create tables, QR generation |
| Menu Admin | `/admin/menu` | Categories → station mapping, items |

## Order Lifecycle

```
CREATED → APPROVAL_PENDING → APPROVED → COOKING → READY → COMPLETED
            (QR / Online)       │
                                └── Select items → Fire → Kitchen Batch
                                    Batch 1: 5 items
                                    Batch 2: remaining 5 (later)
```

## Real-Time Events (WebSocket)

| Event | Emitted When |
|-------|-------------|
| `ORDER_CREATED` | New order placed |
| `ORDER_APPROVED` | Approval hub approves |
| `ORDER_FIRED` | Items fired to kitchen |
| `ITEM_COOKING` | Kitchen marks item cooking |
| `ITEM_READY` | Kitchen marks item ready |
| `ITEM_SERVED` | Waiter marks item served |
| `ORDER_COMPLETED` | Full order done |
| `ORDER_CANCELLED` | Order rejected/cancelled |

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access |
| MANAGER | All except user delete |
| CASHIER | Orders, approval |
| WAITER | Place orders, mark served |
| KITCHEN | Kitchen display only |

## Default Credentials

- **Username:** `admin`
- **Password:** `admin123`

> Change JWT_SECRET in production!
