# TEADER — Linear-style simplification + Black & White theme (Claude Code CLI prompt)

Paste everything below the line into Claude Code, run from the repo root (`teader/`).

---

## 0. MISSION

Make Teader calm, spacious and easy to use, in the spirit of linear.app, and make it a **single black-and-white (monochrome) UI**. Remove every theme-switching / color-customisation option.

**HARD RULE: do not remove any existing feature.** Features may be *moved, regrouped, collapsed behind a menu, or restyled* — never deleted, never made unreachable. Every API route, DB query, permission check, realtime event and URL that works today must keep working.

Before touching code, read in this order:
1. `AGENTS.md` — this is Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.
2. `INSTRUCTIONS.md` — follow it strictly (see section 9).
3. `app/globals.css`, `lib/theme-manager.ts`, `components/AppLayout.tsx`, `app/projects/[id]/page.tsx`, `components/SettingsModal.tsx`.

---

## 1. AUDIT FINDINGS (already verified — re-verify with grep before acting)

**Why it feels complex today**
1. **Project page has 10 top tabs + a Chat toggle**: Overview, Tasks, Docs, Charts, Meeting, Chats, Apps, History, Settings, Plugins (`app/projects/[id]/page.tsx`, ~lines 1880–2040). The code comment above it already says "4-Page Primary Navigation" (Overview | Tasks | Docs | Settings) but the code renders 10. "Chats" tab and the Chat drawer duplicate each other.
2. **Tasks has a second 5-button switcher**: Structure, Board, Timeline, List, Dependencies (~lines 2145–2215).
3. **Project header is overloaded**: back link, name, edit icon, delete icon, key pill, creator pill, stacked avatars, RealtimeBadge, Import, Export — all on one row, all bordered pills.
4. **App header** (`components/AppLayout.tsx` ~308–510): Dashboard, Projects, Account, Settings tabs + search box + shortcuts icon + avatar (Account is reachable twice).
5. **Density**: ~443 uses of `text-[8–11px]`, ~504 `font-mono`, ~107 `uppercase` labels. Everything is boxed (border + bg pill inside border + bg pill). Kanban cards, list rows, issue detail and NewIssueModal are packed with badges.
6. **Settings modal has 6 tabs** (`general`, `theme`, `appearance`, `account`, `performance`, `shortcuts`); `ThemeColorSettings` is rendered in BOTH `general` and `theme`. "Display Density" writes `teader_ui_density` to localStorage but **nothing reads it** (dead setting). "Optimistic UI Cache — 0ms Instant Feedback Active" is a static string.

