import React from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid 
} from 'recharts';
import { Project, PortfolioKPIs } from '../types/index';

interface SectorAnalyticsProps {
  projects: Project[];
  kpis: PortfolioKPIs;
  onSelectProject: (p: Project) => void;
}

export const SectorAnalytics: React.FC<SectorAnalyticsProps> = ({
  projects,
  kpis,
  onSelectProject
}) => {
  // Aggregate sector stats
  const sectorDataMap: Record<string, { sector: string; count: number; totalCost: number; criticalCount: number; avgDelay: number }> = {};

  for (const p of projects) {
    if (!sectorDataMap[p.sector]) {
      sectorDataMap[p.sector] = { sector: p.sector, count: 0, totalCost: 0, criticalCount: 0, avgDelay: 0 };
    }
    sectorDataMap[p.sector].count += 1;
    sectorDataMap[p.sector].totalCost += p.revisedCostCr;
    if (p.riskTier === 'CRITICAL') sectorDataMap[p.sector].criticalCount += 1;
    sectorDataMap[p.sector].avgDelay += p.timeOverrunMonths;
  }

  const sectorChartData = Object.values(sectorDataMap).map(s => ({
    sector: s.sector.replace('Road Transport & Highways', 'Highways').replace('Urban Affairs & Metro', 'Urban Metro'),
    totalCostCr: Math.round(s.totalCost),
    criticalCount: s.criticalCount,
    avgDelayMonths: Math.round(s.avgDelay / (s.count || 1))
  }));

  const riskPieData = [
    { name: 'Critical (≥80)', value: kpis.criticalProjects, color: '#ef4444' },
    { name: 'High (60-79)', value: kpis.highRiskProjects, color: '#f97316' },
    { name: 'Medium (45-64)', value: kpis.moderateRiskProjects, color: '#eab308' },
    { name: 'Low (0-39)', value: kpis.lowRiskProjects, color: '#10b981' }
  ];

  const topCriticalProjects = projects
    .filter(p => p.riskTier === 'CRITICAL')
    .sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="space-y-6">
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sector Cost & Delay Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Sector-Wise Capital Outlay & Average Schedule Slippage
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Total committed funds (₹ Cr) and average delay (months) by infrastructure sector
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="sector" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} unit=" Cr" />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} unit=" mo" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="totalCostCr" name="Capital Outlay (₹ Cr)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgDelayMonths" name="Avg Delay (Months)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Risk Distribution Donut */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Portfolio Risk Tier Allocation
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Breakdown of monitored projects by ML-predicted risk category
            </p>
          </div>

          <div className="h-56 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
            {riskPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-700 font-medium">{item.name}:</span>
                <strong className="text-slate-900 ml-auto">{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Critical Escalation Priority Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Cabinet PMG Escalation Priority Roster (Critical Tier)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Rank-ordered projects requiring immediate inter-ministerial intervention to prevent systemic cost escalation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topCriticalProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p)}
              className="p-4 bg-slate-50 border border-slate-200 hover:border-red-600 rounded-xl cursor-pointer transition-all hover:bg-slate-100 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-slate-600">{p.id}</span>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-0.5 line-clamp-1">
                    {p.name}
                  </h4>
                  <span className="text-[11px] text-slate-600">{p.sector} • {p.state}</span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200">
                    {p.riskScore}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500">Overrun:</span>
                  <p className="font-bold text-red-600">+{p.costOverrunPercent}%</p>
                </div>
                <div>
                  <span className="text-slate-500">Delay:</span>
                  <p className="font-bold text-orange-600">+{p.timeOverrunMonths} mo</p>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-700 line-clamp-2 leading-relaxed bg-white p-2 rounded border border-slate-200">
                ⚠️ {p.primaryDelayCause}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
