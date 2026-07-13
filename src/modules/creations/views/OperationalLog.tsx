import { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface OperationalLogProps {
  searchQuery?: string;
}

export default function OperationalLog({ searchQuery = '' }: OperationalLogProps) {
  const [logs] = useState([
    { id: '1', txId: 'TX-90112', amount: 4500, gateway: 'QuickBooks OAuth2', status: 'SYNCHRONIZED', date: '2026-07-12T19:22:00Z' },
    { id: '2', txId: 'TX-90113', amount: 1200, gateway: 'QuickBooks OAuth2', status: 'SYNCHRONIZED', date: '2026-07-12T20:10:00Z' },
    { id: '3', txId: 'TX-90114', amount: 800, gateway: 'QuickBooks OAuth2', status: 'FAILED', date: '2026-07-12T20:15:00Z' },
  ]);

  const filteredLogs = logs.filter(log =>
    log.txId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.gateway.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-[#171717]">
      <div>
        <h2 className="text-xl font-bold text-[#171717]">Financial Sync &amp; Audit Logs</h2>
        <p className="text-xs text-[#737373]">Audit automated integrations synchronizing finalized transactions with the QuickBooks core ledger.</p>
      </div>

      <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#EA4335]" />
            QuickBooks Transaction Synchronization
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                <th className="py-2.5 px-3 font-semibold">Transaction ID</th>
                <th className="py-2.5 px-3 font-semibold">Gateway Partner</th>
                <th className="py-2.5 px-3 text-right font-semibold">Value Amount</th>
                <th className="py-2.5 px-3 text-right font-semibold">Date Executed</th>
                <th className="py-2.5 px-3 text-right font-semibold">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E9]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[#313131] font-semibold">{log.txId}</span>
                  </td>
                  <td className="py-3 px-3 text-[#737373]">{log.gateway}</td>
                  <td className="py-3 px-3 text-right text-[#313131] font-bold">${log.amount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-[#737373]">{new Date(log.date).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      log.status === 'SYNCHRONIZED' ? 'bg-emerald-500/10 text-emerald-650 border border-emerald-555/20' :
                      'bg-rose-500/10 text-[#EA4335] border border-[#EA4335]/25'
                    }`}>
                      {log.status === 'FAILED' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
