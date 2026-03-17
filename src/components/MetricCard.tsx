"use client";

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  subtitle: string;
}

export default function MetricCard({ title, value, change, subtitle }: MetricCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100 flex flex-col gap-2">
      <p className="text-sm font-medium text-epic-purple/80 font-roboto uppercase tracking-wider">
        {title}
      </p>
      <p className="text-4xl font-bold text-epic-purple font-roboto">{value}</p>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            isPositive
              ? "bg-epic-teal/20 text-epic-blue"
              : "bg-epic-pink/15 text-epic-pink"
          }`}
        >
          {isPositive ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </span>
        <span className="text-sm text-epic-purple/70 font-georgia">{subtitle}</span>
      </div>
    </div>
  );
}
