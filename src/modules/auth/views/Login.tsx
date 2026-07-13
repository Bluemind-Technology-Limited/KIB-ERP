import { useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import type { UserRole } from '../../../types';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const demoAccounts = [
    { role: 'SUPER_ADMIN', name: 'Alex Johnson', email: 'admin@kib.group' },
    { role: 'PRODUCTION_MANAGER', name: 'Sarah Connor', email: 'production@kib.group' },
    { role: 'SALES_REP', name: 'Marcus Miller', email: 'sales@kib.group' },
    { role: 'FARM_MANAGER', name: 'John Doe', email: 'farms@kib.group' },
  ];

  const handleDemoSelect = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword('demopass123');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const matchedDemo = demoAccounts.find((acc) => acc.email === email);
    const fullName = matchedDemo ? matchedDemo.name : 'Authorized User';
    const role = matchedDemo ? (matchedDemo.role as UserRole) : 'SALES_REP';

    setSession(
      {
        id: crypto.randomUUID(),
        email,
        username: email.split('@')[0],
        full_name: fullName,
        role,
        is_active: true,
      },
      'demo_jwt_token_signature_value'
    );
    onLoginSuccess();
  };

  return (
    <div className="h-screen w-full flex flex-col justify-between bg-[#FAFAFA] text-[#171717] font-sans md:overflow-hidden overflow-y-auto">
      
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
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-[#171717]"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            English (US)
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-slate-50 rounded-lg border border-transparent"
          >
            Sign up
          </button>
        </div>
      </header>

      {/* 2. Main Login Container */}
      <main className="flex-grow w-full flex flex-col items-center justify-center py-12 px-4 min-h-[700px]">
        
        {/* Main Card (448px width, 48px padding, flat border, no shadows) */}
        <div className="w-[448px] max-w-full bg-white rounded-2xl p-12 border border-slate-200 flex flex-col gap-4">
          
          {/* Card Title (23.1px font size, 32px line height) */}
          <h2 className="text-[23.1px] font-semibold text-[#171717] tracking-tight leading-8">
            Sign in to KIB Group admin portal
          </h2>

          {/* Error Message */}
          {error && (
            <div className="w-[352px] max-w-full p-3 bg-red-50 border border-red-200 text-red-650 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-[352px] max-w-full">
            {/* Custom Demo Persona Dropdown */}
            <div className="flex flex-col gap-2 relative">
              <label className="text-xs font-semibold text-[#171717] leading-5 tracking-tight">
                Select Demo Persona
              </label>
              
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-[352px] max-w-full h-[44px] flex items-center justify-between border rounded-lg px-3 bg-white text-left transition-all cursor-pointer ${
                  isDropdownOpen ? 'border-[#EA4335]' : 'border-slate-200 hover:border-slate-350'
                }`}
              >
                {(() => {
                  const activeAcc = demoAccounts.find(acc => acc.email === email);
                  if (activeAcc) {
                    return (
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#171717]">{activeAcc.name}</span>
                        <span className="text-[9px] text-[#737373] uppercase tracking-wider -mt-0.5">
                          {activeAcc.role.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <span className="text-xs text-slate-500">
                      Select Persona / Custom Credentials
                    </span>
                  );
                })()}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#EA4335]' : ''}`} />
              </button>

              {/* Options Panel */}
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute top-[68px] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('');
                        setPassword('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col justify-center cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-600">Custom Credentials</span>
                      <span className="text-[9px] text-slate-400 uppercase mt-0.5">Use your own auth credentials</span>
                    </button>
                    {demoAccounts.map((account) => (
                      <button
                        key={account.role}
                        type="button"
                        onClick={() => {
                          handleDemoSelect(account);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${
                          email === account.email ? 'bg-[#EA4335]/5' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#171717]">{account.name}</span>
                          <span className="text-[9px] text-[#737373] uppercase tracking-wider mt-0.5">
                            {account.role.replace('_', ' ')}
                          </span>
                        </div>
                        {email === account.email && (
                          <Check className="w-3.5 h-3.5 text-[#EA4335]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#171717] leading-5 tracking-tight">
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
                className="w-full h-[40px] border border-slate-200 bg-white rounded-lg px-3 text-sm text-[#171717] focus:outline-none focus:border-[#EA4335]"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#171717] leading-5 tracking-tight">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[40px] border border-slate-200 bg-white rounded-lg px-3 text-sm text-[#171717] focus:outline-none focus:border-[#EA4335]"
                required
              />
            </div>

            {/* Premium Red 3D submit button */}
            <button
              type="submit"
              className="w-full h-[40px] btn-3d mt-2"
            >
              <span className="text-white text-sm font-semibold">Sign in</span>
            </button>
          </form>

          {/* Sublinks */}
          <div className="w-[352px] max-w-full text-center space-y-2 text-xs pt-2">
            <p className="text-[#737373]">
              Don't have an account?{' '}
              <button type="button" className="text-[#EA4335] hover:underline font-medium">
                Sign up
              </button>
            </p>
            <p>
              <button type="button" className="text-[#737373] hover:underline">
                Forgot your email or password?
              </button>
            </p>
          </div>

        </div>

        {/* Legal Disclaimer */}
        <div className="mt-6 text-center max-w-[400px]">
          <p className="text-[12.8px] leading-[19px] text-[#595959]">
            By continuing, I agree to KIB Group's terms, privacy policy, and cookie policy.
          </p>
        </div>

      </main>

      {/* 3. Footer */}
      <footer className="w-full bg-[#FBFBFB] border-t border-slate-200 py-4 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#737373]">
          <button type="button" className="hover:text-slate-900 transition-colors text-[#0A0A0A]">Support</button>
          <button type="button" className="hover:text-slate-900 transition-colors text-[#0A0A0A]">System status</button>
          <button type="button" className="hover:text-slate-900 transition-colors text-[#0A0A0A]">Careers</button>
          <button type="button" className="hover:text-slate-900 transition-colors text-[#0A0A0A]">Terms of Use</button>
          <button type="button" className="hover:text-slate-900 transition-colors text-[#0A0A0A]">Report Security Issues</button>
          <button type="button" className="hover:text-slate-900 transition-colors font-semibold text-[#0051C3] flex items-center gap-[8px]">
            <img src="/privacy.svg" alt="" width="32.14" height="15" className="inline-block" />
            Your Privacy Choices
          </button>
          <span className="text-slate-450">© 2026 KIB Group, Inc.</span>
        </div>
      </footer>

    </div>
  );
}