**Theme system facts (this decides the migration strategy)**
- `app/globals.css` defines CSS variables (`--bg-*`, `--text-*`, `--accent-yellow*`, `--status-*`, `--priority-*`, `--success/--danger/--info/--cyan/--purple/--brown*`) mapped into Tailwind `@theme`.
- `lib/theme-manager.ts` (716 lines: tokens, 8+ presets, localStorage `teader_custom_theme_vars`, `teader_active_preset_id`), `components/ThemeColorSettings.tsx`, `components/ThemeInitializer.tsx` (mounted in `app/layout.tsx`) apply user colors onto `:root` at runtime. `tests/theme.test.ts` tests it.
- **Most of the app does NOT use the tokens.** `app/projects/[id]/page.tsx`, `IssueDetailView`, `CompactListView`, `NewIssueModal`, `ProjectSettingsView`, `app/dashboard`, `app/projects`, `app/conversations`, landing, documentation, etc. hardcode hex (`#131415 #1B1C1F #2A2C30 #DCB001 #9CA3AF #787C83 #EF4444 #22C55E #38BDF8 #14161F …`). Hex-bearing lines: ~200 in documentation page, ~140 each in project page / meeting / github views / TreeView / NewIssueModal / charts. Also Tailwind palette classes (`red-500`, `emerald-400`, `purple-500` …) in 10 files. **Swapping the `:root` variables alone will NOT make the UI monochrome.**
- Colors also hide in: `components/ui/StatusBadge.tsx` + `PriorityBadge.tsx` (`STATUS_CONFIG` / `PRIORITY_CONFIG`, consumed by `IssueDetailView`, `TreeView`), recharts/SVG charts (`AnalyticsView`, `ProjectOverviewView` donut, `ProjectChartsView`), `components/ui/CodeBlock.tsx` + `MarkdownRenderer.tsx`, `DiffViewerModal`, GitHub views, `lib/avatar.ts`, `app/layout.tsx` (`viewport.themeColor: "#DCB001"`), `app/manifest.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, splash/loading components (`WorkspaceSplashScreen`, `app/loading.tsx`, gradient "teader" wordmark in AppLayout auth screen), scrollbar hover in globals.css.
- **Stale saved themes would override the new look**: `ThemeInitializer` re-applies `teader_custom_theme_vars` on load. Existing users must be cleaned up (section 4.2).

**Dead / orphaned code (not features, but verify with grep before deleting)**
- `components/Sidebar.tsx` and `components/Header.tsx`: imported nowhere. (Sidebar is a good base for the new left nav.)
- `components/AutomationsModal.tsx`: imported nowhere, but `app/api/automations/route.ts` exists → **treat as an unfinished feature: keep both, and surface it (section 5.7).**
- `app/api/projects/[id]/calendar.ics/route.ts` has no UI link → surface it (Timeline view toolbar → "Export .ics").
- `/my-work`, `/initiatives`, `/conversations` pages exist but **no navigation links to them** (only the landing page links to `/documentation`). Surface them in the new nav.
- `components/CommandPalette.tsx` has stale entries ("Developer Workstation Stream", "Hierarchical View") and no entries for My Work, Initiatives, Conversations, Charts, Meeting, Chats, Apps, History, Plugins, Settings.

---

## 2. FEATURE-PRESERVATION CONTRACT

### Phase 0 (do first, commit nothing yet)
Create `docs/FEATURE-BASELINE.md` (a working file, you may commit it) containing:
- every file under `app/**/page.tsx` and `app/api/**/route.ts`;
- every component in `components/` and where it is imported (generate with a script: grep `from '...components/X'`);
- every `ProjectTab` and `TaskViewMode` value and every alias accepted by `parseViewTab` / `parseTaskMode`;
- every keyboard shortcut in `AppLayout.tsx` and `KeyboardShortcutsModal.tsx`;
- the list of localStorage keys in use.

At the end of the work, re-generate it and prove: **no route, no API, no component, no tab id, no alias, no shortcut disappeared** (only intentionally deleted theme files + dead `Header.tsx`, listed explicitly). Fix anything that regressed.

### Features that must stay reachable (checklist — tick each one at the end)
Dashboard · Projects list (create / join with key / leave / delete / pending join requests) · Project Overview (KPIs, charts) · Tasks in all 5 views (Structure tree with folders/drag-reorder/rename/move, Board with drag-drop + per-column quick add, Timeline/Calendar, List, Dependencies graph) · New task / new folder · Import CSV/JSON · Export encrypted dump (`.teaderdumpfile`) · Task detail (status, priority, due, assignee, project, created-date edit, markdown description, @-tag related tasks, subtasks, images, comments, stacked task overlay) · Docs (folders, reorder, markdown, tabs) · Charts/diagram canvases · Meeting (LiveKit, mic mute, PiP mini-screen across tabs, header LIVE widget, noise suppression) · Chats + Chat drawer + `/conversations` page · Apps (YouTube/proxy) · History/audit log · Plugins / GitHub repos + repo detail + diff viewer · Project Settings (general, access key, join requests, members, permissions, leave, delete/danger zone) · My Work · Initiatives · Documentation page · Landing, Login, Register · Command palette (⌘K, operators `status:` `priority:` `label:`) · Keyboard shortcuts modal + `?` / `C` / `Esc` shortcuts · Account modal + avatar picker · RealtimeBadge/SSE/WebSocket · Desktop update modal + version/build indicator · UI scale (accessibility) · Default launch tab setting · Clear local cache.

### Routing compatibility
All existing URLs and aliases must still resolve: `/projects/[id]`, `/projects/[id]/[view]` with every alias handled by `parseViewTab` (meeting/call/huddle…, chats/discuss…, apps/tools…, charts/diagram/canvas…, overview/analytics…, docs/wiki…, history/audit…, plugins/addons…, settings/config…, tasks/board/kanban/list/tree/timeline/graph/dag…), `?mode=`, `?task=`, `/task/[id]`, `/task/[id]/details`, `/issue/[id]`. **Keep the `ProjectTab` and `TaskViewMode` unions and state logic unchanged** — only the navigation chrome changes (section 5.3).

---

## 3. DESIGN PRINCIPLES (Linear-like)

1. **Whitespace over boxes.** Group with spacing and a single hairline divider, not nested bordered pills. Max one border level per surface.
2. **One primary action per screen**, solid white button. Everything else is ghost/text.
3. **Progressive disclosure.** Secondary actions live in a `⋯` menu or appear on hover (row actions, drag handles, delete). Optional metadata renders only when present.
4. **Quiet typography.** Sentence case labels. No `uppercase tracking-wider` section labels, no `font-mono` except for task keys/IDs, code, timestamps-in-code contexts. Minimum text size **12px**; body 13–14px; page titles 20–24px/600.
5. **4-px spacing grid**; page padding 24–32px; section gaps 24–32px; card padding 16px; list rows 36–40px tall; modal padding 24px; `max-w-5xl`-style centered content for text-heavy pages (Overview, Settings, Docs list, issue detail).
6. **Motion**: 100–150ms opacity/background transitions only. Remove glows (`shadow-[0_0_8px_var(--accent-yellow)]`), `animate-pulse`/`animate-ping` decorations (keep ONE subtle live indicator for meetings/realtime), gradients, `drop-shadow` colored glows.
7. **Emoji in labels** (e.g. `📁` prefixes, ~38 occurrences) → replace with lucide icons.
8. **Friendly copy**: plain verbs, no jargon ("Executive Dashboard" → "Home", "Global Task Status Spectrum" → "Tasks by status", "Cross-Project Task Feed" → "Recent tasks", "Project Workspace Splash" copy shortened). Do not change feature behavior or API names.

---

## 4. PHASE 1 — MONOCHROME FOUNDATION + REMOVE THEME SWITCHING

### 4.1 New token set (single source of truth in `app/globals.css`)
Pure black/white with neutral grays for hierarchy — **R = G = B for every color in the app** (no tinted grays, no blue-grays like `#9CA3AF`/`#CFD4DD`/`#787C83`).

