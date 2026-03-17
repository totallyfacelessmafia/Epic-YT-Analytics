"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface RetentionVideo {
  videoId: string;
  title: string;
  avgViewDuration: number;
  videoDuration: number;
  retentionPct: number;
  views: number;
  isShort: boolean;
}

interface RetentionChartProps {
  data: RetentionVideo[];
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${m.toString().padStart(2, "0")}:00`;
  }
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getBarColor(pct: number): string {
  if (pct >= 70) return "#10B981"; // emerald
  if (pct >= 50) return "#0A96E6"; // epic-blue
  if (pct >= 30) return "#F59E0B"; // amber
  return "#EE2E60"; // epic-pink
}

export default function RetentionChart({ data }: RetentionChartProps) {
  if (data.length === 0) return null;

  // Filter out videos with no duration data and sort by retention
  const validData = data
    .filter((d) => d.videoDuration > 0)
    .sort((a, b) => b.retentionPct - a.retentionPct)
    .slice(0, 10);

  if (validData.length === 0) return null;

  // Average retention
  const avgRetention =
    validData.reduce((sum, d) => sum + d.retentionPct, 0) / validData.length;

  // Chart data
  const chartData = validData.map((v) => ({
    name: v.title.length > 25 ? v.title.slice(0, 22) + "..." : v.title,
    fullTitle: v.title,
    retention: Math.round(v.retentionPct * 10) / 10,
    avgWatched: formatDuration(v.avgViewDuration),
    totalDuration: formatDuration(v.videoDuration),
    views: v.views,
    isShort: v.isShort,
  }));

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-epic-purple font-roboto">
            Audience Retention
          </h3>
          <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
            Average % watched per video — last 30 days
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-epic-purple/40 uppercase tracking-wider font-roboto">Avg Retention</p>
          <p className={`text-lg font-bold ${avgRetention >= 50 ? "text-emerald-600" : avgRetention >= 30 ? "text-epic-blue" : "text-epic-pink"}`}>
            {avgRetention.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#3F1E56", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              tick={{ fontSize: 11, fill: "#3F1E56", opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 text-sm">
                    <p className="font-semibold text-epic-purple mb-1">{d.fullTitle}</p>
                    <p className="text-epic-purple/70">
                      Retention: <span className="font-bold">{d.retention}%</span>
                    </p>
                    <p className="text-epic-purple/50">
                      Avg watched: {d.avgWatched} / {d.totalDuration}
                    </p>
                    <p className="text-epic-purple/50">
                      {d.views.toLocaleString()} views · {d.isShort ? "Short" : "Long-form"}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              x={avgRetention}
              stroke="#3F1E56"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              label={{ value: `Avg ${avgRetention.toFixed(0)}%`, position: "top", fontSize: 10, fill: "#3F1E56", opacity: 0.5 }}
            />
            <Bar dataKey="retention" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={getBarColor(entry.retention)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-epic-purple/40">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 70%+
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-epic-blue" /> 50-70%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 30-50%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-epic-pink" /> &lt;30%
        </span>
      </div>
    </div>
  );
}
