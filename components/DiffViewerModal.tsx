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
          className="w-full max-w-4xl max-h-[85vh] bg-[#1B1C1F] border border-[#2A2C30] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2C30] bg-[#0F1011]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1A1B1D] border border-[#2A2C30] text-[#0391A1]">
                <GitCommit size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#CFD4DD]">{title}</h3>
                <p className="text-xs text-[#787C83]">
                  {diffs.length} changed file{diffs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#787C83] hover:text-white rounded-lg hover:bg-[#222427] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Diff list body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {diffs.map((diff, idx) => (
              <div key={idx} className="border border-[#2A2C30] rounded-lg overflow-hidden bg-[#0F1011]">
                {/* File Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#17181A] border-b border-[#2A2C30] text-xs font-mono">
                  <div className="flex items-center gap-2 text-[#CFD4DD]">
                    <FileCode size={14} className="text-[#0391A1]" />
                    <span>{diff.path}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-sans">
                    <span className="text-[#22C55E]">+{diff.additions}</span>
                    <span className="text-[#C0393B]">-{diff.deletions}</span>
                  </div>
                </div>

                {/* File Hunks */}
                <div className="divide-y divide-[#2A2C30] font-mono text-[12px] leading-relaxed">
                  {diff.hunks.map((hunk, hIdx) => (
                    <div key={hIdx}>
                      <div className="px-4 py-1 text-[11px] bg-[#1A1B1D] text-[#DCB001] border-y border-[#2A2C30]">
                        {hunk.header}
                      </div>
                      <div className="divide-y divide-[#2A2C30]/40">
                        {hunk.lines.map((line, lIdx) => {
                          const isAdd = line.type === 'add';
                          const isDel = line.type === 'delete';
                          return (
                            <div
                              key={lIdx}
                              className={`flex px-3 py-0.5 select-text ${
                                isAdd
                                  ? 'bg-[#22C55E]/10 text-[#22C55E]'
                                  : isDel
                                  ? 'bg-[#C0393B]/10 text-[#C0393B] line-through opacity-80'
                                  : 'text-[#9499A0]'
                              }`}
                            >
                              <span className="w-10 shrink-0 text-[#787C83] text-[10px] select-none text-right pr-3">
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#2A2C30] bg-[#0F1011]">
            <span className="text-xs text-[#787C83]">Ready to commit and deploy</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-[#9499A0] hover:text-white rounded-lg hover:bg-[#222427] transition-colors"
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
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#CFD4DD] bg-[#1E1E1E] hover:bg-[#2A2C30] border border-[#3B3D41] rounded-lg shadow-sm transition-colors"
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
