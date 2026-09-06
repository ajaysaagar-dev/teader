'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_PROFILE_IMAGES, isAllowedProfileImage } from '@/lib/avatar';

interface ProfileAvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onAvatarUpdated?: (newAvatar: string, updatedUser: any) => void;
}

export const ProfileAvatarPickerModal: React.FC<ProfileAvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentAvatar,
  onAvatarUpdated,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    currentAvatar && isAllowedProfileImage(currentAvatar) ? currentAvatar : ALL_PROFILE_IMAGES[0]
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentAvatar && isAllowedProfileImage(currentAvatar)) {
        setSelectedAvatar(currentAvatar);
      } else {
        setSelectedAvatar(ALL_PROFILE_IMAGES[0]);
      }
    }
  }, [isOpen, currentAvatar]);

  if (!isOpen) return null;

  const handleSelect = (imgUrl: string) => {
    setSelectedAvatar(imgUrl);
  };

  const handleSave = async () => {
    if (!selectedAvatar || !isAllowedProfileImage(selectedAvatar)) {
      toast.error('Please choose a valid profile portrait');
      return;
    }

    if (selectedAvatar === currentAvatar) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: selectedAvatar }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile avatar');
      }

      const updatedUser = data.user;
      try {
        localStorage.setItem('teader_user', JSON.stringify(updatedUser));
      } catch {}

      // Broadcast update across the entire app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teader_user_updated', { detail: updatedUser }));
      }

      toast.success('Profile avatar updated successfully');
      onAvatarUpdated?.(selectedAvatar, updatedUser);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error updating profile avatar');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIndex = ALL_PROFILE_IMAGES.indexOf(selectedAvatar) + 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-2xl max-h-[88vh] bg-[#16181B] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2C30] bg-[#111215]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--purple)]/15 text-[var(--purple)] flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Choose Profile Portrait</h3>
                <p className="text-[11px] font-mono text-[#787C83]">
                  Select from {ALL_PROFILE_IMAGES.length} available official portraits
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="text-[#787C83] hover:text-white transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Active Preview Bar */}
          <div className="px-6 py-3 bg-[#131417] border-b border-[#24262B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-[var(--purple)] shadow-md shadow-[var(--purple)]/20">
                <img
                  src={selectedAvatar}
                  alt="Selected avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-white">
                  Portrait #{selectedIndex > 0 ? selectedIndex : 1}
                </span>
                <p className="text-[10px] font-mono text-[var(--text-muted)]">
                  Active selection for your user account
                </p>
              </div>
            </div>

            {selectedAvatar === currentAvatar && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Current Avatar
              </span>
            )}
          </div>

          {/* Avatar Grid (Strictly limited to ALL_PROFILE_IMAGES) */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {ALL_PROFILE_IMAGES.map((imgUrl, idx) => {
                const isSelected = selectedAvatar === imgUrl;
                const isCurrent = currentAvatar === imgUrl;
                return (
                  <button
                    key={imgUrl}
                    type="button"
                    onClick={() => handleSelect(imgUrl)}
                    className={`relative group aspect-square rounded-xl p-1 transition-all flex items-center justify-center border ${
                      isSelected
                        ? 'border-[var(--purple)] bg-[var(--purple)]/15 ring-2 ring-[var(--purple)]/40 shadow-lg shadow-[var(--purple)]/20 scale-105'
                        : isCurrent
                        ? 'border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400'
                        : 'border-[#2A2C30] bg-[#121316] hover:border-[#42454D] hover:bg-[#1A1C20]'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Avatar portrait ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
                    />

                    {/* Indicator Badges */}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--purple)] text-white flex items-center justify-center shadow-md">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}

                    {!isSelected && isCurrent && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        •
                      </span>
                    )}

                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/60 backdrop-blur-sm text-[8px] font-mono text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      #{idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#2A2C30] bg-[#111215] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !selectedAvatar}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--purple)] hover:bg-[var(--purple-hover)] text-white text-xs font-bold transition-all shadow-md shadow-[var(--purple)]/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Set as Profile Avatar</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