Replace the `:root` block with (adjust only if contrast fails WCAG AA):

```css
:root {
  /* surfaces */
  --bg-canvas:#000000; --bg-main:#000000; --bg-sidebar:#000000; --bg-header:#000000;
  --bg-panel:#0A0A0A; --bg-card:#0A0A0A; --bg-card-subtle:#050505;
  --bg-input:#0A0A0A; --bg-dropdown:#0F0F0F; --bg-tooltip:#171717;
  --bg-hover:#141414; --bg-hover-subtle:#0F0F0F; --bg-active:#1F1F1F;
  --bg-overlay:rgba(0,0,0,.72);
  /* borders */
  --border-subtle:#141414; --border-primary:#1F1F1F; --border-secondary:#2E2E2E;
  --border-input:#2E2E2E; --border-input-focus:#FFFFFF;
  --border-accent:#2E2E2E; --border-accent-strong:#FFFFFF;
  /* text */
  --text-white:#FFFFFF; --text-primary:#EDEDED; --text-secondary:#A3A3A3;
  --text-muted:#737373; --text-disabled:#525252; --text-accent:#FFFFFF; --text-inverse:#000000;
  /* accent = white (primary button: white bg, black text) */
  --accent:#FFFFFF; --accent-hover:#E5E5E5; --accent-subtle:rgba(255,255,255,.08);
  --accent-muted:rgba(255,255,255,.16); --accent-glow:transparent;
  /* grayscale data ramp for charts / avatars (light→dark) */
  --ramp-1:#FFFFFF; --ramp-2:#D4D4D4; --ramp-3:#A3A3A3; --ramp-4:#737373; --ramp-5:#525252; --ramp-6:#2E2E2E;
}
```

Also in `@theme`: add `--color-accent: var(--accent)` etc.

**Legacy alias layer (temporary, to keep the build green while migrating):** keep the old variable names (`--accent-yellow*`, `--status-*`, `--priority-*`, `--success*`, `--danger*`, `--warning*`, `--info*`, `--cyan`, `--purple`, `--brown*`, `--beige`, `--gray-*`) defined as aliases pointing at the mono values above (e.g. `--accent-yellow: var(--accent)`, `--status-done: var(--text-white)`, `--danger: var(--text-white)`, `--cyan: var(--text-secondary)` …). Mark the block `/* LEGACY ALIASES — delete in Phase 6 */`.

Update: `body` background/color, scrollbar thumb hover (`var(--text-white)`), `.graph-scrollbar`, `.panel-card`, `letterFadeHighlight` keyframes (replace the `rgba(220,176,1,…)` with `rgba(255,255,255,…)` and drop the text-shadow glow), `color-scheme: dark`.

