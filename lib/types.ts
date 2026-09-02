export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export type Status = 
  | 'todo' 
  | 'in_progress' 
  | 'blocked' 
  | 'needs_review' 
  | 'done' 
  | 'cancelled'
  | 'merged';

export interface User {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  role?: string;
}

export interface Subtask {
  id: string;
  issueId?: string;
  parentId?: string | null;
  title: string;
  completed: boolean;
  isFolder?: boolean;
  type?: 'folder' | 'subtask';
  subtasks?: Subtask[];
  imageId?: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface ImageRecord {
  id: string;
  fileName: string;
  filePath: string;
  url: string;
  taskId?: string;
  subtaskId?: string;
  createdAt?: string;
}

export interface ProjectDoc {
  id: string;
  projectId: number | string;
  userId?: number | string;
  userName?: string;
  title: string;
  fileName: string;
  filePath?: string;
  folder?: string;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
}

export interface DocFolder {
  id?: number | string;
  name: string;
  orderIndex: number;
  createdAt?: string;
}

export interface TimelineEvent {

  id: string;
  type: 
    | 'status_change' 
    | 'comment' 
    | 'pr_linked' 
    | 'branch_pushed' 
    | 'commit' 
    | 'deployment';
  user: User;
  timestamp: string;
  content: string;
  metadata?: {
    fromStatus?: Status;
    toStatus?: Status;
    prUrl?: string;
    prTitle?: string;
    branch?: string;
    commitHash?: string;
    deployEnv?: string;
    deployStatus?: 'success' | 'failed' | 'in_progress';
    changedFiles?: string[];
  };
  reactions?: { emoji: string; count: number; users: string[] }[];
}

export interface CommentItem {
  id: string;
  user: User;
  timestamp: string;
  content: string;
  reactions: { emoji: string; count: number; users: string[] }[];
  replies?: CommentItem[];
}

export interface FileDiff {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  hunks: {
    header: string;
    lines: { type: 'add' | 'delete' | 'context'; content: string; oldLine?: number; newLine?: number }[];
  }[];
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  branch: string;
  targetBranch: string;
  status: 'open' | 'merged' | 'draft' | 'closed';
  author: User;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  diffs: FileDiff[];
  checks: { name: string; status: 'passed' | 'failed' | 'running' }[];
}

export interface TimeEntry {
  id: string;
  userId?: string | number;
  userName?: string;
  durationMinutes: number;
  note?: string;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  projectId?: number | string;
  name: string;
  trigger: 'status_changed' | 'issue_created' | 'priority_changed' | 'subtasks_completed';
  conditionField?: string;
  conditionValue?: string;
  action: 'complete_subtasks' | 'set_priority' | 'assign_user' | 'change_status' | 'notify_lead';
  actionValue?: string;
  enabled: boolean;
}

export interface Issue {
  id: string;
  key: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeName?: string;
  assigneeAvatar?: string;
  reporterName?: string;
  reporterAvatar?: string;
  assignee?: User;
  reporter?: User;
  labels: string[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  completedByName?: string;
  completedAt?: string;
  estimatedHours?: number;
  loggedHours?: number;
  blockedBy?: string[];
  blocks?: string[];
  timeEntries?: TimeEntry[];
  customFields?: Record<string, string | number | boolean>;
  sprint?: string;
  epic?: string;
  folderId?: string;
  team?: string;
  projectId?: number | string;
  project: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  orderIndex?: number;
  subtasks: Subtask[];
  images?: ImageRecord[];
  timeline?: TimelineEvent[];
  comments?: CommentItem[];
  pullRequest?: PullRequest;
  gitBranch?: string;
  gitCommitsCount?: number;
}

export interface Project {
  id: string | number;
  key: string;
  name: string;
  description: string;
  owner_id?: number;
  creatorId?: number;
  ownerName?: string;
  icon?: string;
  color?: string;
  issueCount?: number;
  completedCount?: number;
  lead?: User;
  automations?: AutomationRule[];
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
  shortcut?: string;
  category: 'main' | 'favorites' | 'recent' | 'workspace';
}

export interface MemberPermissions {
  can_create_tasks: boolean;
  can_delete_tasks: boolean;
  can_create_docs: boolean;
  can_edit_docs: boolean;
  can_delete_docs: boolean;
  can_edit_history: boolean;
  can_delete_history: boolean;
  can_edit_dates: boolean;
  can_manage_members: boolean;
  can_complete_tasks: boolean;
}

export interface MemberPermissionsWithUser extends MemberPermissions {
  userId: number;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  role?: string;
}

export interface HistoryEntry {
  id: number;
  projectId: number;
  projectKey: string;
  userId?: number;
  userName: string;
  userAvatar?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export const PERMISSION_LABELS: Record<keyof MemberPermissions, string> = {
  can_create_tasks: 'Create Tasks & Folders',
  can_delete_tasks: 'Delete Tasks & Folders',
  can_create_docs: 'Create Docs',
  can_edit_docs: 'Edit Docs',
  can_delete_docs: 'Delete Docs',
  can_edit_history: 'Edit History',
  can_delete_history: 'Delete History',
  can_edit_dates: 'Edit Created Dates',
  can_manage_members: 'Manage Members',
  can_complete_tasks: 'Move Tasks to Done / Complete',
};

