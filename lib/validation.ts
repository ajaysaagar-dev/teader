import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});


export const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ─── Issues ──────────────────────────────────────────────────────────────────

export const CreateIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'needs_review', 'done', 'blocked', 'cancelled', 'merged']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  assigneeName: z.string().max(128).optional(),
  reporterName: z.string().max(128).optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  epic: z.string().max(128).optional(),
  folderId: z.string().max(128).optional(),
  sprint: z.string().max(128).optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  loggedHours: z.number().optional(),
  blockedBy: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  project: z.string().optional(),
  projectId: z.number().int().positive().optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string().optional(),
        parentId: z.string().nullable().optional(),
        title: z.string().min(1).max(255),
        completed: z.boolean(),
        isFolder: z.boolean().optional(),
        type: z.enum(['folder', 'subtask']).optional(),
      })
    )
    .optional(),
});

export const UpdateIssueSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'needs_review', 'done', 'blocked', 'cancelled', 'merged']).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  epic: z.string().max(128).optional(),
  folderId: z.string().max(128).optional(),
  sprint: z.string().max(128).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  assigneeName: z.string().max(128).optional(),
  completedByName: z.string().max(128).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  loggedHours: z.number().optional(),
  blockedBy: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  orderIndex: z.number().optional(),
  createdAt: z.string().optional(),
  timeEntries: z
    .array(
      z.object({
        id: z.string(),
        userId: z.union([z.string(), z.number()]).optional(),
        userName: z.string().optional(),
        durationMinutes: z.number(),
        note: z.string().optional(),
        createdAt: z.string(),
      })
    )
    .optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Permissions & History ────────────────────────────────────────────────────

export const UpdateMemberPermissionsSchema = z.object({
  userId: z.union([z.number(), z.string()]),
  permissions: z.object({
    can_create_tasks: z.boolean().optional(),
    can_delete_tasks: z.boolean().optional(),
    can_create_docs: z.boolean().optional(),
    can_edit_docs: z.boolean().optional(),
    can_delete_docs: z.boolean().optional(),
    can_edit_history: z.boolean().optional(),
    can_delete_history: z.boolean().optional(),
    can_edit_dates: z.boolean().optional(),
    can_manage_members: z.boolean().optional(),
  }),
});

export const UpdateIssueDateSchema = z.object({
  createdAt: z.string().min(1, 'createdAt timestamp is required'),
});

export const UpdateHistoryEntrySchema = z.object({
  entryId: z.union([z.number(), z.string()]),
  details: z.record(z.string(), z.any()).optional(),
  createdAt: z.string().optional(),
  action: z.string().optional(),
  entityTitle: z.string().optional(),
});

export const ReorderIssuesSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  issueIds: z.array(z.string()).optional(),
  items: z.array(
    z.object({
      id: z.string(),
      orderIndex: z.number(),
      status: z.enum(['todo', 'in_progress', 'needs_review', 'done', 'blocked', 'cancelled', 'merged']).optional(),
    })
  ).optional(),
});


// ─── Projects ────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  key: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  owner_id: z.number().int().positive().optional(),
  ownerName: z.string().max(128).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
}).refine((d) => d.name !== undefined || d.description !== undefined, {
  message: 'At least one field must be provided',
});

// ─── Subtasks ────────────────────────────────────────────────────────────────

export const AddSubtaskSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  issueId: z.string().min(1, 'issueId is required'),
  title: z.string().min(1, 'Title is required').max(255),
  parentId: z.string().nullable().optional(),
  isFolder: z.boolean().optional(),
  type: z.enum(['folder', 'subtask']).optional(),
});

export const UpdateSubtaskSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  subId: z.string().min(1, 'subId is required'),
  title: z.string().min(1).max(255).optional(),
  completed: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  issueId: z.string().optional(),
}).refine((d) => {
  const { subId, ...rest } = d;
  return Object.keys(rest).length > 0;
}, { message: 'At least one field to update must be provided' });

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Parse and validate a request body. Returns { data } or { error: NextResponse } */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: { issues: z.ZodIssue[] } }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { data: null, error: { issues: [{ code: 'custom', message: 'Invalid JSON body', path: [] } as any] } };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { data: null, error: { issues: result.error.issues } };
  }
  return { data: result.data, error: null };
}
