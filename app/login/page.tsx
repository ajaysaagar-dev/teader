'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, LogIn, Mail, Lock, Sparkles, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if session token or user is already remembered
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('teader_user');
      if (savedUser) {
        // Fast verify with backend
        fetch('/api/auth/me')
          .then((res) => {
            if (res.ok) {
              router.push('/projects');
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password.trim(),
          remember: rememberMe
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Persist session user & token in localStorage to remember login state
        if (rememberMe) {
          try {
            localStorage.setItem('teader_user', JSON.stringify(data));
            if (data.token) {
              localStorage.setItem('teader_token', data.token);
            }
          } catch {}
        }
        toast.success(`Welcome back, ${data.name}!`);
        
        // Check for redirect query param
        let target = '/dashboard';
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const redirectParam = urlParams.get('redirect');
          if (redirectParam && redirectParam.startsWith('/')) {
            target = redirectParam;
          }
          window.location.href = target;
        } else {
          router.push('/dashboard');
        }

      } else {
        toast.error(data.error || 'Invalid credentials');
      }
    } catch {
      toast.error('Failed to log in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-[#131415] text-[#CFD4DD] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DCB001]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="p-8 pb-6 text-center space-y-2 border-b border-[#2A2C30] bg-[#0F1011]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 mb-2">
            <Sparkles size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome to Teader</h1>
          <p className="text-xs text-[#787C83]">Sign in to access your projects and task boards</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
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
                placeholder="e.g. karri@teader.io"
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

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setRememberMe((prev) => !prev)}
              className="flex items-center gap-2 text-[#CFD4DD] hover:text-white cursor-pointer select-none group"
            >
              {rememberMe ? (
                <CheckSquare size={15} className="text-[#DCB001]" />
              ) : (
                <Square size={15} className="text-[#787C83] group-hover:text-[#CFD4DD]" />
              )}
              <span className="text-[11px] font-medium">Remember me (Keep me signed in)</span>
            </button>
          </div>

          {/* Quick Preset Credentials Clickable Hints */}
          <div className="p-3 bg-[#131415] rounded-xl border border-[#2A2C30] space-y-1.5 text-[11px] text-[#787C83]">
            <div className="font-semibold text-[#CFD4DD] flex items-center gap-1">
              <ShieldCheck size={12} className="text-[#DCB001]" />
              Demo Credentials (Click to fill):
            </div>
            <div className="flex flex-col gap-1 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => handlePresetFill('karri@teader.io')}
                className="text-left px-2 py-1 bg-[#1B1C1F] hover:bg-[#2A2C30] rounded border border-[#2A2C30] hover:border-[#DCB001]/40 text-[#DCB001] transition-colors"
              >
                Owner: karri@teader.io / password123
              </button>
              <button
                type="button"
                onClick={() => handlePresetFill('jori@teader.io')}
                className="text-left px-2 py-1 bg-[#1B1C1F] hover:bg-[#2A2C30] rounded border border-[#2A2C30] hover:border-[#DCB001]/40 text-[#CFD4DD] transition-colors"
              >
                Member: jori@teader.io / password123
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || !password.trim() || isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
        </form>

        {/* Register Footer Link */}
        <div className="p-4 bg-[#17181A] border-t border-[#2A2C30] text-center text-xs text-[#787C83]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#DCB001] font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
