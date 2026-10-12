'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, LogIn, Mail, Lock, Sparkles, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { clearAllLocalCaches } from '@/lib/client-cache';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(true);

  // Check if session token or user is already remembered in localStorage
  useEffect(() => {
    let isMounted = true;

    async function checkRememberedSession() {
      // Loop guard: if an auto-redirect attempt redirected right back to /login within 4 seconds, break the loop
      try {
        const lastAttempt = sessionStorage.getItem('teader_auto_login_attempt');
        const now = Date.now();
        if (lastAttempt && now - Number(lastAttempt) < 4000) {
          console.warn('[Auth] Redirect loop detected. Clearing stored credentials and showing login form.');
          sessionStorage.removeItem('teader_auto_login_attempt');
          localStorage.removeItem('teader_token');
          localStorage.removeItem('teader_user');
          if (isMounted) setIsCheckingAutoLogin(false);
          return;
        }
      } catch {}

      try {
        const savedToken = localStorage.getItem('teader_token');
        const savedUser = localStorage.getItem('teader_user');

        if (savedToken || savedUser) {
          const res = await fetch('/api/auth/me', {
            headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
          });

          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              if (savedToken) localStorage.setItem('teader_token', savedToken);
              localStorage.setItem('teader_user', JSON.stringify(data.user));

              // Record timestamp to catch rapid bounce loops
              try {
                sessionStorage.setItem('teader_auto_login_attempt', String(Date.now()));
              } catch {}

              // Auto-redirect to target dashboard
              let target = '/dashboard';
              if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                const redirectParam = urlParams.get('redirect');
                if (redirectParam && redirectParam.startsWith('/')) {
                  target = redirectParam;
                }
                window.location.href = target;
                return;
              }
              router.push(target);
              return;
            } else {
              // Stored session is not valid — clear stale local storage
              try {
                localStorage.removeItem('teader_token');
                localStorage.removeItem('teader_user');
              } catch {}
            }
          } else {
            try {
              localStorage.removeItem('teader_token');
              localStorage.removeItem('teader_user');
            } catch {}
          }
        }
      } catch {
        try {
          localStorage.removeItem('teader_token');
          localStorage.removeItem('teader_user');
        } catch {}
      }

      if (isMounted) {
        setIsCheckingAutoLogin(false);
      }
    }

    checkRememberedSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: cleanId,
          username: cleanId,
          password: password.trim(),
          remember: rememberMe
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Clear previous user cache
        clearAllLocalCaches();

        // Persist session user & token in localStorage if remember enabled
        if (rememberMe) {
          try {
            localStorage.setItem('teader_user', JSON.stringify(data));
            if (data.token) {
              localStorage.setItem('teader_token', data.token);
            }
            localStorage.setItem('teader_remember', 'true');
          } catch {}
        } else {
          try {
            localStorage.removeItem('teader_user');
            localStorage.removeItem('teader_token');
            localStorage.removeItem('teader_remember');
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

  const handlePresetFill = (presetId: string) => {
    setIdentifier(presetId);
    setPassword('password123');
  };

  if (isCheckingAutoLogin) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--border-secondary)] border-t-transparent animate-spin" />
          <span className="text-sm font-mono text-[var(--text-secondary)]">Verifying saved session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white text-black/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="p-8 pb-6 text-center space-y-2 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]">
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to Teader</h1>
          <p className="text-sm text-[var(--text-secondary)]">Sign in to access your projects and task boards</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Email or Username
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. karri or karri@teader.io"
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-sm text-[var(--text-secondary)] placeholder-[#A0A0A0] outline-none focus:border-[var(--border-secondary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3.5 text-[var(--text-secondary)]" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-sm text-[var(--text-secondary)] placeholder-[#A0A0A0] outline-none focus:border-[var(--border-secondary)] transition-colors"
              />
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setRememberMe((prev) => !prev)}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-white cursor-pointer select-none group"
            >
              {rememberMe ? (
                <CheckSquare size={16} className="text-white" />
              ) : (
                <Square size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--text-secondary)]" />
              )}
              <span className="text-xs font-medium">Remember me (Keep me signed in)</span>
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!identifier.trim() || !password.trim() || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-[#000000] bg-white text-black hover:bg-[#FFFFFF] rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <LogIn size={18} />
            <span>Sign In</span>
          </button>
        </form>

        {/* Register Footer Link */}
        <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-primary)] text-center text-sm text-[var(--text-secondary)]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-white font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
