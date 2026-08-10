import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { RefreshCw, HeartHandshake, Boxes, Factory, ShieldCheck, Warehouse, PackageCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';

interface Metrics {
  materials: number;
  warehouses: number;
  suppliers: number;
  productionOrders: number;
  pendingInspections: number;
  finishedGoodsQty: number;
  ordersByStatus: Array<{ status: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#94A3B8',
  PROCESSING: '#F59E0B',
  COMPLETED: '#10B981',
  WASTED: '#F43F5E',
};

export default function ExecutiveOverview() {
  const user = useAuthStore((state) => state.user);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [matRes, whRes, supRes, poRes, qaRes, fgRes] = await Promise.all([
        axiosClient.get<{ materials: unknown[] }>('/master-data/materials'),
        axiosClient.get<{ warehouses: unknown[] }>('/master-data/warehouses'),
        axiosClient.get<{ suppliers: unknown[] }>('/master-data/suppliers'),
        axiosClient.get<{ productionOrders: Array<{ status: string }> }>('/production/production-orders'),
        axiosClient.get<{ inspections: Array<{ result: string }> }>('/qa/inspections'),
        axiosClient.get<{ finishedGoods: Array<{ quantity: number }> }>('/inventory/finished-goods'),
      ]);

      const orders = poRes.data.productionOrders;
      const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {});

      setMetrics({
        materials: matRes.data.materials.length,
        warehouses: whRes.data.warehouses.length,
        suppliers: supRes.data.suppliers.length,
        productionOrders: orders.length,
        pendingInspections: qaRes.data.inspections.filter((i) => i.result === 'PENDING').length,
        finishedGoodsQty: fgRes.data.finishedGoods.reduce((sum, r) => sum + Number(r.quantity), 0),
        ordersByStatus: Object.keys(STATUS_COLORS).map((status) => ({
          status,
          count: statusCounts[status] ?? 0,
        })),
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load metrics. Is the backend running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <div className="space-y-8 text-[#171717]">
      {/* 1. Header Overview welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">
            Welcome back, {user?.fullName || 'Admin'}
          </h2>
          <p className="text-[#737373] text-xs">Live ERP state across procurement, inventory, production and quality.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer bg-white disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {loading && (
        <div className="space-y-6">
          {/* Metric cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E9E9E9] rounded-lg flex items-center gap-3 px-4 py-3">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
          </div>
        ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-white border border-[#E9E9E9] rounded-lg h-[400px] p-4 space-y-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      )}

      {metrics && !loading && (
        <>
          {/* 2. Top Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <MetricCard
              label="Materials"
              icon={<Boxes className="w-4 h-4 text-[#EA4335]" />}
              value={metrics.materials}
              sub="Registered SKUs"
            />
            <MetricCard
              label="Warehouses"
              icon={<Warehouse className="w-4 h-4 text-[#EA4335]" />}
              value={metrics.warehouses}
              sub="Storage locations"
            />
            <MetricCard
              label="Suppliers"
              icon={<HeartHandshake className="w-4 h-4 text-[#EA4335]" />}
              value={metrics.suppliers}
              sub="Approved vendors"
            />
            <MetricCard
              label="Production Orders"
              icon={<Factory className="w-4 h-4 text-amber-600" />}
              value={metrics.productionOrders}
              sub="Scheduled / running"
            />
            <MetricCard
              label="Pending QA"
              icon={<ShieldCheck className="w-4 h-4 text-sky-600" />}
              value={metrics.pendingInspections}
              sub="Awaiting release"
            />
            <MetricCard
              label="Finished Goods"
              icon={<PackageCheck className="w-4 h-4 text-emerald-600" />}
              value={metrics.finishedGoodsQty}
              sub="Units on-hand"
            />
          </div>

          {/* 3. Recharts Bar: Production orders by status */}
          <div className="bg-[#F8F8F8] border border-[#E9E9E9] rounded-lg overflow-hidden flex flex-col w-full h-[400px] mb-6">
            <div className="bg-[#F8F8F8] px-4 py-3.5 border-b border-[#E9E9E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#EA4335]" />
                <span className="text-xs font-semibold text-[#737373]">Production orders by status</span>
              </div>
              <span className="text-[11px] font-semibold bg-white border border-slate-200 rounded-md px-2.5 py-1 text-[#171717]">
                {user?.email || 'Signed in'}
              </span>
            </div>

            <div className="flex-1 bg-white p-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.ordersByStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F2" />
                  <XAxis
                    dataKey="status"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#737373', fontSize: 10, fontWeight: 500 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#737373', fontSize: 10, fontWeight: 500 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E9E9E9', borderRadius: '8px', fontSize: '11px', color: '#171717' }}
                    labelClassName="font-bold text-[#171717]"
                    cursor={{ fill: '#F8F8F8' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {metrics.ordersByStatus.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#EA4335'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-[#E9E9E9] rounded-lg flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-lg border border-[#E9E9E9] bg-slate-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-lg font-bold text-[#171717] leading-none">{value}</h4>
          <span className="text-[10px] text-slate-400 truncate">{sub}</span>
        </div>
      </div>
    </div>
  );
}
