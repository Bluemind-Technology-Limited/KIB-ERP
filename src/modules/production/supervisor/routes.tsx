import type { RouteObject } from 'react-router-dom';
import SupervisorDashboard from './SupervisorDashboard';
import PlanDetailView from './PlanDetailView';
import ReconciliationHistory from './ReconciliationHistory';

export const supervisorRoutes: RouteObject[] = [
  {
    index: true,
    element: <SupervisorDashboard />,
  },
  {
    path: 'plans/:planId',
    element: <PlanDetailView />,
  },
  {
    path: 'plans/:planId/reconciliation-history',
    element: <ReconciliationHistory />,
  },
];
