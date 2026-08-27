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
  const [newAction, setNewAction] = useState<any>('complete_subtasks');

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
          className="w-full max-w-2xl bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2C30] bg-[#17181A]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 flex items-center justify-center">
                <Zap size={15} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Workflow Automation Engine</h2>
                <span className="text-[10px] font-mono text-[#787C83]">{projectName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingRule((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <Plus size={13} />
                <span>New Rule</span>
              </button>

              <button onClick={onClose} className="text-[#787C83] hover:text-white p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
            {/* Inline Add Rule Form */}
            {isAddingRule && (
              <form onSubmit={handleCreateRule} className="p-4 bg-[#131415] border border-[#DCB001]/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-[#DCB001] uppercase tracking-wider">
                    Create Custom Rule
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingRule(false)}
                    className="text-xs text-[#787C83] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-[#787C83] mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. When task is done, complete all sub-works"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-[#1B1C1F] border border-[#2A2C30] text-xs text-white px-3 py-1.5 rounded-lg outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-[#787C83] mb-1">Trigger Event</label>
                    <select
                      value={newTrigger}
                      onChange={(e) => setNewTrigger(e.target.value)}
                      className="w-full bg-[#1B1C1F] border border-[#2A2C30] text-xs text-[#CFD4DD] px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                    >
                      <option value="status_changed">When Status changes to Done</option>
                      <option value="subtasks_completed">When All Subtasks Completed</option>
                      <option value="issue_created">When Task is Created</option>
                      <option value="priority_changed">When Priority is Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#787C83] mb-1">Action to Execute</label>
                    <select
                      value={newAction}
                      onChange={(e) => setNewAction(e.target.value)}
                      className="w-full bg-[#1B1C1F] border border-[#2A2C30] text-xs text-[#CFD4DD] px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                    >
                      <option value="complete_subtasks">Auto-complete all subtasks</option>
                      <option value="change_status">Move Status to Needs Review</option>
                      <option value="set_priority">Set Priority to High</option>
                      <option value="assign_user">Assign to Project Lead</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded-lg transition-all"
                >
                  Save Automation Rule
                </button>
              </form>
            )}

            {/* Active Rules List */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider block">
                Active Rules ({rules.length})
              </span>

              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    rule.enabled
                      ? 'bg-[#17181A] border-[#2A2C30] shadow-sm'
                      : 'bg-[#131415] border-[#2A2C30]/40 opacity-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Zap size={13} className={rule.enabled ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                      <h4 className="font-semibold text-white truncate text-xs">{rule.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#787C83]">
                      <span className="px-1.5 py-0.5 rounded bg-[#131415] border border-[#2A2C30]">
                        Trigger: {rule.trigger.replace('_', ' ')}
                      </span>
                      <ArrowRight size={10} />
                      <span className="px-1.5 py-0.5 rounded bg-[#131415] border border-[#2A2C30] text-[#DCB001]">
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
                      <span className="text-[#22C55E] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                        Enabled
                      </span>
                    ) : (
                      <span className="text-[#787C83]">Disabled</span>
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
