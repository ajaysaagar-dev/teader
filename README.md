# Teader

Project management platform. Built with Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, and TailwindCSS.

## Features

- **Kanban Board** — drag-and-drop task management across Todo / In Progress / Review / Done stages
- **Hierarchical View** — epic → task → subtask tree grouped by epic, status, or assignee
- **Tree View** — infinite recursive folder explorer with drag-and-drop parent switching
- **Developer Git Automation** — automatic branch naming and copyable git commands in issue details
- **Project Management** — create, join, and manage multiple projects with member roles
- **Inline Editing** — rename anything in-place; full issue editing with description, epic, priority
- **Real-time Sync** — SSE and WebSocket live sync with project-scoped authorization

## Quick Start

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 15+

### 2. Clone & Install

```bash
git clone https://github.com/ajaysaagar-dev/teader.git
cd teader
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your PostgreSQL credentials and `JWT_SECRET`. See `.env.example` for all available variables.

Generate a `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Initialize Database

```bash
npm run db:setup
```

This runs `scripts/db-seed.js` which creates all tables and seeds demo data.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with:
- **Email:** `karri@teader.io` / **Password:** `password123`
- **Email:** `ajaysaagar@teader.io` / **Password:** `password123`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_HOST` | Yes | PostgreSQL host (default: localhost) |
| `POSTGRES_PORT` | No | PostgreSQL port (default: 5678) |
| `POSTGRES_USER` | **Yes** | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | PostgreSQL password |
| `POSTGRES_DATABASE` | **Yes** | Database name |
| `DATABASE_URL` | Yes (Prisma) | Full PostgreSQL connection URL |
| `JWT_SECRET` | **Yes** | 64+ byte random hex string for JWT signing |
| `INTERNAL_BROADCAST_SECRET` | Recommended | Shared secret for WS broadcast endpoint auth |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the app |

## Project Structure

```
app/
  api/             # All API routes
    auth/          # Login, register, logout, me
    issues/        # Issue CRUD (project-scoped authorization)
    projects/      # Project CRUD + members + join
    subtasks/      # Subtask/folder CRUD (project-scoped authorization)
    upload/        # Image upload (auth-gated, magic-byte verified)
    realtime/      # SSE stream (session + project membership verified)
  projects/[id]/
    page.tsx       # Single project — 4-page IA: Overview, Tasks, Docs, Settings
    [view]/        # URL routing & backwards-compatible redirects
components/        # All UI components
lib/
  auth.ts          # JWT signing, bcrypt passwords, requireAuth helper
  authz.ts         # Project-scoped authorization (assertProjectAccess)
  db.ts            # PostgreSQL raw queries and data access helpers
  ratelimit.ts     # In-memory auth rate limiter
  types.ts         # TypeScript interfaces
  validation.ts    # Zod schemas for all API routes
middleware.ts      # Global API auth guard (protects all /api/* routes)
prisma/
  schema.prisma    # Full schema with Comment, Activity, Sprint, Label models
scripts/
  db-seed.js       # Database initialization and demo data seed
server/
  ws-server.js     # Authenticated WebSocket hub (JWT + project membership)
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (port 3000) |
| `npm run ws` | Start WebSocket hub (port 3001) |
| `npm run build` | Production build |
| `npm run db:setup` | Initialize DB and seed demo data |
| `npm run db:seed` | Re-seed demo data |

## Security

- All API routes are protected by middleware JWT verification (except `/api/auth/*`)
- All mutation routes enforce project-scoped authorization (owner/member checks)
- Passwords hashed with bcrypt (cost 12), with automatic migration from old SHA-256 hashes on login
- Session stored as signed JWT cookie (`teader_session`, httpOnly, sameSite: lax)
- Rate limiting (10 req / 15 min per IP+email) on login and register
- Upload endpoint: requires auth, verifies magic bytes, enforces 5 MB size cap, MIME allowlist
- Database credentials must be provided via environment variables — startup fails if not configured
- WebSocket server requires JWT token on connect and verifies project membership before room subscription
- Broadcast endpoint requires `INTERNAL_BROADCAST_SECRET` header (server-to-server only)
