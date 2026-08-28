# Project Instructions & Workflow Guidelines

> **IMPORTANT**: The CLI / Agent must read this file upon initial opening and strictly follow all instructions outlined below for every task.

---

## 1. Git Commit & Push Workflow (Strict Rule)

Whenever any code changes, edits, bug fixes, or feature implementations are completed:

1. **Granular Local Commits**:
   - Do NOT make a single giant monolithic commit for everything.
   - Stage and commit changes **step-by-step as distinct, modular commits** grouped logically by functionality / layer (e.g., Database/Types, API Routes, UI Components, Page Views).
   - Use clear conventional commit messages (e.g., `fix(db): ...`, `feat(routes): ...`, `feat(ui): ...`).

2. **Unified Push**:
   - **Do NOT push step-by-step after each individual commit.**
   - First create all the separate commits locally.
   - Once all commits are created and verified, **push all commits together in a single `git push`** to the `main` branch on GitHub (`origin main`).

---

## 2. Verification Before Committing

Before creating commits:
- Run tests (`npm test` / `vitest run`) to ensure no regressions.
- Verify TypeScript & Next.js compilation (`npm run build`).
- Ensure no database syntax or query issues exist.

---

## 3. Database & Architecture Standards

- **Database**: PostgreSQL (port 5678, user `ajaysaagar`, db `teader_db`).
- Queries with `ORDER BY` expressions (e.g. `COALESCE`) must NOT use conflicting `SELECT DISTINCT` clauses without proper subquery scoping.
- Maintain proper error logging in database helper functions (`lib/db.ts`).
