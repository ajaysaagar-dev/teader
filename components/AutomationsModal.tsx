'use client';

import React, { useState, useEffect } from 'react';
import { AutomationRule } from '@/lib/types';
import { 
  Zap, 
  X, 
  Plus, 
  Check, 
  ArrowRight, 
  ShieldAlert, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CustomDropdown } from '@/components/ui/CustomDropdown';

interface AutomationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number | string;
  projectName?: string;
}

export const AutomationsModal: React.FC<AutomationsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = 'Current Project',
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newTrigger, setNewTrigger] = useState<any>('status_changed');
  const [newAction, setNewAction] = useState<any>('change_status');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/automations')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setRules(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleRule = async (id: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: nextEnabled } : r))
    );

    try {
      await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: nextEnabled }),
      });
      toast.success(nextEnabled ? 'Automation rule enabled' : 'Automation rule paused');
    } catch {
      toast.error('Failed to update automation');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName.trim(),
          trigger: newTrigger,
          action: newAction,
          enabled: true,
          projectId,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setRules((prev) => [...prev, created]);
        setIsAddingRule(false);
        setNewRuleName('');
        toast.success('Automation rule created!');
      }
    } catch {
      toast.error('Failed to create rule');
    }
  };

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Workflow Automation Rules"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-panel)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/15 text-white border border-[var(--border-secondary)] flex items-center justify-center">
                <Zap size={15} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Workflow Automation Engine</h2>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{projectName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingRule((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 bg-white text-black hover:bg-[#FFFFFF] rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <Plus size={13} />
                <span>New Rule</span>
              </button>

              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
            {/* Inline Add Rule Form */}
            {isAddingRule && (
              <form onSubmit={handleCreateRule} className="p-4 bg-[var(--bg-canvas)] border border-[var(--border-secondary)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                    Create Custom Rule
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingRule(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. When task is done, complete all sub-works"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] text-xs text-white px-3 py-1.5 rounded-lg outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Trigger Event</label>
                    <CustomDropdown<string>
                      value={newTrigger}
                      onChange={(val) => setNewTrigger(val)}
                      options={[
                        { value: 'status_changed', label: 'When Status changes to Done' },
                        { value: 'issue_created', label: 'When Task is Created' },
                        { value: 'priority_changed', label: 'When Priority is Critical' },
                      ]}
                      className="w-full"
                      triggerClassName="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] px-2.5 py-1.5 rounded-lg hover:border-[var(--border-secondary)]"
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Action to Execute</label>
                    <CustomDropdown<string>
                      value={newAction}
                      onChange={(val) => setNewAction(val)}
                      options={[
                        { value: 'change_status', label: 'Move Status to Needs Review' },
                        { value: 'set_priority', label: 'Set Priority to High' },
                        { value: 'assign_user', label: 'Assign to Project Lead' },
                      ]}
                      className="w-full"
                      triggerClassName="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] px-2.5 py-1.5 rounded-lg hover:border-[var(--border-secondary)]"
                      size="sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-white text-black hover:bg-[#FFFFFF] font-bold text-xs rounded-lg transition-all"
                >
                  Save Automation Rule
                </button>
              </form>
            )}

            {/* Active Rules List */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                Active Rules ({rules.length})
              </span>

              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    rule.enabled
                      ? 'bg-[var(--bg-panel)] border-[var(--border-primary)] shadow-sm'
                      : 'bg-[var(--bg-canvas)] border-[var(--border-primary)] opacity-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Zap size={13} className={rule.enabled ? 'text-white' : 'text-[var(--text-muted)]'} />
                      <h4 className="font-semibold text-white truncate text-xs">{rule.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-primary)]">
                        Trigger: {rule.trigger.replace('_', ' ')}
                      </span>
                      <ArrowRight size={10} />
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-primary)] text-white">
                        Action: {rule.action.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    className="text-xs font-mono font-bold flex items-center gap-1 shrink-0 p-1"
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled ? (
                      <span className="text-white flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--ramp-3)] animate-pulse" />
                        Enabled
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">Disabled</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
