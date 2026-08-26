'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, UserPlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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
        try {
          localStorage.setItem('teader_user', JSON.stringify(data));
          if (data.token) {
            localStorage.setItem('teader_token', data.token);
          }
        } catch {}
        toast.success(`Account created for ${data.name}!`);
        router.push('/projects');
        router.refresh();
      } else {
        toast.error(data.error || 'Registration failed');
      }

    } catch {
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131415] text-[#CFD4DD] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DCB001]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-8 pb-6 text-center space-y-2 border-b border-[#2A2C30] bg-[#0F1011]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 mb-2">
            <Sparkles size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create Teader Account</h1>
          <p className="text-xs text-[#787C83]">Register to manage projects, tasks, and team boards</p>
        </div>

        <form onSubmit={handleRegister} className="p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#CFD4DD] mb-1.5">
              Full Name / Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-[#787C83]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none focus:border-[#DCB001] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#CFD4DD] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-[#787C83]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@teader.io"
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none focus:border-[#DCB001] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#CFD4DD] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-[#787C83]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none focus:border-[#DCB001] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || !password.trim() || isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-xl shadow-lg transition-all disabled:opacity-50 mt-4"
          >
            <UserPlus size={15} />
            <span>Create Account</span>
          </button>
        </form>

        <div className="p-4 bg-[#17181A] border-t border-[#2A2C30] text-center text-xs text-[#787C83]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#DCB001] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
