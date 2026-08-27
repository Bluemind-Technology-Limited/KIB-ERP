import type { UserRole } from '../../types';
import { ShieldAlert } from 'lucide-react';

// Role → permitted tabs. Matches the backend `UserRole` enum (separation of duties).
export const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    'executive',
    'admin-users',
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-procurement',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-orders',
    'prod-trace',
    'qa-inspections',
    'alerts-notifications',
    'reports',
  ],
  EXECUTIVE_ADMIN: [
    'executive',
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-procurement',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-orders',
    'prod-trace',
    'qa-inspections',
    'alerts-notifications',
    'reports',
  ],
  STORE_OFFICER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-procurement',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
  ],
  PRODUCTION_MANAGER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-procurement',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-orders',
    'prod-trace',
    'qa-inspections',
    'alerts-notifications',
  ],
  PROCUREMENT_OFFICER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-procurement',
    'inv-stock',
    'inv-grn',
    'alerts-notifications',
  ],
  QA_INSPECTOR: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'inv-stock',
    'inv-grn',
    'inv-finished',
    'qa-inspections',
    'prod-trace',
    'alerts-notifications',
  ],
};

interface RoleGuardProps {
  userRole: UserRole;
  viewId: string;
  children: React.ReactNode;
}

export function RoleGuard({ userRole, viewId, children }: RoleGuardProps) {
  const hasAccess = rolePermissions[userRole]?.includes(viewId);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Access Denied (403)</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your assigned workspace role (<span className="font-mono text-slate-300 font-semibold">{userRole}</span>) does not possess permission privileges required to access the <span className="font-semibold text-slate-200">{viewId.replace('-', ' ')}</span> interface.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
