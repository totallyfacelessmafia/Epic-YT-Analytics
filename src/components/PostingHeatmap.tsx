"use client";

import { useLanguage } from "@/i18n/LanguageContext";

interface HeatmapCell {
  hour: number;
  day: number;
  avgViews: number;
  count: number;
}

interface PostingHeatmapProps {
  data: HeatmapCell[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getIntensity(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-gray-50";
  const ratio = value / max;
  if (ratio > 0.75) return "bg-epic-blue text-white";
  if (ratio > 0.5) return "bg-epic-blue/70 text-white";
  if (ratio > 0.25) return "bg-epic-blue/40 text-white";
  if (ratio > 0) return "bg-epic-blue/15 text-epic-blue";
  return "bg-gray-50";
}

export default function PostingHeatmap({ data }: PostingHeatmapProps) {
  const { t } = useLanguage();

  const maxViews = Math.max(...data.map((d) => d.avgViews), 1);
  const hasData = data.some((d) => d.count > 0);

  // Find best slot
  const bestSlot = data.reduce((best, cell) =>
    cell.avgViews > best.avgViews ? cell : best
  , data[0]);

  // Show hours 5am–11pm only (most relevant)
  const visibleHours = Array.from({ length: 19 }, (_, i) => i + 5);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-epic-purple font-roboto">
            Best Posting Time
          </h3>
          <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
            Average views by publish hour (last 30 days)
          </p>
        </div>
        {hasData && bestSlot && bestSlot.avgViews > 0 && (
          <div className="text-right">
            <p className="text-xs text-epic-purple/40 uppercase tracking-wider font-roboto">Best Slot</p>
            <p className="text-sm font-bold text-epic-blue">
              {DAYS[bestSlot.day]} {bestSlot.hour % 12 || 12}{bestSlot.hour >= 12 ? "PM" : "AM"}
            </p>
            <p className="text-xs text-epic-purple/50">{bestSlot.avgViews.toLocaleString()} avg views</p>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-12 text-sm text-epic-purple/30">
          Not enough publish data to generate a heatmap yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex ml-12 mb-1">
              {visibleHours.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[10px] text-epic-purple/40 font-roboto"
                >
                  {h % 12 || 12}{h >= 12 ? "p" : "a"}
                </div>
              ))}
            </div>

            {/* Grid */}
            {DAYS.map((dayName, dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-1 mb-1">
                <span className="w-10 text-xs text-epic-purple/50 font-roboto text-right pr-2">
                  {dayName}
                </span>
                <div className="flex flex-1 gap-0.5">
                  {visibleHours.map((h) => {
                    const cell = data.find((d) => d.day === dayIdx && d.hour === h);
                    const views = cell?.avgViews ?? 0;
                    const count = cell?.count ?? 0;

                    return (
                      <div
                        key={h}
                        className={`flex-1 aspect-square rounded-sm flex items-center justify-center text-[9px] font-medium transition-colors ${getIntensity(
                          views,
                          maxViews
                        )}`}
                        title={`${dayName} ${h % 12 || 12}${h >= 12 ? "PM" : "AM"}: ${views.toLocaleString()} avg views (${count} videos)`}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-epic-purple/40">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-100" />
                <div className="w-3 h-3 rounded-sm bg-epic-blue/15" />
                <div className="w-3 h-3 rounded-sm bg-epic-blue/40" />
                <div className="w-3 h-3 rounded-sm bg-epic-blue/70" />
                <div className="w-3 h-3 rounded-sm bg-epic-blue" />
              </div>
              <span>More views</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
