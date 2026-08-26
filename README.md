# Teader

AI-native project management platform. Built with Next.js 16 (App Router), React 19, TypeScript, MySQL, and TailwindCSS.

## Features

- **Kanban Board** — drag-and-drop task management across Todo / In Progress / Review / Done stages
- **Hierarchical View** — epic → task → subtask tree grouped by epic, status, or assignee
- **Tree View** — infinite recursive folder explorer with drag-and-drop parent switching
- **Dev Stream** — developer workstation view with Git command generators and task checklists
- **AI Assistant** — streaming Claude integration with issue context (requires `ANTHROPIC_API_KEY`)
- **Project Management** — create, join, and manage multiple projects with member roles
- **Inline Editing** — rename anything in-place; full issue editing with description, epic, priority

## Quick Start

### 1. Prerequisites

- Node.js 20+
- MySQL 8+

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

Edit `.env` and fill in your MySQL credentials and `JWT_SECRET`. See `.env.example` for all available variables.

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
| `MYSQL_HOST` | Yes | MySQL host (default: localhost) |
| `MYSQL_PORT` | No | MySQL port (default: 3306) |
| `MYSQL_USER` | **Yes** | MySQL username |
| `MYSQL_PASSWORD` | **Yes** | MySQL password |
| `MYSQL_DATABASE` | **Yes** | Database name |
| `DATABASE_URL` | Yes (Prisma) | Full MySQL connection URL |
| `JWT_SECRET` | **Yes** | 64+ byte random hex string for JWT signing |
| `ANTHROPIC_API_KEY` | No | Enables AI chat panel (claude-3-5-sonnet) |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the app |

## Project Structure

```
app/
  api/             # All API routes
    ai/chat/       # AI streaming chat (Anthropic)
    auth/          # Login, register, logout, me
    issues/        # Issue CRUD
    projects/      # Project CRUD + members + join
    subtasks/      # Subtask/folder CRUD
    upload/        # Image upload (auth-gated, magic-byte verified)
  projects/[id]/
    page.tsx       # Single project — Board/Hierarchy/Tree/Dev views
    [view]/        # URL routing: /projects/4/tree, /dev, /hierarchy
components/        # All UI components
lib/
  auth.ts          # JWT signing, bcrypt passwords, requireAuth helper
  db.ts            # MySQL raw queries and data access helpers
  ratelimit.ts     # In-memory auth rate limiter
  types.ts         # TypeScript interfaces
  validation.ts    # Zod schemas for all API routes
middleware.ts      # Global API auth guard (protects all /api/* routes)
prisma/
  schema.prisma    # Full schema with Comment, Activity, Sprint, Label models
scripts/
  db-seed.js       # Database initialization and demo data seed
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run db:setup` | Initialize DB and seed demo data |
| `npm run db:seed` | Re-seed demo data |

## Security

- All API routes are protected by middleware JWT verification (except `/api/auth/*`)
- Passwords hashed with bcrypt (cost 12), with automatic migration from old SHA-256 hashes on login
- Session stored as signed JWT cookie (`teader_session`, httpOnly, sameSite: lax)
- Rate limiting (10 req / 15 min per IP+email) on login and register
- Upload endpoint: requires auth, verifies magic bytes, enforces 5 MB size cap, MIME allowlist
- No hardcoded DB credentials — throws startup error if env vars are missing
