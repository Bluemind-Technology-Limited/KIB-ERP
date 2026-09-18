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
    'proc-requisitions',
    'proc-actions',
    'proc-procurements',
    'proc-consignments',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-plans',
    'prod-orders',
    'prod-trace',
    'prod-supervisor',
    'prod-issue',
    'prod-grinding',
    'prod-finishing',
    'machines',
    'qa-inspections',
    'qa-consignments',
    'qa-quantity-approvals',
    'alerts-notifications',
    'admin-audit',
    'reports',
    'reports-inspections',
    'reports-audit',
    'cost-management',
  ],
  EXECUTIVE_ADMIN: [
    'executive',
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-requisitions',
    'proc-actions',
    'proc-procurements',
    'proc-consignments',
    'inv-stock',
    'inv-daily-prod',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-plans',
    'prod-orders',
    'prod-trace',
    'prod-supervisor',
    'prod-issue',
    'prod-grinding',
    'prod-finishing',
    'machines',
    'qa-inspections',
    'qa-consignments',
    'alerts-notifications',
    'admin-audit',
    'reports',
    'reports-inspections',
    'reports-audit',
    'cost-management',
  ],
  STORE_OFFICER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-requisitions',
    'inv-stock',
    'inv-grn',
    'inv-finished',
    'prod-issue',
    'machines',
    'cost-management',
  ],
  PRODUCTION_MANAGER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-requisitions',
    'proc-actions',
    'inv-stock',
    'inv-grn',
    'inv-finished',
    'prod-boms',
    'prod-plans',
    'prod-orders',
    'inv-daily-prod',
    'prod-trace',
    'prod-issue',
    'prod-grinding',
    'prod-finishing',
    'machines',
    'qa-inspections',
    'alerts-notifications',
    'reports',
    'reports-audit',
    'cost-management',
  ],
  PROCUREMENT_OFFICER: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'proc-requisitions',
    'proc-actions',
    'proc-procurements',
    'proc-consignments',
    'inv-stock',
    'inv-grn',
    'machines',
    'alerts-notifications',
    'cost-management',
  ],
  QC: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'inv-stock',
    'inv-grn',
    'inv-finished',
    'machines',
    'qa-inspections',
    'qa-consignments',
    'prod-trace',
    'alerts-notifications',
    'cost-management',
  ],
  HEAD_OF_QC: [
    'md-warehouses',
    'md-materials',
    'md-suppliers',
    'inv-stock',
    'inv-grn',
    'inv-finished',
    'machines',
    'qa-inspections',
    'qa-consignments',
    'qa-quantity-approvals',
    'reports-inspections',
    'prod-trace',
    'alerts-notifications',
    'cost-management',
  ],
  PRODUCTION_SUPERVISOR: [
    'md-warehouses',
    'md-materials',
    'prod-supervisor',
    'prod-plans',
    'prod-orders',
    'prod-trace',
    'prod-finishing',
    'machines',
    'alerts-notifications',
    'cost-management',
  ],
  GRINDING_SUPERVISOR: [
    'md-materials',
    'inv-stock',
    'prod-plans',
    'prod-orders',
    'prod-trace',
    'prod-grinding',
    'machines',
    'alerts-notifications',
  ],
  OPERATOR: [
    'machines',
    'alerts-notifications',
  ],
  TECHNICIAN: [
    'machines',
    'alerts-notifications',
    'reports',
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
