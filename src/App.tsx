import { useEffect, useState } from 'react';
import Lenis from 'lenis';
import { syncEngine } from './lib/syncEngine';
import { useSfaStore } from './stores/useSfaStore';
import { useAuthStore } from './stores/useAuthStore';
import Login from './modules/auth/views/Login';
import DashboardLayout from './layouts/DashboardLayout';
import ExecutiveOverview from './modules/admin/views/ExecutiveOverview';
import ManageUsers from './modules/admin/views/ManageUsers';
import BatchFormulation from './modules/erp/views/BatchFormulation';
import RecipeIngredients from './modules/erp/views/RecipeIngredients';
import MapRouteView from './modules/sfa/views/MapRouteView';
import VisitLogging from './modules/sfa/views/VisitLogging';
import DocumentCenter from './modules/creations/views/DocumentCenter';
import OperationalLog from './modules/creations/views/OperationalLog';
import HarvestTracker from './modules/farms/views/HarvestTracker';
import FarmRegistry from './modules/farms/views/FarmRegistry';
import { RoleGuard, rolePermissions } from './components/routing/RoleGuard';

export default function App() {
  const loadLocalOrders = useSfaStore((state) => state.loadLocalOrders);
  const user = useAuthStore((state) => state.user);
  
  // Track rendering session
  const [isAuthenticated, setIsAuthenticated] = useState(!!user);
  const [activeTab, setActiveTab] = useState('executive');
  const [searchQuery, setSearchQuery] = useState('');

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

    // 1. Load cached data instantly for snappy UX
    loadLocalOrders();

    // 2. Start listening for network reconnects
    syncEngine.initListeners();

    // 3. Attempt an initial sync just in case
    syncEngine.pushOrders();

    // 4. Global tactile audio feedback synthesis listener
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
  }, [loadLocalOrders]);

  // Redirect to first permitted tab if activeTab is not allowed for the role on sign-in
  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
      const allowed = rolePermissions[user.role];
      if (allowed && !allowed.includes(activeTab)) {
        setActiveTab(allowed[0] || 'executive');
      }
    } else {
      setIsAuthenticated(false);
    }
  }, [user, activeTab]);

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
      case 'erp-formulation':
        return (
          <RoleGuard userRole={user.role} viewId="erp-formulation">
            <BatchFormulation searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'erp-ingredients':
        return (
          <RoleGuard userRole={user.role} viewId="erp-ingredients">
            <RecipeIngredients searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'sfa-map':
        return (
          <RoleGuard userRole={user.role} viewId="sfa-map">
            <MapRouteView searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'sfa-visits':
        return (
          <RoleGuard userRole={user.role} viewId="sfa-visits">
            <VisitLogging searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'creations-vault':
        return (
          <RoleGuard userRole={user.role} viewId="creations-vault">
            <DocumentCenter searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'creations-audit':
        return (
          <RoleGuard userRole={user.role} viewId="creations-audit">
            <OperationalLog searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'farms-tracker':
        return (
          <RoleGuard userRole={user.role} viewId="farms-tracker">
            <HarvestTracker searchQuery={searchQuery} />
          </RoleGuard>
        );
      case 'farms-registry':
        return (
          <RoleGuard userRole={user.role} viewId="farms-registry">
            <FarmRegistry searchQuery={searchQuery} />
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

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={() => setIsAuthenticated(false)}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      {renderActiveView()}
    </DashboardLayout>
  );
}
