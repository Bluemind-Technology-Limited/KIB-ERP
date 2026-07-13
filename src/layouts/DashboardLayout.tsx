import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuthStore } from '../stores/useAuthStore';
import { rolePermissions } from '../components/routing/RoleGuard';
import { 
  ChevronRight, HelpCircle, User as UserIcon, Menu, X, LogOut, Settings, Users, Search 
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

  const allowedViews = user ? rolePermissions[user.role] || [] : [];

  const searchItems = [
    { id: 'executive', name: 'Overview', desc: 'Main executive traffic and metrics overview dashboard', category: 'Dashboards' },
    { id: 'admin-users', name: 'Manage Users', desc: 'Provision user accounts and view credentials', category: 'Dashboards' },
    { id: 'erp-formulation', name: 'Batch Formulation', desc: 'Configure recipe batches and trigger formulations', category: 'Production ERP' },
    { id: 'erp-ingredients', name: 'Recipe Ingredients', desc: 'Material catalog definitions and costing metrics', category: 'Production ERP' },
    { id: 'sfa-map', name: 'Properties Map', desc: 'Map directory pointing out farm properties on Mapbox GL', category: 'Ecosystem Logs & Map' },
    { id: 'sfa-visits', name: 'Audit Logs', desc: 'Review ecosystem-wide dashboard operator audit logs', category: 'Ecosystem Logs & Map' },
    { id: 'creations-vault', name: 'Document Vault', desc: 'Secure cloud assets storage vault', category: 'Creations Vault' },
    { id: 'creations-audit', name: 'Financial Audits', desc: 'Reconcile compliance and financial ledgers', category: 'Creations Vault' },
    { id: 'farms-tracker', name: 'Harvest Logs', desc: 'Log crop and yield data entries', category: 'Harvest Registry' },
    { id: 'farms-registry', name: 'Farm Registry', desc: 'Register farm properties and coordinates', category: 'Harvest Registry' },
  ].filter(item => allowedViews.includes(item.id));

  const filteredSearchItems = searchItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      case 'erp-formulation':
        return { parent: 'Production ERP', current: 'Batch Formulation' };
      case 'erp-ingredients':
        return { parent: 'Production ERP', current: 'Recipe Ingredients' };
      case 'sfa-map':
        return { parent: 'Ecosystem Logs & Map', current: 'Properties Map' };
      case 'sfa-visits':
        return { parent: 'Ecosystem Logs & Map', current: 'Audit Logs' };
      case 'creations-vault':
        return { parent: 'Creations Vault', current: 'Document Vault' };
      case 'creations-audit':
        return { parent: 'Creations Vault', current: 'Financial Audits' };
      case 'farms-tracker':
        return { parent: 'Harvest Registry', current: 'Harvest Logs' };
      case 'farms-registry':
        return { parent: 'Harvest Registry', current: 'Farm Registry' };
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
          onSearchClick={() => setIsSearchOpen(true)}
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
            <button
              type="button"
              className="w-[98px] h-8 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-[#171717] transition-colors cursor-pointer bg-white"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Support</span>
            </button>

            {/* Premium User Avatar with online indicator */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="relative focus:outline-none cursor-pointer group flex items-center"
              >
                <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-[#171717] uppercase transition-colors">
                  {user?.full_name?.slice(0, 2) || <UserIcon className="w-4 h-4 text-slate-400" />}
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
                        {user?.full_name?.split(' ')[0] || 'Isaac'}
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
                onClick={() => { setActiveTab('erp-formulation'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'erp-formulation' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                ERP Batch Formulation
              </button>
              <button
                onClick={() => { setActiveTab('sfa-map'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'sfa-map' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                SFA Map Route
              </button>
              <button
                onClick={() => { setActiveTab('creations-vault'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'creations-vault' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                Creations Vault
              </button>
              <button
                onClick={() => { setActiveTab('farms-tracker'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'farms-tracker' ? 'bg-slate-100 text-[#171717]' : 'text-slate-600'}`}
              >
                Harvest Registry
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
