'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global Navigation',
      shortcuts: [
        { keys: ['⌘', 'K'], label: 'Open Command Palette & Fuzzy Search' },
        { keys: ['C'], label: 'Create New Issue' },
        { keys: ['?'], label: 'Open Keyboard Shortcuts Help' },
        { keys: ['Esc'], label: 'Close Active Modal / Panel' },
      ],
    },
    {
      title: 'Views & Issue Navigation',
      shortcuts: [
        { keys: ['1'], label: 'Switch to Issue Details View' },
        { keys: ['2'], label: 'Switch to Kanban Board View' },
        { keys: ['3'], label: 'Switch to Timeline / Gantt View' },
        { keys: ['4'], label: 'Switch to Velocity Pulse & Metrics' },
      ],
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-lg bg-[#1B1C1F] border border-[#2A2C30] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2C30] bg-[#0F1011]">
            <div className="flex items-center gap-2 text-lg font-bold text-[#E5E7EB]">
              <Keyboard size={16} className="text-[#DCB001]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#9CA3AF] hover:text-white rounded hover:bg-[#222427] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {shortcutGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  {group.title}
                </h4>
                <div className="divide-y divide-[#2A2C30] border border-[#2A2C30] rounded-lg bg-[#0F1011] overflow-hidden">
                  {group.shortcuts.map((sc, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-[#9499A0]">{sc.label}</span>
                      <div className="flex items-center gap-1">
                        {sc.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 bg-[#2A2C30] border border-[#3B3D41] rounded font-mono text-xs text-[#E5E7EB] shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-[#2A2C30] bg-[#0F1011] text-center text-sm text-[#9CA3AF]">
            Teader is engineered for power users with sub-millisecond keyboard navigation.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
