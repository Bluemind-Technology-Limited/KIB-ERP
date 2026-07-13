import { useState } from 'react';
import { 
  Search, Compass, Sprout, LayoutDashboard, TrendingUp, FolderClosed, LogOut, 
  ChevronDown, ChevronRight, Map, LogIn, FileText, Database, ShieldAlert, 
  HeartHandshake, ExternalLink, Settings, Terminal, Users 
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { rolePermissions } from './routing/RoleGuard';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onSearchClick: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onLogout, isCollapsed, setIsCollapsed, onSearchClick }: SidebarProps) {
  const user = useAuthStore((state) => state.user);

  // Keep track of expanded module accordion sections for the expanded sidebar
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    erp: true,
    sfa: true,
    creations: true,
    farms: true,
  });

  const toggleGroup = (groupId: string) => {
    setExpanded(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Nav Groups hierarchy
  const navGroups = [
    {
      id: 'erp',
      title: 'Production ERP',
      icon: TrendingUp,
      items: [
        { id: 'erp-formulation', name: 'Batch Formulation', icon: Database },
        { id: 'erp-ingredients', name: 'Recipe Ingredients', icon: Database },
      ],
    },
    {
      id: 'sfa',
      title: 'Ecosystem Logs & Map',
      icon: Compass,
      items: [
        { id: 'sfa-map', name: 'Properties Map', icon: Map },
        { id: 'sfa-visits', name: 'Audit Logs', icon: Terminal },
      ],
    },
    {
      id: 'creations',
      title: 'Creations Vault',
      icon: FolderClosed,
      items: [
        { id: 'creations-vault', name: 'Document Vault', icon: FileText },
        { id: 'creations-audit', name: 'Financial Audits', icon: ShieldAlert },
      ],
    },
    {
      id: 'farms',
      title: 'Harvest Registry',
      icon: Sprout,
      items: [
        { id: 'farms-tracker', name: 'Harvest Logs', icon: Sprout },
        { id: 'farms-registry', name: 'Farm Registry', icon: HeartHandshake },
      ],
    },
  ];

  // List of all items flat for the collapsed sidebar quick list mapping
  const allCollapsedItems = [
    { id: 'executive', name: 'Overview', icon: LayoutDashboard },
    { id: 'admin-users', name: 'Manage Users', icon: Users },
    { id: 'erp-formulation', name: 'Batch Formulation', icon: Database },
    { id: 'erp-ingredients', name: 'Recipe Ingredients', icon: Database },
    { id: 'sfa-map', name: 'Properties Map', icon: Map },
    { id: 'sfa-visits', name: 'Audit Logs', icon: Terminal },
    { id: 'creations-vault', name: 'Document Vault', icon: FileText },
    { id: 'creations-audit', name: 'Financial Audits', icon: ShieldAlert },
    { id: 'farms-tracker', name: 'Harvest Logs', icon: Sprout },
    { id: 'farms-registry', name: 'Farm Registry', icon: HeartHandshake },
  ];

  const allowedViews = user ? rolePermissions[user.role] : [];
  const showAccountHome = allowedViews.includes('executive');

  const filteredNavGroups = navGroups.map(group => {
    const filteredItems = group.items.filter(item => allowedViews.includes(item.id));
    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  const filteredCollapsedItems = allCollapsedItems.filter(item => allowedViews.includes(item.id));

  // --- COLLAPSED VIEW SIDEBAR ---
  if (isCollapsed) {
    return (
      <aside data-lenis-prevent className="w-[56px] h-screen bg-[#FBFBFB] border-r border-[#D9D9D9] flex flex-col justify-between items-center font-sans shrink-0 py-3 z-30 relative">
        {/* Absolute Peg Extension Button */}
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute top-1/2 -translate-y-1/2 right-[-20px] w-[20px] h-[50px] bg-[#FBFBFB] border border-l-0 border-[#D9D9D9] rounded-r-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors z-50 focus:outline-none"
          style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.02)' }}
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <div className="flex flex-col items-center gap-4 w-full">
          {/* Unframed Logo (h-7 size) */}
          <img src="/KIB.png" alt="KIB Group logo" className="h-7 object-contain cursor-pointer" onClick={() => setIsCollapsed(false)} />

          {/* Flat scrollable menu icons */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto max-h-[50vh]">
            {filteredCollapsedItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'executive' && activeTab === 'executive');

              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-[#F3F3F3] text-[#171717] font-semibold border border-slate-200/50' 
                        : 'text-[#171717]/85 hover:bg-slate-100/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 opacity-70 shrink-0" />
                  </button>
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 bg-[#171717] text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                    {item.name}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* External links represented as quick links on collapsed mode */}
          {user?.role === 'SUPER_ADMIN' && (
            <>
              <div className="w-8 border-b border-slate-200" />
              <div className="flex flex-col items-center gap-1.5 w-full">
                <div className="relative group">
                  <a
                    href="https://amawonda.kibgroup.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 flex items-center justify-center btn-3d rounded-lg cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </a>
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 bg-[#171717] text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                    Amawonda Admin
                  </div>
                </div>

                <div className="relative group">
                  <a
                    href="http://farms.kibgroup.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 flex items-center justify-center btn-3d rounded-lg cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </a>
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 bg-[#171717] text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                    KIB Stock Admin
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </aside>
    );
  }

  // --- EXPANDED VIEW SIDEBAR ---
  return (
    <aside data-lenis-prevent className="w-[260px] h-screen bg-[#FBFBFB] border-r border-[#D9D9D9] flex flex-col justify-between font-sans shrink-0 z-30 relative">
      {/* Absolute Peg Extension Button */}
      <button
        onClick={() => setIsCollapsed(true)}
        className="absolute top-1/2 -translate-y-1/2 right-[-20px] w-[20px] h-[50px] bg-[#FBFBFB] border border-l-0 border-[#D9D9D9] rounded-r-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors z-50 focus:outline-none"
        style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.02)' }}
      >
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 rotate-180" />
      </button>

      {/* Upper Container */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Header Profile Section (58px height) */}
        <div className="h-[58px] border-b border-[#D9D9D9]/80 flex items-center px-4 gap-3">
          {/* Brand Logo Container */}
          <img src="/KIB.png" alt="KIB Group logo" className="h-8 object-contain shrink-0" />

          {/* User Account Text (13px, weight 500) */}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#171717] leading-tight truncate">
              {user?.email || 'isaacwayneagabi@gmail.com'}
            </p>
            <p className="text-[10px] text-slate-450 uppercase tracking-wider font-mono">
              {user?.role?.replace('_', ' ') || 'Super Admin'}
            </p>
          </div>
        </div>

        {/* Scrollable Nav Items list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

          {/* Nav list */}
          <div className="space-y-2">
            
            {/* Account Home (Overview) */}
            {showAccountHome && (
              <button
                onClick={() => setActiveTab('executive')}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                  activeTab === 'executive' 
                    ? 'bg-[#F3F3F3] text-[#171717] font-semibold border border-slate-200/50' 
                    : 'text-[#171717] hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <LayoutDashboard className="w-4 h-4 text-[#171717] opacity-60" />
                  <span className="text-[13px]">Overview</span>
                </div>
              </button>
            )}

            {/* Manage Users Link (Super Admin only) */}
            {user?.role === 'SUPER_ADMIN' && allowedViews.includes('admin-users') && (
              <button
                onClick={() => setActiveTab('admin-users')}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                  activeTab === 'admin-users' 
                    ? 'bg-[#F3F3F3] text-[#171717] font-semibold border border-slate-200/50' 
                    : 'text-[#171717] hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <Users className="w-4 h-4 text-[#171717] opacity-60" />
                  <span className="text-[13px]">Manage Users</span>
                </div>
              </button>
            )}

            {/* Collapsible Module Submenus */}
            {filteredNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expanded[group.id];

              return (
                <div key={group.id} className="space-y-0.5">
                  {/* Accordion header button */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <GroupIcon className="w-3.5 h-3.5 opacity-60" />
                      <span>{group.title}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>

                  {/* Sub-items list */}
                  {isExpanded && (
                    <div className="pl-4 border-l border-slate-200 ml-5 space-y-0.5 animate-in slide-in-from-top-1 duration-100">
                      {group.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeTab === subItem.id;
                        return (
                          <button
                            key={subItem.id}
                            onClick={() => setActiveTab(subItem.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                              isSubActive 
                                ? 'bg-[#F3F3F3] text-[#171717] font-semibold border border-slate-200/50' 
                                : 'text-[#171717]/85 hover:bg-slate-100/60'
                            }`}
                          >
                            <SubIcon className="w-3 h-3 opacity-40 shrink-0" />
                            <span className="truncate">{subItem.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Super Admin External Menu Connections */}
            {user?.role === 'SUPER_ADMIN' && (
              <div className="pt-4 border-t border-[#D9D9D9]/80 space-y-2">
                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Admin Integrations
                </p>
                <div className="space-y-1.5 px-1">
                  <a
                    href="https://amawonda.kibgroup.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-8 btn-3d flex items-center justify-between px-3 text-white text-[11px] font-semibold active:scale-98 transition-transform cursor-pointer"
                  >
                    <span>Amawonda Admin</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white/80" />
                  </a>
                  <a
                    href="http://farms.kibgroup.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-8 btn-3d flex items-center justify-between px-3 text-white text-[11px] font-semibold active:scale-98 transition-transform cursor-pointer"
                  >
                    <span>KIB Stock Admin</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white/80" />
                  </a>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Footer controls: Sign Out */}
      <div className="p-3 border-t border-[#D9D9D9]/80 bg-[#FBFBFB]">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 hover:bg-rose-50/50 hover:border-rose-250 text-slate-650 hover:text-rose-650 text-xs font-semibold rounded-lg transition-all cursor-pointer bg-white"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Account</span>
        </button>
      </div>

    </aside>
  );
}
