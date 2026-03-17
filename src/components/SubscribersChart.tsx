"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
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
  subscribers: number;
}

export default function SubscribersChart({ data }: { data: DayData[] }) {
  const { t } = useLanguage();

  const chartData = useMemo(
    () => data.map((d) => ({ ...d, date: d.date.slice(5) })),
    [data]
  );

  const subscribersLabel = t("subscribers.name");

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-epic-purple font-roboto mb-6">
        {t("subscribers.title")}
      </h2>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="subGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A96E6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0A96E6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 13, fill: "#3F1E56", opacity: 0.8, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 13, fill: "#3F1E56", opacity: 0.9, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
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
            formatter={(value) => [Number(value).toLocaleString(), subscribersLabel]}
          />
          <Legend wrapperStyle={{ fontSize: 14, fontWeight: 500, color: "#3F1E56" }} />
          <Area
            type="monotone"
            dataKey="subscribers"
            name={subscribersLabel}
            stroke="#0A96E6"
            strokeWidth={2.5}
            fill="url(#subGradient)"
            activeDot={{ r: 5, fill: "#0A96E6", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
