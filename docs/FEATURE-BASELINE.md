# TEADER ? Feature Baseline Snapshot (Phase 0)

Generated on: 2026-10-12T07:33:50.863Z

## 1. Page Routes (`app/**/page.tsx`)

- `app/conversations/page.tsx`
- `app/dashboard/page.tsx`
- `app/documentation/page.tsx`
- `app/initiatives/page.tsx`
- `app/issue/[id]/page.tsx`
- `app/login/page.tsx`
- `app/my-work/page.tsx`
- `app/page.tsx`
- `app/projects/[id]/[view]/page.tsx`
- `app/projects/[id]/page.tsx`
- `app/projects/page.tsx`
- `app/register/page.tsx`
- `app/task/[id]/details/page.tsx`
- `app/task/[id]/page.tsx`

## 2. API Routes (`app/api/**/route.ts`)

- `app/api/apps/proxy/route.ts`
- `app/api/apps/youtube/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/automations/route.ts`
- `app/api/conversations/channels/route.ts`
- `app/api/conversations/route.ts`
- `app/api/github/repo/route.ts`
- `app/api/github/repos/route.ts`
- `app/api/github/user/route.ts`
- `app/api/issues/[id]/route.ts`
- `app/api/issues/reorder/route.ts`
- `app/api/issues/route.ts`
- `app/api/livekit-token/route.ts`
- `app/api/projects/[id]/calendar.ics/route.ts`
- `app/api/projects/[id]/charts/[chartId]/route.ts`
- `app/api/projects/[id]/charts/route.ts`
- `app/api/projects/[id]/docs/[docId]/route.ts`
- `app/api/projects/[id]/docs/folders/route.ts`
- `app/api/projects/[id]/docs/reorder/route.ts`
- `app/api/projects/[id]/docs/route.ts`
- `app/api/projects/[id]/export/route.ts`
- `app/api/projects/[id]/history/route.ts`
- `app/api/projects/[id]/join-requests/route.ts`
- `app/api/projects/[id]/leave/route.ts`
- `app/api/projects/[id]/meeting/route.ts`
- `app/api/projects/[id]/meeting/signal/route.ts`
- `app/api/projects/[id]/members/route.ts`
- `app/api/projects/[id]/permissions/route.ts`
- `app/api/projects/[id]/repositories/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/join/route.ts`
- `app/api/projects/route.ts`
- `app/api/realtime/stream/route.ts`
- `app/api/subtasks/route.ts`
- `app/api/upload/route.ts`

## 3. Components & Usage (`components/**`)

### `components/AnalyticsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/AppLayout.tsx`
- Imported by: `app/conversations/page.tsx`
- Imported by: `app/dashboard/page.tsx`
- Imported by: `app/initiatives/page.tsx`
- Imported by: `app/my-work/page.tsx`
- Imported by: `app/projects/page.tsx`
- Imported by: `app/projects/[id]/page.tsx`
- Imported by: `app/task/[id]/details/page.tsx`

### `components/AutomationsModal.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/CalendarView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/CommandPalette.tsx`
- Imported by: `components/AppLayout.tsx`

### `components/CompactListView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ConsoleBranding.tsx`
- Imported by: `app/layout.tsx`

### `components/ConversationDrawer.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/DependencyGraphView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/DesktopUpdateModal.tsx`
- Imported by: `app/layout.tsx`

### `components/DesktopVersionIndicator.tsx`
- Imported by: `app/layout.tsx`

### `components/DiffViewerModal.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ErrorBoundary.tsx`
- Imported by: `app/projects/[id]/page.tsx`

### `components/Header.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/HierarchicalView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ImportTasksModal.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/IssueDetailView.tsx`
- Imported by: `app/task/[id]/details/page.tsx`

### `components/KanbanBoardView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/KeyboardShortcutsModal.tsx`
- Imported by: `components/AppLayout.tsx`

### `components/LandingPageClient.tsx`
- Imported by: `app/page.tsx`

