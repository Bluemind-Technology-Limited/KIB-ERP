import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { useAuthStore } from './stores/useAuthStore';
import Login from './modules/auth/views/Login';
import DashboardLayout from './layouts/DashboardLayout';
import ExecutiveOverview from './modules/admin/views/ExecutiveOverview';
import ManageUsers from './modules/admin/views/ManageUsers';
import { RoleGuard, rolePermissions } from './components/routing/RoleGuard';
import Warehouses from './modules/masterdata/views/Warehouses';
import Materials from './modules/masterdata/views/Materials';
import Suppliers from './modules/masterdata/views/Suppliers';
import Procurement from './modules/procurement/views/Procurement';
import Inventory from './modules/inventory/views/Inventory';
import GRN from './modules/inventory/views/GRN';
import FinishedGoods from './modules/inventory/views/FinishedGoods';
import BOM from './modules/production/views/BOM';
import ProductionOrders from './modules/production/views/ProductionOrders';
import Traceability from './modules/production/views/Traceability';
import Inspections from './modules/qa/views/Inspections';
import Notifications from './modules/alerts/views/Notifications';
import Reports from './modules/reports/views/Reports';

/**
 * URL routes for every dashboard page. Keys are the view ids used by the
 * sidebar / RoleGuard; each maps to a clean path.
 */
const VIEW_ROUTES: Record<string, { path: string; parent: string; label: string }> = {
  executive: { path: '/overview', parent: 'Dashboards', label: 'Overview' },
  'admin-users': { path: '/users', parent: 'Dashboards', label: 'Manage Users' },
  'md-warehouses': { path: '/master-data/warehouses', parent: 'Master Data', label: 'Warehouses' },
  'md-materials': { path: '/master-data/materials', parent: 'Master Data', label: 'Materials' },
  'md-suppliers': { path: '/master-data/suppliers', parent: 'Master Data', label: 'Suppliers' },
  'proc-procurement': { path: '/procurement', parent: 'Procurement', label: 'Requisitions & POs' },
  'inv-stock': { path: '/inventory/stock', parent: 'Inventory', label: 'Stock Ledger' },
  'inv-grn': { path: '/inventory/grn', parent: 'Inventory', label: 'Goods Receipt' },
  'inv-finished': { path: '/inventory/finished-goods', parent: 'Inventory', label: 'Finished Goods' },
  'prod-boms': { path: '/production/boms', parent: 'Production', label: 'Bill of Materials' },
  'prod-orders': { path: '/production/orders', parent: 'Production', label: 'Production Orders' },
  'prod-trace': { path: '/production/traceability', parent: 'Production', label: 'Traceability' },
  'qa-inspections': { path: '/quality/inspections', parent: 'Quality Assurance', label: 'Inspections' },
  'alerts-notifications': { path: '/alerts/notifications', parent: 'Alerts & Reports', label: 'Notifications' },
  reports: { path: '/reports', parent: 'Alerts & Reports', label: 'Reports' },
};

const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_ROUTES).map(([id, { path }]) => [path, id])
);

export default function App() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const logout = useAuthStore((state) => state.logout);

  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');

  // Derive the active tab from the URL (e.g. /overview -> executive).
  const activeTab = PATH_TO_VIEW[location.pathname] ?? '';

  const setActiveTab = (tab: string) => {
    const route = VIEW_ROUTES[tab];
    if (route) navigate(route.path);
  };

  // Restore the Supabase session on boot so a reload keeps you signed in.
  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    // Initialize Lenis smooth scroll
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Global tactile audio feedback synthesis listener
    const playClickSound = () => {
      // Try playing custom click.mp3 uploaded to public folder first
      const audio = new Audio('/click.mp3');
      audio.volume = 0.45;
      audio.play().catch(() => {
        // Fall back to synthesized mechanical bubble pop if click.mp3 doesn't exist yet
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sine';
          // Mechanical tick synthesis: rapid exponential pitch drop
          osc.frequency.setValueAtTime(900, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.06);

          // Keep volume low and tactile
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start();
          osc.stop(audioCtx.currentTime + 0.06);
        } catch {
          // Fail silently if AudioContext is blocked by browser policies
        }
      });
    };

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
        playClickSound();
      }
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
      lenis.destroy();
    };
  }, []);

  // Redirect to the first permitted tab if the current route isn't allowed for the role
  useEffect(() => {
    if (!user) return;
    const allowed = rolePermissions[user.role] ?? [];
    if (!allowed.includes(activeTab)) {
      navigate(VIEW_ROUTES[allowed[0] || 'executive'].path, { replace: true });
    }
  }, [user, activeTab, navigate]);

  const renderActiveView = () => {
    if (!user) return null;

    switch (activeTab) {
      case 'executive':
        return (
          <RoleGuard userRole={user.role} viewId="executive">
            <ExecutiveOverview />
          </RoleGuard>
        );
      case 'admin-users':
        return (
          <RoleGuard userRole={user.role} viewId="admin-users">
            <ManageUsers searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'md-warehouses':
        return (
          <RoleGuard userRole={user.role} viewId="md-warehouses">
            <Warehouses searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'md-materials':
        return (
          <RoleGuard userRole={user.role} viewId="md-materials">
            <Materials searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'md-suppliers':
        return (
          <RoleGuard userRole={user.role} viewId="md-suppliers">
            <Suppliers searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'proc-procurement':
        return (
          <RoleGuard userRole={user.role} viewId="proc-procurement">
            <Procurement searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'inv-stock':
        return (
          <RoleGuard userRole={user.role} viewId="inv-stock">
            <Inventory searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'inv-grn':
        return (
          <RoleGuard userRole={user.role} viewId="inv-grn">
            <GRN searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'inv-finished':
        return (
          <RoleGuard userRole={user.role} viewId="inv-finished">
            <FinishedGoods searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'prod-boms':
        return (
          <RoleGuard userRole={user.role} viewId="prod-boms">
            <BOM searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'prod-orders':
        return (
          <RoleGuard userRole={user.role} viewId="prod-orders">
            <ProductionOrders searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'prod-trace':
        return (
          <RoleGuard userRole={user.role} viewId="prod-trace">
            <Traceability searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'qa-inspections':
        return (
          <RoleGuard userRole={user.role} viewId="qa-inspections">
            <Inspections searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'alerts-notifications':
        return (
          <RoleGuard userRole={user.role} viewId="alerts-notifications">
            <Notifications searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'reports':
        return (
          <RoleGuard userRole={user.role} viewId="reports">
            <Reports searchQuery={searchQuery} />
          </RoleGuard>
        );
      default:
        return (
          <RoleGuard userRole={user.role} viewId="executive">
            <ExecutiveOverview />
          </RoleGuard>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#E9E9E9] border-t-[#EA4335] animate-spin" />
          <p className="text-xs text-slate-400">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Unknown path (e.g. a stale link) while signed in -> first permitted route.
  if (!activeTab) {
    const first = rolePermissions[user.role]?.[0] || 'executive';
    return <Navigate to={VIEW_ROUTES[first].path} replace />;
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={() => logout()}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      {renderActiveView()}
    </DashboardLayout>
  );
}
