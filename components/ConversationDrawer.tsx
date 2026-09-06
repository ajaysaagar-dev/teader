'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { ProjectConversationView } from '@/components/ProjectConversationView';

interface ConversationDrawerProps {
  projectId: number | string;
  projectName?: string;
  projectKey?: string;
  currentUser?: any;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConversationDrawer({
  projectId,
  projectName,
  projectKey,
  currentUser,
  isOpen: controlledIsOpen,
  onOpenChange,
}: ConversationDrawerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (!isControlled) {
      setInternalIsOpen(open);
    }
  };

  // Close on Escape if open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Slide-Over Conversation Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile / tablet */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            />

            {/* Docked Right Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`fixed top-0 right-0 bottom-0 z-50 bg-[#121316] border-l border-[#26282E] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col ${
                isExpanded ? 'w-full lg:w-[720px]' : 'w-full sm:w-[480px] lg:w-[440px]'
              }`}
            >
              {/* Drawer Top Controls */}
              <div className="h-11 px-3 bg-[#17181C] border-b border-[#26282E] flex items-center justify-between shrink-0 select-none text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center">
                    <MessageSquare size={12} />
                  </div>
                  <span className="font-bold text-white tracking-tight">Team Chat</span>
                  {projectName && (
                    <span className="text-[11px] text-[#787C83] font-mono truncate max-w-[150px]">
                      • {projectName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="hidden sm:flex p-1.5 rounded-md hover:bg-[#26282E] text-[#787C83] hover:text-white transition-colors"
                    title={isExpanded ? 'Collapse width' : 'Expand width'}
                  >
                    {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md hover:bg-[#26282E] text-[#787C83] hover:text-white transition-colors"
                    title="Close Chat (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <ProjectConversationView
                  projectId={projectId}
                  projectName={projectName}
                  projectKey={projectKey}
                  currentUser={currentUser}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
