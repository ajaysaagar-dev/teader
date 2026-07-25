'use client';

import React from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Activity, Zap, CheckCircle2, Clock, TrendingUp, GitCommit } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const rpcData = [
    { time: '08:00', requests: 1200, latency: 420 },
    { time: '10:00', requests: 4800, latency: 310 },
    { time: '12:00', requests: 9400, latency: 280 },
    { time: '14:00', requests: 15600, latency: 190 },
    { time: '16:00', requests: 22100, latency: 165 },
    { time: '18:00', requests: 28900, latency: 140 },
  ];

  const velocityData = [
    { sprint: 'Sprint 24.0', completed: 28 },
    { sprint: 'Sprint 24.1', completed: 34 },
    { sprint: 'Sprint 24.2', completed: 41 },
    { sprint: 'Sprint 24.3', completed: 48 },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#131415] p-6 lg:p-8 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#CFD4DD] tracking-tight flex items-center gap-2">
            <Activity className="text-[#DCB001]" />
            <span>Velocity Pulse & System Metrics</span>
          </h2>
          <p className="text-xs text-[#787C83] mt-1">
            Real-time analytics on platform performance, RPC request throughput, and sprint task completion velocity.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#787C83]">
            <span>p99 Latency</span>
            <Clock size={14} className="text-[#DCB001]" />
          </div>
          <div className="text-2xl font-bold text-[#CFD4DD] font-mono">1.34s</div>
          <div className="text-[11px] text-[#22C55E] flex items-center gap-1 font-mono">
            <TrendingUp size={12} /> -68.0% after router patch
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#787C83]">
            <span>Merged Pull Requests</span>
            <GitCommit size={14} className="text-[#0391A1]" />
          </div>
          <div className="text-2xl font-bold text-[#CFD4DD] font-mono">84 PRs</div>
          <div className="text-[11px] text-[#22C55E] font-mono">99.1% CI Pass Rate</div>
        </div>

        <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#787C83]">
            <span>RPC Throughput</span>
            <Zap size={14} className="text-[#DCB001]" />
          </div>
          <div className="text-2xl font-bold text-[#CFD4DD] font-mono">2.84M</div>
          <div className="text-[11px] text-[#787C83] font-mono">Requests / hour</div>
        </div>

        <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#787C83]">
            <span>Sprint Burndown</span>
            <CheckCircle2 size={14} className="text-[#22C55E]" />
          </div>
          <div className="text-2xl font-bold text-[#CFD4DD] font-mono">88%</div>
          <div className="text-[11px] text-[#DCB001] font-mono">On schedule</div>
        </div>
      </div>

      {/* Recharts Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RPC Throughput Chart */}
        <div className="p-5 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#CFD4DD] uppercase tracking-wider">
              Request Stream & Latency Curve
            </h3>
            <span className="text-[11px] text-[#DCB001] font-mono">Live Telemetry</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rpcData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DCB001" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#DCB001" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#787C83" fontSize={11} tickLine={false} />
                <YAxis stroke="#787C83" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F1011', borderColor: '#2A2C30', borderRadius: '8px', fontSize: '12px', color: '#CFD4DD' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#DCB001" fillOpacity={1} fill="url(#colorRequests)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sprint Velocity Comparison Bar Chart */}
        <div className="p-5 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#CFD4DD] uppercase tracking-wider">
              Sprint Task Completion Velocity
            </h3>
            <span className="text-[11px] text-[#787C83] font-mono">Story Points</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityData}>
                <XAxis dataKey="sprint" stroke="#787C83" fontSize={11} tickLine={false} />
                <YAxis stroke="#787C83" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F1011', borderColor: '#2A2C30', borderRadius: '8px', fontSize: '12px', color: '#CFD4DD' }}
                />
                <Bar dataKey="completed" name="Story Points" fill="#0391A1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
