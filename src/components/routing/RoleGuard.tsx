import type { UserRole } from '../../types';
import { ShieldAlert } from 'lucide-react';

// Define the matrix mapping roles to permitted tabs/views
export const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    'executive',
    'admin-users',
    'erp-formulation',
    'erp-ingredients',
    'sfa-map',
    'sfa-visits',
    'creations-vault',
    'creations-audit',
    'farms-tracker',
    'farms-registry',
  ],
  EXECUTIVE_ADMIN: [
    'executive',
    'erp-formulation',
    'erp-ingredients',
    'sfa-map',
    'sfa-visits',
    'creations-vault',
    'creations-audit',
    'farms-tracker',
    'farms-registry',
  ],
  PRODUCTION_MANAGER: [
    'erp-formulation',
    'erp-ingredients',
    'farms-tracker',
    'farms-registry',
  ],
  INVENTORY_OFFICER: [
    'erp-formulation',
    'erp-ingredients',
  ],
  SALES_MANAGER: [
    'sfa-map',
    'sfa-visits',
  ],
  SALES_REP: [
    'sfa-map',
    'sfa-visits',
  ],
  FARM_MANAGER: [
    'farms-tracker',
    'farms-registry',
  ],
  OPERATIONS_OFFICER: [
    'erp-formulation',
    'creations-vault',
    'farms-tracker',
    'farms-registry',
  ],
  DISTRIBUTOR: [
    'sfa-visits',
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
