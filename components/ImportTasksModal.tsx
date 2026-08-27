'use client';

import React, { useState } from 'react';
import { Issue } from '@/lib/types';
import { Upload, X, FileText, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ImportTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | number;
  projectName?: string;
  onImportSuccess: (newIssues: Issue[]) => void;
}

export const ImportTasksModal: React.FC<ImportTasksModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = 'Current Project',
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (selected.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
          setParsedPreview(list.slice(0, 10));
        } else if (selected.name.endsWith('.csv')) {
          const lines = text.split('\n').filter((l) => l.trim());
          const tasks = lines.slice(1).map((line) => {
            const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            return {
              title: cols[1] || cols[0] || 'Imported Task',
              status: cols[2] || 'todo',
              priority: cols[3] || 'medium',
              assigneeName: cols[4] || 'General (Anyone)',
            };
          });
          setParsedPreview(tasks.slice(0, 10));
        }
      } catch {
        toast.error('Failed to parse file format');
      }
    };
    reader.readAsText(selected);
  };

  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0) {
      toast.error('No tasks found to import');
      return;
    }

    setIsImporting(true);
    try {
      const createdList: Issue[] = [];
      for (const item of parsedPreview) {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            description: item.description || 'Imported from external file',
            status: item.status || 'todo',
            priority: item.priority || 'medium',
            assigneeName: item.assigneeName || 'General (Anyone)',
            projectId: Number(projectId),
            project: projectName,
            labels: ['Imported'],
          }),
        });

        if (res.ok) {
          const created = await res.json();
          createdList.push(created);
        }
      }

      onImportSuccess(createdList);
      toast.success(`Successfully imported ${createdList.length} tasks!`);
      onClose();
    } catch {
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Import Tasks"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="w-full max-w-lg bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2C30] bg-[#17181A]">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-[#DCB001]" />
              <h2 className="text-sm font-bold text-white tracking-tight">Import Tasks (CSV / JSON)</h2>
            </div>
            <button onClick={onClose} className="text-[#787C83] hover:text-white p-1 rounded-lg">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs font-sans">
            {/* File Upload Zone */}
            <label className="border-2 border-dashed border-[#2A2C30] hover:border-[#DCB001]/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#131415] hover:bg-[#161719] transition-colors">
              <Upload size={24} className="text-[#DCB001]" />
              <span className="font-semibold text-white">
                {file ? file.name : 'Click or drop CSV / JSON project export file'}
              </span>
              <span className="text-[10px] font-mono text-[#787C83]">
                Supports Teader JSON export or standard CSV spreadsheets
              </span>
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Parsed Preview */}
            {parsedPreview.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider block">
                  Preview ({parsedPreview.length} items ready to import)
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {parsedPreview.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#131415] border border-[#2A2C30] rounded-lg flex items-center justify-between text-xs"
                    >
                      <span className="text-white truncate font-medium">{t.title}</span>
                      <span className="text-[10px] font-mono text-[#DCB001] uppercase px-1.5 py-0.5 rounded bg-[#1B1C1F]">
                        {t.priority || 'medium'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2A2C30]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#17181A] hover:bg-[#222427] text-[#787C83] hover:text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isImporting || parsedPreview.length === 0}
                className="px-5 py-2 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : `Import ${parsedPreview.length} Tasks`}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
