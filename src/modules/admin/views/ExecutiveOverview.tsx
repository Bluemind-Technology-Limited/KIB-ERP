import { useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { 
  RefreshCw, ChevronRight, Activity, MapPin, CheckCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function ExecutiveOverview() {
  const user = useAuthStore((state) => state.user);

  // Mock Recharts chart data
  const chartData = [
    { time: '00:00', requests: 120 },
    { time: '02:00', requests: 150 },
    { time: '04:00', requests: 80 },
    { time: '06:00', requests: 310 },
    { time: '08:00', requests: 450 },
    { time: '10:00', requests: 620 },
    { time: '12:00', requests: 890 },
    { time: '14:00', requests: 750 },
    { time: '16:00', requests: 820 },
    { time: '18:00', requests: 980 },
    { time: '20:00', requests: 1120 },
    { time: '22:00', requests: 850 },
  ];

  return (
    <div className="space-y-8 text-[#171717]">
      
      {/* 1. Header Overview welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Welcome back, {user?.full_name || 'Isaac Wayne'}</h2>
          <p className="text-[#737373] text-xs">Ecosystem state metrics across all integrated production, distribution, and harvesting centers.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* 2. Top Overview Cards (Figma style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Visits */}
        <div className="bg-[#F8F8F8] border border-[#E9E9E9] rounded-lg flex flex-col justify-between h-[136px]">
          <div className="flex items-center justify-between p-4 bg-[#F8F8F8] rounded-t-lg">
            <span className="text-xs font-semibold text-[#737373] tracking-tight">Total Visits</span>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] text-[#313131] font-semibold">
              <span>Last 24h</span>
              <ChevronRight className="w-3 h-3 rotate-90 text-slate-400" />
            </div>
          </div>
          <div className="p-4 bg-white border-t border-[#E5E5E5] rounded-b-lg flex-1 flex flex-col justify-center">
            <h4 className="text-2xl font-bold text-[#313131] font-mono leading-none">1,284</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">98.4% verified check-ins</p>
          </div>
        </div>

        {/* Card 2: Sync Engine Rate */}
        <div className="bg-[#F8F8F8] border border-[#E9E9E9] rounded-lg flex flex-col justify-between h-[136px]">
          <div className="flex items-center justify-between p-4 bg-[#F8F8F8] rounded-t-lg">
            <span className="text-xs font-semibold text-[#737373] tracking-tight">DB Synchronization</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-650 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              ONLINE
            </span>
          </div>
          <div className="p-4 bg-white border-t border-[#E5E5E5] rounded-b-lg flex-1 flex flex-col justify-center">
            <h4 className="text-2xl font-bold text-[#313131] font-mono leading-none flex items-center gap-1.5">
              100%
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Offline storage synced</p>
          </div>
        </div>

        {/* Card 3: Registered Properties */}
        <div className="bg-[#F8F8F8] border border-[#E9E9E9] rounded-lg flex flex-col justify-between h-[136px]">
          <div className="flex items-center justify-between p-4 bg-[#F8F8F8] rounded-t-lg">
            <span className="text-xs font-semibold text-[#737373] tracking-tight">Registered Properties</span>
            <span className="text-[10px] text-slate-400 font-mono">farms-registry</span>
          </div>
          <div className="p-4 bg-white border-t border-[#E5E5E5] rounded-b-lg flex-1 flex flex-col justify-center">
            <h4 className="text-2xl font-bold text-[#313131] font-mono leading-none flex items-center gap-2">
              2
              <MapPin className="w-4 h-4 text-[#EA4335]" />
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Active corporate locations</p>
          </div>
        </div>

      </div>

      {/* 3. Recharts Graph: Requests over time */}
      <div className="bg-[#F8F8F8] border border-[#E9E9E9] rounded-lg overflow-hidden flex flex-col w-full h-[400px]">
        {/* Header container */}
        <div className="bg-[#F8F8F8] px-4 py-3.5 border-b border-[#E9E9E9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#EA4335]" />
            <span className="text-xs font-semibold text-[#737373]">Requests over time</span>
          </div>
          <span className="text-[11px] font-semibold bg-white border border-slate-200 rounded-md px-2.5 py-1 text-[#171717] hover:bg-slate-50 cursor-pointer">
            {user?.email || 'isaacwayneagabi@gmail.com'}'s Account
          </span>
        </div>

        {/* Chart Viewport */}
        <div className="flex-1 bg-white p-4 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EA4335" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#EA4335" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F2" />
              <XAxis 
                dataKey="time" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#737373', fontSize: 10, fontWeight: 500 }} 
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#737373', fontSize: 10, fontWeight: 500 }} 
              />
              <Tooltip 
                contentStyle={{ background: '#FFFFFF', border: '1px solid #E9E9E9', borderRadius: '8px', fontSize: '11px', color: '#171717' }} 
                labelClassName="font-bold text-[#171717]"
              />
              <Area 
                type="monotone" 
                dataKey="requests" 
                stroke="#EA4335" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorRequests)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
