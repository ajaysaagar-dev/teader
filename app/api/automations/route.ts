import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { AutomationRule } from '@/lib/types';

// In-memory default automation rules store per project
let automationsStore: AutomationRule[] = [
  {
    id: 'auto_1',
    name: 'Auto-complete subtasks when task is Done',
    trigger: 'status_changed',
    conditionField: 'status',
    conditionValue: 'done',
    action: 'complete_subtasks',
    enabled: true,
  },
  {
    id: 'auto_2',
    name: 'Auto-move to Needs Review when all subtasks completed',
    trigger: 'subtasks_completed',
    action: 'change_status',
    actionValue: 'needs_review',
    enabled: true,
  },
  {
    id: 'auto_3',
    name: 'Escalate to High priority for bug reports',
    trigger: 'issue_created',
    conditionField: 'label',
    conditionValue: 'bug',
    action: 'set_priority',
    actionValue: 'high',
    enabled: true,
  },
  {
    id: 'auto_4',
    name: 'Auto-assign Critical tasks to Project Lead',
    trigger: 'priority_changed',
    conditionField: 'priority',
    conditionValue: 'critical',
    action: 'assign_user',
    actionValue: 'karri',
    enabled: false,
  },
];

export async function GET(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(automationsStore);
}

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const newRule: AutomationRule = {
      id: `auto_${Date.now()}`,
      name: body.name || 'Custom Automation Rule',
      trigger: body.trigger || 'status_changed',
      conditionField: body.conditionField,
      conditionValue: body.conditionValue,
      action: body.action || 'complete_subtasks',
      actionValue: body.actionValue,
      enabled: body.enabled ?? true,
      projectId: body.projectId,
    };

    automationsStore.push(newRule);
    return NextResponse.json(newRule, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, enabled } = body;

    automationsStore = automationsStore.map((rule) =>
      rule.id === id ? { ...rule, enabled: Boolean(enabled) } : rule
    );

    return NextResponse.json({ success: true, id, enabled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
