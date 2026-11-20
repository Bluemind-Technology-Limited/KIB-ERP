import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import NetworkMeter from '../components/NetworkMeter';
import NotificationBell from '../components/ui/NotificationBell';
import { useAuthStore } from '../stores/useAuthStore';

import {
  User as UserIcon, Menu, X, LogOut, Settings, Search
} from 'lucide-react';
import { HistoryNav } from '../components/ui/HistoryNav';
import { useThemeStore } from '../stores/useThemeStore';

interface DashboardLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ 
  activeTab, 
  setActiveTab, 
  onLogout, 
  searchQuery, 
  setSearchQuery, 
  children 
}: DashboardLayoutProps) {
  const user = useAuthStore((state) => state.user);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleNetwork = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleNetwork);
    window.addEventListener('offline', handleNetwork);
    return () => {
      window.removeEventListener('online', handleNetwork);
      window.removeEventListener('offline', handleNetwork);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoutAction = () => {
    onLogout();
  };

  return (
    <div className="h-screen overflow-hidden bg-app text-ink flex flex-col font-sans">

      {/* Network meter — full-width, hidden until the connection needs attention */}
      <NetworkMeter />

      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Sidebar - Desktop Layout (Isolated Component) */}
        <div className={`hidden md:block h-full shrink-0 z-30 transition-all duration-200 ${isSidebarCollapsed ? 'w-[56px]' : 'w-[260px]'}`}>
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={handleLogoutAction} 
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
          />
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">

          {/* Sticky Dashboard Header (58px height, does not scroll with page) */}
        <header className="h-[58px] bg-surface-2 border-b border-line-strong/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
          
          {/* Back / Forward navigation replacing the breadcrumb */}
          <HistoryNav />

          {/* Centered Header Search Input for List/Detail pages */}
          {activeTab !== 'executive' && (
            <div className="hidden md:flex items-center relative w-96 h-10 bg-surface border border-line rounded-xl focus-within:border-[#EA4335]/70 transition-colors">
              <div className="pl-3 flex items-center justify-center pointer-events-none">
                <Search className="w-4 h-4 text-ink-muted" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full bg-transparent pl-2.5 pr-14 text-sm text-ink focus:outline-none placeholder-ink-faint cursor-text"
              />
              <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
                <kbd className="w-[22px] h-5 bg-app border border-line rounded flex items-center justify-center text-[12px] font-semibold text-ink-3 font-sans">
                  ⌘
                </kbd>
                <kbd className="w-5 h-5 bg-app border border-line rounded flex items-center justify-center text-[12px] font-semibold text-ink-3 font-sans">
                  K
                </kbd>
              </div>
            </div>
          )}

          {/* Right Header Menu Controls */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Notification Bell */}
            <NotificationBell />

            {/* Help section removed */}

            {/* Premium User Avatar with online indicator */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="relative focus:outline-none cursor-pointer group flex items-center"
              >
                <div className="w-8 h-8 rounded-full border border-line bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-xs font-bold text-ink uppercase transition-colors">
                  {user?.fullName?.slice(0, 2) || <UserIcon className="w-4 h-4 text-ink-faint" />}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </button>

              {/* Profile Dropdown Panel */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-[220px] bg-surface border border-line rounded-lg shadow-lg z-50 p-4 flex flex-col gap-3 animate-in fade-in duration-100">
                    <div className="border-b border-line pb-2.5">
                      <p className="text-xs font-bold text-ink leading-none mb-1">
                        {user?.fullName?.split(' ')[0] || 'Isaac'}
                      </p>
                      <p className="text-[10px] text-ink-faint truncate mb-2">{user?.email}</p>
                      <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#EA4335] text-white">
                        {user?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs text-ink-muted">


                      <button 
                        onClick={() => { setIsProfileOpen(false); setActiveTab('account-settings'); }}
                        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-surface-2 rounded-md transition-colors text-left font-medium cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-ink-muted" />
                        <span>Account Settings</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu trigger */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1 text-ink-muted hover:text-ink ml-1"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </header>

        {/* Mobile Dropdown navigation menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-surface-2 border-b border-line-strong/80 px-4 py-3 space-y-1 z-30">
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('executive'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'executive' ? 'bg-surface-3 text-ink' : 'text-ink-muted'}`}
              >
                Overview
              </button>
              <button
                onClick={() => { setActiveTab('md-warehouses'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'md-warehouses' ? 'bg-surface-3 text-ink' : 'text-ink-muted'}`}
              >
                Warehouses
              </button>
              <button
                onClick={() => { setActiveTab('md-materials'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'md-materials' ? 'bg-surface-3 text-ink' : 'text-ink-muted'}`}
              >
                Materials
              </button>
            </div>
            
            <div className="pt-2 border-t border-line mt-2">
              <button
                onClick={handleLogoutAction}
                className="w-full flex items-center justify-center gap-2 py-2 text-rose-600 bg-rose-50 rounded-xl text-xs font-semibold dark:text-rose-300 dark:bg-rose-500/10"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Page Container */}
        <main className="flex-1 min-h-0 overflow-y-auto kib-scroll p-6 md:p-8 bg-app">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        </div>
      </div>

    </div>
  );
}

/** Light/dark switch for the header chrome. */
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`kib-switch-track relative inline-flex h-[26px] w-[50px] shrink-0 items-center rounded-full border p-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[#EA4335]/40 active:scale-[0.97] ${
        isDark
          ? 'border-[#c7392c] bg-[#EA4335]'
          : 'border-line bg-surface-4'
      }`}
    >
      <span
        className={`kib-switch-knob h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${
          isDark ? 'translate-x-[24px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
