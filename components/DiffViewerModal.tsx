'use client';

import React from 'react';
import { FileDiff } from '@/lib/types';
import { X, FileCode, Check, GitCommit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: FileDiff[];
  title?: string;
  onApply?: () => void;
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  diffs,
  title = 'Git Diff Preview',
  onApply,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-4xl max-h-[85vh] bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] text-[#A0A0A0]">
                <GitCommit size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#EDEDED]">{title}</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {diffs.length} changed file{diffs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-[#242424] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Diff list body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {diffs.map((diff, idx) => (
              <div key={idx} className="border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-canvas)]">
                {/* File Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] text-xs font-mono">
                  <div className="flex items-center gap-2 text-[#EDEDED]">
                    <FileCode size={14} className="text-[#A0A0A0]" />
                    <span>{diff.path}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-sans">
                    <span className="text-white">+{diff.additions}</span>
                    <span className="text-[#FFFFFF]">-{diff.deletions}</span>
                  </div>
                </div>

                {/* File Hunks */}
                <div className="divide-y divide-[var(--border-primary)] font-mono text-[12px] leading-relaxed">
                  {diff.hunks.map((hunk, hIdx) => (
                    <div key={hIdx}>
                      <div className="px-4 py-1 text-xs bg-[var(--bg-card)] text-white border-y border-[var(--border-primary)]">
                        {hunk.header}
                      </div>
                      <div className="divide-y divide-[var(--border-primary)]">
                        {hunk.lines.map((line, lIdx) => {
                          const isAdd = line.type === 'add';
                          const isDel = line.type === 'delete';
                          return (
                            <div
                              key={lIdx}
                              className={`flex px-3 py-0.5 select-text ${
                                isAdd
                                  ? 'bg-[var(--ramp-3)]/10 text-white'
                                  : isDel
                                  ? 'bg-[#FFFFFF]/10 text-[#FFFFFF] line-through opacity-80'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              <span className="w-10 shrink-0 text-[var(--text-secondary)] text-xs select-none text-right pr-3">
                                {line.newLine || line.oldLine || ''}
                              </span>
                              <span className="w-4 shrink-0 select-none font-bold">
                                {isAdd ? '+' : isDel ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre overflow-x-auto">{line.content}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-canvas)]">
            <span className="text-sm text-[var(--text-secondary)]">Ready to commit and deploy</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-[#242424] transition-colors"
              >
                Close Preview
              </button>
              {onApply && (
                <button
                  onClick={() => {
                    onApply();
                    onClose();
                    toast.success('Changes committed!');
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-[#EDEDED] bg-[#1E1E1E] hover:bg-[#222222] border border-[#3E3E3E] rounded-lg shadow-sm transition-colors"
                >
                  <Check size={14} />
                  <span>Apply Patch & Merge</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
