'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, UserPlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { clearAllLocalCaches } from '@/lib/client-cache';
import { TopFrame } from '@/components/TopFrame';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        clearAllLocalCaches();
        try {
          localStorage.setItem('teader_user', JSON.stringify(data));
          if (data.token) {
            localStorage.setItem('teader_token', data.token);
          }
        } catch {}
        toast.success(`Account created for ${data.name}!`);
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        } else {
          router.push('/dashboard');
        }

      } else {
        const errorMsg = data.error || data.issues?.[0]?.message || 'Registration failed';
        toast.error(errorMsg);
      }

    } catch {
      toast.error('Failed to create account. Please check your network or database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* ─── Top Frameless Window Header ──────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-main)] border-b border-[var(--border-primary)] px-5 py-2">
        <TopFrame />
      </div>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-8 pb-6 text-center space-y-2 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)] flex flex-col items-center">
          <img src="/logo.svg" alt="Teader" className="w-10 h-10 object-contain mb-1" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Teader Account</h1>
          <p className="text-sm text-[var(--text-secondary)]">Register to manage projects, tasks, and team boards</p>
        </div>

        <form onSubmit={handleRegister} className="p-8 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Full Name / Username
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-sm text-[var(--text-secondary)] placeholder-[#A0A0A0] outline-none focus:border-[var(--border-secondary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-3.5 text-[var(--text-secondary)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@teader.io"
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-sm text-[var(--text-secondary)] placeholder-[#A0A0A0] outline-none focus:border-[var(--border-secondary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Password <span className="text-xs text-[var(--text-secondary)] font-normal">(min 6 characters)</span>
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3.5 text-[var(--text-secondary)]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-sm text-[var(--text-secondary)] placeholder-[#A0A0A0] outline-none focus:border-[var(--border-secondary)] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || !password.trim() || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold bg-[var(--accent)] text-[var(--text-inverse)] hover:brightness-110 active:brightness-95 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-4"
          >
            <UserPlus size={18} />
            <span>Create Account</span>
          </button>
        </form>

        <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-primary)] text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link href="/login" className="text-white font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
