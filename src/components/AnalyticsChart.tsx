"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";

interface DayData {
  date: string;
  views: number;
  watchTime: number;
  subscribers: number;
}

type ViewMode = "daily" | "weekly" | "monthly";
type ContentFilter = "all" | "shorts" | "long";

interface AnalyticsChartProps {
  data: DayData[];
  contentFilter: ContentFilter;
  onContentFilterChange: (filter: ContentFilter) => void;
}

function aggregateWeekly(data: DayData[]): DayData[] {
  const weeks: DayData[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    weeks.push({
      date: `${chunk[0].date.slice(5)} – ${chunk[chunk.length - 1].date.slice(5)}`,
      views: chunk.reduce((s, d) => s + d.views, 0),
      watchTime: chunk.reduce((s, d) => s + d.watchTime, 0),
      subscribers: chunk.reduce((s, d) => s + d.subscribers, 0),
    });
  }
  return weeks;
}

function aggregateMonthly(data: DayData[]): DayData[] {
  const months = new Map<string, DayData>();
  for (const d of data) {
    const key = d.date.slice(0, 7);
    const existing = months.get(key) ?? { date: key, views: 0, watchTime: 0, subscribers: 0 };
    existing.views += d.views;
    existing.watchTime += d.watchTime;
    existing.subscribers += d.subscribers;
    months.set(key, existing);
  }
  return Array.from(months.values());
}

function formatAxisNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

export default function AnalyticsChart({
  data,
  contentFilter,
  onContentFilterChange,
}: AnalyticsChartProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<ViewMode>("daily");

  const chartData = useMemo(() => {
    switch (mode) {
      case "weekly":
        return aggregateWeekly(data);
      case "monthly":
        return aggregateMonthly(data);
      default:
        return data.map((d) => ({ ...d, date: d.date.slice(5) }));
    }
  }, [data, mode]);

  const modes: { key: ViewMode; label: string }[] = [
    { key: "daily", label: t("chart.daily") },
    { key: "weekly", label: t("chart.weekly") },
    { key: "monthly", label: t("chart.monthly") },
  ];

  const contentFilters: { key: ContentFilter; label: string }[] = [
    { key: "all", label: t("chart.all") },
    { key: "shorts", label: t("chart.shorts") },
    { key: "long", label: t("chart.longForm") },
  ];

  const viewsLabel = t("chart.views");
  const watchTimeLabel = t("chart.watchTimeMin");

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-epic-purple font-roboto">
          {t("chart.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Content Type Filter */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {contentFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => onContentFilterChange(f.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  contentFilter === f.key
                    ? "bg-epic-purple text-white shadow-sm"
                    : "text-epic-purple/80 hover:text-epic-purple"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Time Period Toggle */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  mode === m.key
                    ? "bg-epic-blue text-white shadow-sm"
                    : "text-epic-purple/80 hover:text-epic-purple"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 13, fill: "#3F1E56", opacity: 0.8, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 13, fill: "#0A96E6", opacity: 0.9, fontWeight: 500 }}
            tickFormatter={formatAxisNumber}
            tickLine={false}
            axisLine={false}
            label={{
              value: viewsLabel,
              angle: -90,
              position: "insideLeft",
              style: { fill: "#0A96E6", fontSize: 14, fontWeight: 700 },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 13, fill: "#3F1E56", opacity: 0.9, fontWeight: 500 }}
            tickFormatter={(v: number) => formatAxisNumber(v) + "m"}
            tickLine={false}
            axisLine={false}
            label={{
              value: watchTimeLabel,
              angle: 90,
              position: "insideRight",
              style: { fill: "#3F1E56", fontSize: 14, fontWeight: 700 },
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontFamily: "Roboto",
              fontSize: 14,
              fontWeight: 500,
            }}
            formatter={(value, name) => {
              const v = Number(value);
              if (name === watchTimeLabel) return [v.toLocaleString() + " min", name];
              return [v.toLocaleString(), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 14, fontWeight: 500, color: "#3F1E56" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="views"
            name={viewsLabel}
            stroke="#0A96E6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#0A96E6" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="watchTime"
            name={watchTimeLabel}
            stroke="#3F1E56"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: "#3F1E56" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