### 4.2 Delete theme switching (and migrate existing users)
- Delete: `lib/theme-manager.ts`, `components/ThemeColorSettings.tsx`, `components/ThemeInitializer.tsx`, `tests/theme.test.ts`. Remove the `ThemeInitializer` import + element from `app/layout.tsx`.
- **Add a one-time cleanup** (small client component `components/LegacyThemeCleanup.tsx`, mounted in `app/layout.tsx` where `ThemeInitializer` was): on mount, `localStorage.removeItem('teader_custom_theme_vars')`, `localStorage.removeItem('teader_active_preset_id')`, `localStorage.removeItem('teader_ui_density')`, and remove any inline CSS custom properties previously written to `document.documentElement.style` **except** `zoom`, `--ui-scale`, `--ui-scale-percent` (these belong to UI scale). Guard with try/catch. Also keep it tolerant of a cross-tab `storage` event on the removed keys (ignore).
- Replace `tests/theme.test.ts` with a small test that asserts the removed storage keys are cleaned up by `LegacyThemeCleanup` logic (extract the logic into a pure function in `lib/legacy-cleanup.ts` so it is unit-testable).
- `app/layout.tsx`: `viewport.themeColor` → `"#000000"`; keep `colorScheme: "dark"`. `app/manifest.ts`: `theme_color` / `background_color` → `#000000`. `app/opengraph-image.tsx` + `twitter-image.tsx`: black bg / white text, no yellow.

### 4.3 Settings modal simplification (`components/SettingsModal.tsx`)
Reduce 6 tabs to 3 — **General**, **Account**, **Shortcuts** — and remove: the `theme` tab, the `appearance`/SunMoon tab name, `ThemeColorSettings` (in both places), and "Display Density" (verified dead; re-grep `teader_ui_density` and `density` first).
- **General** keeps: Default Launch Tab (Dashboard / Projects), **Interface size** (keep `applyUIScale` + `UIScaleInitializer` and its storage key; replace the 6 preset buttons + slider with one compact row: slider + "Reset"), "Clear local cache" (moved from Performance), and a small read-only "About" row (client = Desktop/Web, desktop version, build number). Drop the static "0ms Instant Feedback Active" string.
- Account and Shortcuts content stays as is (restyled).

---

## 5. PHASE 2 — COLOR MIGRATION (hex & Tailwind palettes → tokens)

Do this as a **scripted codemod + manual review**, not by hand.

### 5.1 Codemod `scripts/mono-codemod.ts` (run with `tsx`)
For `app/**`, `components/**`, `lib/**` (`*.ts`, `*.tsx`, `*.css`), replace hardcoded colors with token classes/vars. Suggested mapping (extend as you find more; every unmapped hex must be reported, never silently skipped):

| Old (examples) | New |
|---|---|
| `#000 #0A0B0D #0B0C0E #0F1011 #101113 #121316 #131415 #141517` | `var(--bg-main)` / `bg-bg-main` |
| `#14161F #16171A #17181A #181A1F #1A1B1D #1B1C1F` | `var(--bg-panel)` / `--bg-card` |
| `#222427 #222428 #242634 #2A2C30(as bg)` | `var(--bg-hover)` / `--bg-active` |
| `#2A2C30 #2B2D38 #202226 (as border)` | `var(--border-primary)` / `--border-subtle` |
| `#3B3D41` | `var(--border-secondary)` |
| `#FFFFFF white` | `var(--text-white)` |
| `#CFD4DD #F5F5F7 #B7BBC5 #B6BBC4 #DCE0E5` | `var(--text-primary)` |
| `#9CA3AF #9499A0 #8E939D #7D8492 #7D8188` | `var(--text-secondary)` |
| `#787C83 #6B7280 #64748B` | `var(--text-muted)` |
| **All accents** `#DCB001 #E5B802 #FDE047 #AE8D05 #F59E0B #FBBF24` and their `/10 /15 /20 /30 /40` opacity forms | `var(--accent)` (white) / `--accent-subtle` / `--accent-muted`; text on accent fill → `var(--text-inverse)` |
| **All status/semantic hues** (greens `#22C55E`, reds `#EF4444 #C0393B #A32D2F`, oranges `#F97316`, blues `#3B82F6 #38BDF8`, purples `#A855F7`, cyan `#0391A1`) | grayscale token chosen by role — **meaning must move to shape/text/icon, see 5.2** |
| Tailwind `text-red-400`, `bg-emerald-500/15`, `border-purple-500/30` … | same mapping via tokens |
| `bg-gradient-to-*` with colors, `drop-shadow-[…rgba(220,176,1…)]`, `shadow-[0_0_…accent]` | remove; use flat bg |

