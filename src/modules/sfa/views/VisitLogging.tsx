import { useState } from 'react';
import { Terminal, Shield, Cpu, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface VisitLoggingProps {
  searchQuery?: string;
}

export default function VisitLogging({ searchQuery = '' }: VisitLoggingProps) {
  // Hardcoded audit logs representing ecosystem-wide dashboard and app activity logs
  const initialAuditLogs = [
    { id: '1', timestamp: '2026-07-13 04:32:11', user: 'Alex Johnson', action: 'Sign in to KIB admin portal', system: 'Auth Service', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '2', timestamp: '2026-07-13 04:28:40', user: 'Isaac Wayne', action: 'Remove Ask AI button widget', system: 'Dashboard layout', ip: '192.168.1.11', status: 'SUCCESS' },
    { id: '3', timestamp: '2026-07-13 04:17:34', user: 'Isaac Wayne', action: 'Remove R2 storage buck details', system: 'ExecutiveOverview', ip: '192.168.1.11', status: 'SUCCESS' },
    { id: '4', timestamp: '2026-07-13 03:55:37', user: 'Alex Johnson', action: 'Change login switcher dropdown UI', system: 'Auth Service', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '5', timestamp: '2026-07-13 03:09:06', user: 'Isaac Wayne', action: 'Add connectivity state indicator', system: 'Dashboard layout', ip: '192.168.1.11', status: 'SUCCESS' },
    { id: '6', timestamp: '2026-07-13 02:49:13', user: 'Alex Johnson', action: 'Select SUPER_ADMIN persona', system: 'Auth Service', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '7', timestamp: '2026-07-13 02:30:11', user: 'Sarah Connor', action: 'Add formula binder ingredient', system: 'ERP Formulation', ip: '192.168.2.14', status: 'SUCCESS' },
    { id: '8', timestamp: '2026-07-13 02:15:02', user: 'John Doe', action: 'Register Emerald Valleys farm', system: 'Farm Registry', ip: '192.168.3.109', status: 'SUCCESS' },
    { id: '9', timestamp: '2026-07-13 02:08:44', user: 'Marcus Miller', action: 'Log customer visit check-in', system: 'SFA visits', ip: '192.168.4.88', status: 'SUCCESS' },
    { id: '10', timestamp: '2026-07-13 01:50:31', user: 'John Doe', action: 'Initialize crop logs DB', system: 'Harvest logs', ip: '192.168.3.109', status: 'SUCCESS' },
    { id: '11', timestamp: '2026-07-13 01:45:12', user: 'Alex Johnson', action: 'Update access token policies', system: 'IAM Engine', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '12', timestamp: '2026-07-13 01:30:08', user: 'Marcus Miller', action: 'Sync offline cached route data', system: 'Sync Engine', ip: '192.168.4.88', status: 'SUCCESS' },
    { id: '13', timestamp: '2026-07-13 01:12:44', user: 'Sarah Connor', action: 'Update concrete recipe silica mix', system: 'ERP Formulation', ip: '192.168.2.14', status: 'SUCCESS' },
    { id: '14', timestamp: '2026-07-13 00:55:01', user: 'Sarah Connor', action: 'Add Silica Fume material', system: 'Raw materials', ip: '192.168.2.14', status: 'SUCCESS' },
    { id: '15', timestamp: '2026-07-13 00:44:22', user: 'Alex Johnson', action: 'Purge obsolete creations vaults', system: 'Document Vault', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '16', timestamp: '2026-07-12 23:30:15', user: 'System Worker', action: 'Auto-sync local IndexedDB state', system: 'Sync Engine', ip: '127.0.0.1', status: 'SUCCESS' },
    { id: '17', timestamp: '2026-07-12 22:15:09', user: 'Marcus Miller', action: 'Sign out session request', system: 'Auth Service', ip: '192.168.4.88', status: 'SUCCESS' },
    { id: '18', timestamp: '2026-07-12 21:58:44', user: 'Sarah Connor', action: 'Delete experimental formulation', system: 'ERP Formulation', ip: '192.168.2.14', status: 'SUCCESS' },
    { id: '19', timestamp: '2026-07-12 21:12:00', user: 'John Doe', action: 'Add Westland Livestock property', system: 'Farm Registry', ip: '192.168.3.109', status: 'SUCCESS' },
    { id: '20', timestamp: '2026-07-12 20:45:51', user: 'Alex Johnson', action: 'Reset auth API secret keys', system: 'IAM Engine', ip: '192.168.1.45', status: 'SUCCESS' },
    { id: '21', timestamp: '2026-07-12 19:33:04', user: 'System Worker', action: 'Reconcile local IndexedDB caches', system: 'Sync Engine', ip: '127.0.0.1', status: 'SUCCESS' },
    { id: '22', timestamp: '2026-07-12 18:22:19', user: 'Marcus Miller', action: 'Check route map coordinates', system: 'SFA maps', ip: '192.168.4.88', status: 'SUCCESS' },
    { id: '23', timestamp: '2026-07-12 17:11:45', user: 'John Doe', action: 'Export harvest Yield logs', system: 'Harvest logs', ip: '192.168.3.109', status: 'SUCCESS' },
    { id: '24', timestamp: '2026-07-12 16:55:00', user: 'Sarah Connor', action: 'Modify cement binder mix ratio', system: 'ERP Formulation', ip: '192.168.2.14', status: 'SUCCESS' },
    { id: '25', timestamp: '2026-07-12 15:40:12', user: 'Alex Johnson', action: 'Grant production operator role', system: 'IAM Engine', ip: '192.168.1.45', status: 'SUCCESS' }
  ];

  // Filter logs by search query
  const filteredLogs = initialAuditLogs.filter((log) => 
    log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.system.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ip.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // Compute items slice for active page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">Ecosystem Audit Logs</h2>
          <p className="text-xs text-[#737373]">Review operations, authentication logs, and data entries across all dashboard namespaces.</p>
        </div>
        <button
          onClick={() => setCurrentPage(1)}
          className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reload Logs</span>
        </button>
      </div>

      <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#EA4335]" />
            Ecosystem Security &amp; Activity Log
          </h3>
          <span className="text-[10px] text-slate-400 font-mono font-medium">
            Showing {startIndex + 1}-{endIndex} of {totalItems} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-3 font-semibold">Operator</th>
                <th className="py-3.5 px-3 font-semibold">Action Performed</th>
                <th className="py-3.5 px-3 font-semibold">System Area</th>
                <th className="py-3.5 px-3 font-semibold">IP Address</th>
                <th className="py-3.5 px-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E9]">
              {currentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">{log.timestamp}</td>
                  <td className="py-4 px-3">
                    <span className="font-semibold text-[#313131]">{log.user}</span>
                  </td>
                  <td className="py-4 px-3 text-[#313131] font-medium">{log.action}</td>
                  <td className="py-4 px-3 text-slate-500 font-mono text-[10px]">{log.system}</td>
                  <td className="py-4 px-3 text-slate-400 font-mono text-[11px]">{log.ip}</td>
                  <td className="py-4 px-4 text-right">
                    <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-650 border border-emerald-500/20 uppercase">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t border-[#E9E9E9] pt-4 mt-4">
          <span className="text-xs text-[#737373]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer bg-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer bg-white"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
