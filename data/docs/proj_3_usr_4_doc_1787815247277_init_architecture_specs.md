# TestProject — Architecture & Technical Specifications

## 1. Overview & System Goals
This document serves as the single source of truth for **TestProject** (TEST).
All architectural decisions, schema conventions, and milestone deliverables are maintained here.

---

## 2. Core Architecture
- **Framework**: Next.js 16 (App Router + Turbopack)
- **State & Real-time**: React 19 Client Components with Optimistic UI updates
- **Database Layer**: MySQL 8.0 Connection Pooling with high-availability in-memory fallback
- **Authentication**: JWT HttpOnly Cookies + Role-Based Access Control

---

## 3. Workflow & Branching Conventions
- Feature Branches: `feat/test-<id>-<name>`
- Fix Branches: `fix/test-<id>-<name>`
- Commit Message Convention: `feat(scope): detailed message`

---

## 4. Key Milestones & Epics
1. **MVP Launch**: Core issue tracker & Kanban board
2. **Phase 2**: Dependency DAG graph & real-time time tracking
3. **Phase 3**: Automation rules engine & cross-project "My Work" dashboard