Rules: preserve opacity modifiers where they map to a token (`bg-[#DCB001]/15` → `bg-[var(--accent-subtle)]`). Don't touch `node_modules`, `.next`, binary files, or `public/releases`. Open files as UTF-8 (some files, e.g. `SettingsModal.tsx`, contain non-ASCII box-drawing comments — use Python/Node UTF-8 IO, not `cut`/`sed` on bytes).

### 5.2 Meaning without color (critical — users must still read state at a glance)
Create `components/ui/StatusIcon.tsx` and `components/ui/PriorityIcon.tsx` (inline SVG, `currentColor`, 14–16px) and rewire `StatusBadge` / `PriorityBadge` **without changing their exported names, props, or `STATUS_CONFIG`/`PRIORITY_CONFIG` keys** (they're consumed by `IssueDetailView` and `TreeView`; grep every `.color` / `.bg` consumer and update them).

Status (Linear-style shapes, all white/gray):
- `todo` → empty circle (thin ring)
- `in_progress` → half-filled circle
- `needs_review` → three-quarter filled circle
- `done` → filled circle with check (inverse)
- `blocked` → ring with a horizontal bar/slash
- `cancelled` → ring with ×, text-muted + line-through on titles where it is shown today
- `merged` → filled circle with merge glyph

Priority (Linear-style):
- `none` → three dashes (text-disabled), `low` → 1 of 3 bars, `medium` → 2 bars, `high` → 3 bars, `critical` → solid white rounded square with `!` (inverse).

Other color-coded states:
- **Danger actions** (delete project, leave, remove member): no red. Use a ghost button labelled clearly, and require the existing confirm modal. Section titles "Danger zone" / "Leave workspace" keep their text; add a `TriangleAlert` icon and a stronger 1px `--border-secondary` outline.
- **Live meeting / realtime**: white dot (one soft pulse) + the word "Live"; muted dot + "Offline" when disconnected (`RealtimeBadge`).
- **Success/error toasts** (`sonner` `<Toaster>` in `app/layout.tsx`): style monochrome (black card, white text, hairline border); keep icons (check / x) for meaning.
- **Diff viewer**: `+` / `−` glyphs, add-lines on `rgba(255,255,255,.06)` with a 2px white left bar, delete-lines on `rgba(255,255,255,.02)` with a dashed left bar and `text-secondary`.
- **Charts** (`AnalyticsView`, `ProjectOverviewView` donut, `ProjectChartsView` canvas chrome, KPI cards): use `--ramp-*` shades + SVG `<pattern>` hatching / dash arrays for series separation, and **direct labels or a legend with the same patterns**. User-authored diagram node/edge colors stored in the DB must keep loading: map any stored color to the nearest ramp shade at render time — **no DB migration, no data loss**.
- **Syntax highlighting / Markdown** (`CodeBlock.tsx`, `MarkdownRenderer.tsx`): grayscale ramp + font-weight/italic differences; links = white + underline.
- **GitHub views**: language dots/labels → grayscale ramp; keep all data.
- **Avatars** (`components/ui/Avatar.tsx`, `lib/avatar.ts`, `ProfileAvatarPickerModal`): uploaded images stay as they are (user content); generated/initial fallbacks use ramp shades (white bg + black initials for primary user). Update `tests/avatar.test.ts` accordingly if it asserts color values.
- **Splash / loading / auth-check screens** (`WorkspaceSplashScreen`, `app/loading.tsx`, AppLayout auth-check wordmark): white wordmark on black, no gradient/glow.
- **External embeds** (YouTube in `ProjectAppsView`, uploaded images): unchanged — user/third-party content.

### 5.3 Mono guard test (prevents regressions)
Add `tests/mono-guard.test.ts` (vitest) that scans `app/**`, `components/**`, `lib/**` source and **fails** if it finds:
- any hex color whose channels are not equal (`#RGB`/`#RRGGBB`/`rgba(...)` with R≠G or G≠B), except in an explicit allow-list file `tests/mono-allowlist.json` (must contain only: third-party embed code, emoji-free brand SVG data, user-content fallbacks — each entry with a reason);
- Tailwind palette classes `(bg|text|border|ring|from|to|via|fill|stroke|shadow|divide|outline)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}`;
- the strings `accent-yellow`, `theme-manager`, `ThemeColorSettings`, `ThemeInitializer` (after Phase 6).

---

## 6. PHASE 3 — INFORMATION ARCHITECTURE (nothing removed, everything reachable)

### 6.1 App shell: left sidebar instead of the top tab pill bar
Rebuild `components/Sidebar.tsx` (currently dead code, reuse it) and use it from `AppLayout.tsx`; shrink the top header to a thin 48px bar with breadcrumb on the left and **Search (⌘K)** + avatar menu on the right.

Sidebar (240px, collapsible to 56px with persisted state, mobile = slide-over drawer — keep the existing mobile behavior working):
- Top: "Teader" wordmark/workspace name (no dropdown chevron unless it does something).
- **Home** (`/dashboard`), **My work** (`/my-work`), **Initiatives** (`/initiatives`), **Conversations** (`/conversations`).
- Section "Projects": list of the user's projects (from the same data `AppLayout` already loads); each links to `/projects/[id]`; a `+` to create (opens the existing create flow on `/projects`); "All projects" → `/projects`.
- Bottom: Settings (opens `SettingsModal`), Help/Shortcuts (opens `KeyboardShortcutsModal`), user row (avatar + name → opens Account modal; logout inside the avatar menu). **Account must be reachable from exactly one obvious place** (the user row), remove the duplicate Account tab.
- Keep: the live-meeting widget (move into the sidebar footer or the thin header; same actions: open, mute, leave), `DesktopVersionIndicator` build display bottom-right (required by INSTRUCTIONS.md), `DesktopUpdateModal`.

### 6.2 Project header (one calm row)
`[← Projects] / Project name   KEY ⧉     …spacer…   [avatars]  [Chat] [Call]  [⋯]`
- `⋯` menu contains: Edit details (creator), Import tasks, Export project, Copy project key, Leave project (non-creator), Delete project (creator, existing confirm modal). Permissions unchanged.
- Remove the bordered creator pill (move "Created by X" into Overview/Settings → General) and shrink RealtimeBadge to a small dot with tooltip (full badge stays in the component).
- Fix the hardcoded fallback `project?.ownerName || 'karri'` → show nothing/“Unknown” instead (it's a leaked dev name); also review hardcoded assignee options `'karri'`, `'jori'` in `NewIssueModal.tsx` — do NOT change behavior, only flag them in the final report.

### 6.3 Project navigation: 4 primary tabs, nothing deleted
Keep the `ProjectTab` union and `handleTabSwitch` exactly as they are. Add a pure mapping (new file `lib/project-nav.ts`, with unit tests) from tab id → group:

| Primary tab (underline style, text + small icon) | Contains (secondary pill row shown only if >1) |
|---|---|
| **Overview** | Summary (`overview`) · Activity (`history`) |
| **Tasks** (shows count) | the task view control (6.4) |
| **Docs** | Documents (`docs`) · Diagrams (`charts`) |
| **Settings** | General (`settings`) · Integrations: Apps (`apps`) + Plugins/GitHub (`plugins`) |

- `chats` → opened by the header **Chat** button (existing `ConversationDrawer`), with an "Expand" action in the drawer that does `handleTabSwitch('chats')` so the full conversation view stays reachable.
- `meeting` → header **Call** button does `handleTabSwitch('meeting')` (shows "Live" dot when `isInMeeting`). The persistent PiP/mini meeting logic and the `isMini` behavior are untouched.
- When the URL resolves to any tab (e.g. `/projects/3/history`), highlight the right primary tab and secondary pill. All existing deep links keep working.
- Verify `ProjectOverviewView` `onNavigate`-style callbacks (`handleTabSwitch(tab, mode)` at ~line 2058) still work with the new chrome.

### 6.4 Tasks toolbar
Replace the 5-button segmented switcher with **one "View" dropdown button** (icon + current view name, e.g. `⊞ Board ▾`) listing Structure, Board, Timeline, List, Dependencies (same `handleTaskModeSwitch`). Next to it: search, a single **Filter** popover (status, priority, folder/epic, assignee — reuse what Board/List already filter by, don't invent new backend), and one solid white **+ New task** button. New folder stays in the Structure view menu. Timeline view toolbar gets "Export .ics" (`/api/projects/[id]/calendar.ics`). Remove the redundant "N tasks" mono label (count lives in the tab).

### 6.5 Views (restyle + declutter, same data & actions)
- **List** (`CompactListView`): 40px rows; columns Key (mono, text-muted) · Title · Status icon · Priority icon · Assignee avatar · Updated; header row 12px sentence-case text-muted, no uppercase; drag handle, delete and quick actions appear **on hover**; no per-row border boxes, just a hairline between rows.
- **Board** (`KanbanBoardView`): column header = status icon + name + count (no uppercase, no bordered count chip); cards 12–16px padding with: key (muted mono) + title (2 lines) + a single meta line (priority icon, assignee avatar, due date). Folder/epic pill and labels render only if present, as muted text — not bordered pills. Drag handle & delete on hover. Keep drop indicators (white 2px line, no glow).
- **Structure** (`TreeView`, 1500 lines): keep all behavior (folders, rename, move, reorder, add); 36px rows, indent guides in `--border-subtle`, hover actions.
- **Timeline** (`CalendarView`) and **Dependencies** (`DependencyGraphView`): monochrome nodes (white outline; done = filled), edges in gray, status via the new `StatusIcon`.
- **Issue detail** (`IssueDetailView`): Linear-style two columns — title (24px) + description on the left; **Properties** on the right (Status, Priority, Assignee, Due date, Project, Created) as borderless rows (label left, value button right). "Tagged & related tasks", subtasks, images, comments become **collapsible sections** (collapsed state remembered per session) — all content and actions still present. The blocked banner becomes a neutral bordered bar with a `ShieldAlert` icon.
- **NewIssueModal**: it already has `formView` basic/advanced. Make **basic the default**: Title, Description, and a single row of property chips (Status, Priority, Assignee, Due date, Folder). Move Labels, tagging, extra options under a "More options" disclosure (same fields, same payload). Folder mode keeps its fields. Footer: ghost "Cancel" + solid white "Create task" (keep ⌘/Ctrl+Enter if it exists).
- **Overview** (`ProjectOverviewView`): 4 KPI numbers in one quiet row (no boxed cards), then sections with sentence-case `text-sm font-medium` headings and generous gaps; charts monochrome.
- **Project Settings** (`ProjectSettingsView`): single column, `max-w-3xl`, sections separated by whitespace + hairline: General · Access key · Join requests · Members & permissions · Danger zone.
- **Dashboard / Projects / My Work / Initiatives / Conversations / Documentation / Landing / Login / Register**: same token + spacing rules; rename headings per principle 8; no functional change.

### 6.6 Command palette = the safety net for hidden navigation
Rewrite its command list so **every destination is reachable by typing**: Create task (C), Go to Home / My work / Initiatives / Conversations / Projects, and for the current project: Overview, Activity, Tasks (+ each of the 5 views), Docs, Diagrams, Chat, Call, Apps, Plugins, Settings. Remove stale "Developer Workstation Stream" / "Hierarchical View" **only if** they are non-functional (check what they do; if they map to a real view, rename and keep). Keep the `status:` `priority:` `label:` operators. Update `KeyboardShortcutsModal` text to match.

### 6.7 Orphaned features to surface (don't delete)
- `AutomationsModal` + `/api/automations`: add an **Automations** entry under Project Settings → General (or Integrations) that opens the modal. If the modal's props/API are incomplete, wire it minimally and tell me what is missing instead of removing it.
- `/api/projects/[id]/calendar.ics`: link from the Timeline toolbar (6.4).

---

## 7. PHASE 4 — TYPOGRAPHY & SPACING SWEEP

After colors and structure are done:
- Replace `text-[8px|9px|10px|11px]` with `text-xs` (12px) minimum; headings per scale in section 3.
- Remove `uppercase tracking-wider font-mono` label pattern (sentence case, `text-xs text-[var(--text-muted)]`); keep `font-mono` only on task keys, code, shortcuts, hashes.
- Normalize radii: inputs/buttons `rounded-md` (6px), cards/modals `rounded-lg` (8px); remove `rounded-2xl/3xl` unless it's an avatar/pill.
- Normalize buttons into 3 variants in a small `components/ui/Button.tsx` (primary = white bg/black text, secondary = bordered ghost, ghost) and use them in the files you touch. Focus ring: 1px white outline.
- Fonts: `app/layout.tsx` loads Inter, Geist, Geist Mono, Space Grotesk, Sora. Use **Inter for UI, Geist Mono for mono**; Space Grotesk/Sora only if the landing page genuinely needs them — otherwise stop loading unused fonts (check `font-landing`, `font-prompt`, `font-sora` usage first).

---

## 8. PHASE 5/6 — CLEANUP & VERIFICATION

1. Delete the **LEGACY ALIASES** block; fix any leftover references; ensure `grep -rn "accent-yellow\|DCB001\|theme-manager\|ThemeColorSettings\|ThemeInitializer" app components lib tests` returns nothing (except historical docs like `UVC.md`/`dev.md`, which you must not edit).
2. Delete `components/Header.tsx` only if still imported nowhere.
3. Update `README.md` screenshots/text only where it mentions themes/colors; don't touch `UVC.md` / `dev.md`.
4. Run, and fix until green: `npm run lint`, `npm test` (vitest — `mono-guard`, `project-nav`, legacy-cleanup tests included), `npm run build`.
5. If a Postgres DB is available (INSTRUCTIONS.md: port 5678, db `teader_db`), start `npm run dev` and use Playwright (`@playwright/test` is already a devDependency) to visit: `/login`, `/dashboard`, `/projects`, `/projects/<id>` for every tab/alias, all 5 task views, a task detail, New task modal, Settings modal, Command palette, `/my-work`, `/initiatives`, `/conversations`, `/documentation`, landing. **Assertion**: for every element on those pages, computed `color`, `background-color`, `border-color`, `fill`, `stroke` have R=G=B (ignoring uploaded images, YouTube iframes). Save screenshots to `docs/screenshots-mono/`. If no DB is available, say so explicitly and rely on the static guard + build.
6. Re-generate `docs/FEATURE-BASELINE.md` and diff against Phase 0. Tick every item in the section 2 checklist. Report anything that could not be verified.

---

## 9. REPO WORKFLOW RULES (from `INSTRUCTIONS.md` — mandatory)

- **Granular local commits, grouped by layer**, conventional messages, e.g.:
  1. `chore(baseline): add feature baseline snapshot`
  2. `feat(theme): monochrome tokens + legacy alias layer`
  3. `refactor(theme): remove theme manager, color settings and initializer`
  4. `feat(settings): simplify settings modal to General/Account/Shortcuts`
  5. `refactor(ui): codemod hardcoded colors to tokens` (can be split per folder)
  6. `feat(ui): shape-based status & priority icons`
  7. `feat(nav): left sidebar app shell`
  8. `feat(project): header menu + 4-tab project navigation`
  9. `feat(tasks): view dropdown, filter popover, list/board/structure restyle`
  10. `feat(issue): linear-style issue detail and basic-first new task modal`
  11. `feat(cmdk): complete command palette navigation`
  12. `refactor(ui): typography/spacing sweep`
  13. `chore(theme): remove legacy aliases`
  14. `test: mono guard, project-nav, legacy-cleanup`
- **Do NOT push after each commit.** Make all commits locally first, then **one** `git push origin main`. Production deploys only from the `production` branch — do not touch it.
- Before pushing: update `BUILD_NUMBER` in `lib/build-info.ts` to the exact current time, format `B<A|P>-<DDMMYYYY>-<HHMM>` (12-hour clock; `BA` = AM, `BP` = PM), e.g. `BP-12102026-0415`. The build number (not the version) stays displayed bottom-right via `components/DesktopVersionIndicator.tsx` in `app/layout.tsx`.
- Run tests and `npm run build` before committing (INSTRUCTIONS.md §3). Keep `lib/db.ts` error logging intact. No DB schema changes are expected for this task; if you think one is needed, stop and ask.

---

## 10. OUTPUT EXPECTED FROM YOU

Work phase by phase; after each phase run lint/test/build and summarize briefly. At the very end print:
1. A table: **old tab/option → new location** (every one of the 10 project tabs, 5 task views, 6 settings tabs, app header items).
2. The ticked feature checklist (section 2) with any item you could not verify.
3. Files deleted (should be only: `theme-manager.ts`, `ThemeColorSettings.tsx`, `ThemeInitializer.tsx`, `tests/theme.test.ts` replaced, optionally `Header.tsx`).
4. Open questions / things you noticed but did not change (e.g. hardcoded `karri`/`jori`, unfinished Automations wiring, stale palette commands).

**If anything in this prompt conflicts with "do not remove any feature", the feature wins — keep it, restyle it, and tell me.**