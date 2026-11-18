import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { Globe, AlertCircle, X, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  // Auto-dismiss the toast a few seconds after an error appears.
  useEffect(() => {
    if (!error) return;
    setToastKey((k) => k + 1);
    const timer = setTimeout(() => setError(''), 4500);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const result = await login(email, password);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.message || 'Login failed');
      return;
    }
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-app text-ink font-sans">
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .toast-animate { animation: toast-in 0.28s ease-out; }
      `}</style>

      {/* Toast: shows backend / auth error responses */}
      {error && (
        <div
          key={toastKey}
          role="alert"
          className="toast-animate fixed bottom-6 right-6 z-[100] w-[calc(100%-3rem)] max-w-sm"
        >
          <div className="flex items-start gap-2.5 bg-surface text-ink px-4 py-3 rounded-xl border border-line shadow-lg">
            <AlertCircle className="w-4 h-4 text-[#EA4335] shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-5 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-ink-faint hover:text-ink-muted shrink-0 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      
      {/* 1. Header Section */}
      <header className="w-full max-w-[1440px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between h-14">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <img src="/KIB.png" alt="KIB Group logo" className="h-14 object-contain" />
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-line hover:bg-surface-2 text-xs font-semibold rounded-lg text-ink"
          >
            <Globe className="w-3.5 h-3.5 text-ink-muted" />
            English (US)
          </button>
        </div>
      </header>

      {/* 2. Main Login Container */}
      <main className="flex-1 w-full flex flex-col items-center justify-center py-12 px-4">
        
        {/* Main Card (448px width, 48px padding, flat border, no shadows) */}
        <div className="w-[448px] max-w-full bg-surface rounded-2xl p-12 border border-line flex flex-col gap-4">
          
          {/* Card Title (23.1px font size, 32px line height) */}
          <h2 className="text-[23.1px] font-semibold text-ink tracking-tight leading-8">
            Sign in to KIB Group admin portal
          </h2>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-[352px] max-w-full">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-ink leading-5 tracking-tight">
                Email
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full h-[40px] border border-line bg-surface rounded-lg px-3 text-sm text-ink focus:outline-none focus:border-[#EA4335]"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-ink leading-5 tracking-tight">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[40px] border border-line bg-surface rounded-lg px-3 pr-10 text-sm text-ink focus:outline-none focus:border-[#EA4335]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Premium Red 3D submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[40px] btn-3d mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="text-white text-sm font-semibold">{isSubmitting ? 'Signing in…' : 'Sign in'}</span>
            </button>
          </form>

          {/* Sublinks */}
          <div className="w-[352px] max-w-full text-center space-y-2 text-xs pt-2">
            <p>
              <button type="button" className="text-ink-muted hover:underline">
                Forgot your email or password?
              </button>
            </p>
          </div>

        </div>

        {/* Legal Disclaimer */}
        <div className="mt-6 text-center max-w-[400px]">
          <p className="text-[12.8px] leading-[19px] text-ink-muted">
            By continuing, I agree to KIB Group's terms, privacy policy, and cookie policy.
          </p>
        </div>

      </main>

      {/* 3. Footer */}
      <footer className="w-full bg-surface-2 border-t border-line py-4 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
          <a href="mailto:dev@bluemind.cloud" className="hover:text-ink transition-colors text-ink">Support</a>
          <button type="button" className="hover:text-ink transition-colors text-ink">System status</button>
          <button type="button" className="hover:text-ink transition-colors text-ink">Careers</button>
          <button type="button" className="hover:text-ink transition-colors text-ink">Terms of Use</button>
          <button type="button" className="hover:text-ink transition-colors text-ink">Report Security Issues</button>
          <button type="button" className="hover:text-ink transition-colors font-semibold text-[#0051C3] flex items-center gap-[8px]">
            <img src="/privacy.svg" alt="" width="32.14" height="15" className="inline-block" />
            Your Privacy Choices
          </button>
          <span className="text-ink-faint">© 2026 KIB Group, Inc.</span>
        </div>
      </footer>

    </div>
  );
}
