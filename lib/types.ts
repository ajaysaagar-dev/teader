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
  estimatedHours?: number;
  loggedHours?: number;
  blockedBy?: string[];
  blocks?: string[];
  timeEntries?: TimeEntry[];
  customFields?: Record<string, string | number | boolean>;
  sprint?: string;
  epic?: string;
  team?: string;
  projectId?: number | string;
  project: string;
  isFavorite?: boolean;
  isPinned?: boolean;
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