### `components/NewIssueModal.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProfileAvatarPickerModal.tsx`
- Imported by: `components/AppLayout.tsx`

### `components/ProjectAppsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectChartsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectConversationView.tsx`
- Imported by: `components/ConversationDrawer.tsx`

### `components/ProjectDocsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectGithubRepoDetailView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectGithubView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectHistoryView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectMeetingView.tsx`
- Imported by: `tests/meeting.test.ts`

### `components/ProjectOverviewView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectPluginsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ProjectSettingsView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/RealtimeBadge.tsx`
- Imported by: `app/dashboard/page.tsx`
- Imported by: `app/my-work/page.tsx`
- Imported by: `app/projects/[id]/page.tsx`
- Imported by: `app/task/[id]/details/page.tsx`
- Imported by: `components/ProjectDocsView.tsx`

### `components/SettingsModal.tsx`
- Imported by: `components/AppLayout.tsx`

### `components/Sidebar.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ThemeColorSettings.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ThemeInitializer.tsx`
- Imported by: `app/layout.tsx`

### `components/TimelineView.tsx`
- Imported by: `app/initiatives/page.tsx`

### `components/TreeView.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/UIScaleInitializer.tsx`
- Imported by: `app/layout.tsx`

### `components/WorkspaceSplashScreen.tsx`
- Imported by: `app/projects/[id]/page.tsx`

### `components/ui/Avatar.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/CodeBlock.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/CustomDropdown.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/MarkdownRenderer.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/PriorityBadge.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/ProjectContextMenu.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/RandomLoadingText.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/Skeleton.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/StatusBadge.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/TaskContextMenu.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/TaskMentionPopover.tsx`
*Not imported directly (or dynamic/standalone)*

### `components/ui/TeaderSandCanvas.tsx`
*Not imported directly (or dynamic/standalone)*

## 4. Project Navigation & Task View Modes

### Primary `ProjectTab` Values & Aliases (`parseViewTab`)
- `overview`: `overview`, `analytics`, `insights`, `stats`
- `tasks`: `tasks`, `board`, `kanban`, `list`, `compact-list`, `tree`, `structure`, `calendar`, `schedule`, `timeline`, `graph`, `dependencies`, `dag`
- `docs`: `docs`, `wiki`, `spec`
- `charts`: `charts`, `diagram`, `diagrams`, `canvas`, `flow`, `whiteboard`
- `meeting`: `meeting`, `call`, `audio`, `voice`, `conference`, `huddle`
- `chats`: `chats`, `chat`, `conversation`, `conversations`, `messages`, `discuss`
- `apps`: `apps`, `app`, `tools`, `integrations`, `store`, `widgets`
- `history`: `history`, `audit`, `log`, `changelog`
- `plugins`: `plugins`, `plugin`, `addons`, `extensions`
- `settings`: `settings`, `config`, `preferences`

### `TaskViewMode` Values & Aliases (`parseTaskMode`)
- `structure`: `tree`, `structure`, `hierarchy` (Default)
- `board`: `board`, `kanban`
- `timeline`: `timeline`, `calendar`, `schedule`
- `list`: `list`, `compact-list`
- `dependencies`: `dependencies`, `graph`, `dag`

## 5. Keyboard Shortcuts (`AppLayout.tsx` & `KeyboardShortcutsModal.tsx`)

- `?K` / `Ctrl+K`: Open Command Palette
- `C`: Create New Task (when not focused in input/textarea)
- `?`: Open Keyboard Shortcuts Modal
- `Esc`: Close Modals / Overlays
- `?/Ctrl+Enter`: Submit Form / Create Task (where supported in modal/inputs)

## 6. LocalStorage Keys in Use

- `dashboard_issues`
- `dashboard_projects`
- `projects_list`
- `teader_accent_color`
- `teader_github_token`
- `teader_remember`
- `teader_token`
- `teader_ui_density`
- `teader_user`
