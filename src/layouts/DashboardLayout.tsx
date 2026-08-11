import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuthStore } from '../stores/useAuthStore';

import { 
  ChevronRight, HelpCircle, User as UserIcon, Menu, X, LogOut, Settings, Search 
} from 'lucide-react';

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

  // Helper to map tab id to breadcrumb strings
  const getBreadcrumbs = () => {
    switch (activeTab) {
      case 'executive':
        return { parent: 'Dashboards', current: 'Overview' };
      case 'admin-users':
        return { parent: 'Dashboards', current: 'Manage Users' };
      case 'md-warehouses':
        return { parent: 'Master Data', current: 'Warehouses' };
      case 'md-materials':
        return { parent: 'Master Data', current: 'Materials' };
      case 'md-suppliers':
        return { parent: 'Master Data', current: 'Suppliers' };
      case 'proc-procurement':
        return { parent: 'Procurement', current: 'Requisitions & POs' };
      case 'inv-stock':
        return { parent: 'Inventory', current: 'Stock Ledger' };
      case 'inv-grn':
        return { parent: 'Inventory', current: 'Goods Receipt' };
      case 'inv-finished':
        return { parent: 'Inventory', current: 'Finished Goods' };
      case 'prod-boms':
        return { parent: 'Production', current: 'Bill of Materials' };
      case 'prod-orders':
        return { parent: 'Production', current: 'Production Orders' };
      case 'prod-trace':
        return { parent: 'Production', current: 'Traceability' };
      case 'qa-inspections':
        return { parent: 'Quality Assurance', current: 'Inspections' };
      case 'alerts-notifications':
        return { parent: 'Alerts & Reports', current: 'Notifications' };
      case 'reports':
        return { parent: 'Alerts & Reports', current: 'Reports' };
      default:
        return { parent: 'Dashboards', current: 'Traffic overview' };
    }
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#171717] flex font-sans">
      
      {/* Sidebar - Desktop Layout (Isolated Component) */}
      <div className={`hidden md:block sticky top-0 h-screen shrink-0 z-30 transition-all duration-200 ${isSidebarCollapsed ? 'w-[56px]' : 'w-[260px]'}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={handleLogoutAction} 
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Sticky Dashboard Header (58px height, does not scroll with page) */}
        <header className="h-[58px] bg-[#FBFBFB] border-b border-[#D9D9D9]/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
          
          {/* Breadcrumb section */}
          <div className="flex items-center gap-1.5 text-sm h-12">
            <span className="text-[#737373] tracking-tight">{breadcrumbs.parent}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#D4D4D4]" />
            <span className="text-[#313131] font-medium tracking-tight">{breadcrumbs.current}</span>
          </div>

          {/* Centered Header Search Input for List/Detail pages */}
          {activeTab !== 'executive' && (
            <div className="hidden md:flex items-center relative w-96 h-10 bg-white border border-[#E5E5E5] rounded-xl focus-within:border-[#EA4335]/70 transition-colors">
              <div className="pl-3 flex items-center justify-center pointer-events-none">
                <Search className="w-4 h-4 text-[#737373]" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full bg-transparent pl-2.5 pr-14 text-sm text-[#171717] focus:outline-none placeholder-[#A1A1A1] cursor-text"
              />
              <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
                <kbd className="w-[22px] h-5 bg-[#FAFAFA] border border-[#E5E5E5] rounded flex items-center justify-center text-[12px] font-semibold text-[#525252] font-sans">
                  ⌘
                </kbd>
                <kbd className="w-5 h-5 bg-[#FAFAFA] border border-[#E5E5E5] rounded flex items-center justify-center text-[12px] font-semibold text-[#525252] font-sans">
                  K
                </kbd>
              </div>
            </div>
          )}

          {/* Right Header Menu Controls */}
          <div className="flex items-center gap-2">
            {/* Support link (98px x 32px) */}
            <a
              href="mailto:dev@bluemind.cloud"
              className="w-[98px] h-8 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-[#171717] transition-colors cursor-pointer bg-white"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Support</span>
            </a>

            {/* Premium User Avatar with online indicator */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="relative focus:outline-none cursor-pointer group flex items-center"
              >
                <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-[#171717] uppercase transition-colors">
                  {user?.fullName?.slice(0, 2) || <UserIcon className="w-4 h-4 text-slate-400" />}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </button>

              {/* Profile Dropdown Panel */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-[220px] bg-white border border-[#E9E9E9] rounded-lg shadow-lg z-50 p-4 flex flex-col gap-3 animate-in fade-in duration-100">
                    <div className="border-b border-slate-100 pb-2.5">
                      <p className="text-xs font-bold text-[#171717] leading-none mb-1">
                        {user?.fullName?.split(' ')[0] || 'Isaac'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mb-2">{user?.email}</p>
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-[#EA4335]/10 text-[#EA4335] px-2 py-0.5 rounded border border-[#EA4335]/20">
                        {user?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs text-slate-650">


                      <button 
                        onClick={() => { setIsProfileOpen(false); alert('Settings clicked'); }}
                        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-md transition-colors text-left font-medium cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-500" />
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
              className="md:hidden p-1 text-slate-500 hover:text-slate-900 ml-1"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </header>

        {/* Mobile Dropdown navigation menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#FBFBFB] border-b border-[#D9D9D9]/80 px-4 py-3 space-y-1 z-30">
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('executive'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'executive' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                Overview
              </button>
              <button
                onClick={() => { setActiveTab('md-warehouses'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'md-warehouses' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                Warehouses
              </button>
              <button
                onClick={() => { setActiveTab('md-materials'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'md-materials' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                Materials
              </button>
            </div>
            
            <div className="pt-2 border-t border-slate-200 mt-2">
              <button
                onClick={handleLogoutAction}
                className="w-full flex items-center justify-center gap-2 py-2 text-rose-600 bg-rose-50 rounded-xl text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Page Container */}
        <main className="flex-grow overflow-y-auto p-6 md:p-8 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
