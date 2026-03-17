"use client";

import Image from "next/image";
import { AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";

interface CtrVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  impressions: number;
  ctr: number;
  views: number;
  isShort: boolean;
}

interface CtrTableProps {
  data: CtrVideo[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function CtrTable({ data }: CtrTableProps) {
  if (data.length === 0) return null;

  // Average CTR for benchmark
  const totalImpressions = data.reduce((sum, d) => sum + d.impressions, 0);
  const weightedCtr = totalImpressions > 0
    ? data.reduce((sum, d) => sum + d.ctr * d.impressions, 0) / totalImpressions
    : 0;

  // Sort by impressions descending
  const sorted = [...data].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-epic-purple font-roboto">
            Click-Through Rate (CTR)
          </h3>
          <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
            Thumbnail effectiveness — last 30 days
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-epic-purple/40 uppercase tracking-wider font-roboto">Avg CTR</p>
          <p className="text-lg font-bold text-epic-purple">{weightedCtr.toFixed(1)}%</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
              <th className="text-left py-3 pr-4">Video</th>
              <th className="text-right py-3 px-3">Impressions</th>
              <th className="text-right py-3 px-3">CTR</th>
              <th className="text-right py-3 px-3">Views</th>
              <th className="text-center py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((video) => {
              const isLow = video.ctr < weightedCtr * 0.7; // 30% below average
              const isHigh = video.ctr > weightedCtr * 1.3; // 30% above average

              return (
                <tr key={video.videoId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                        {video.thumbnail && (
                          <Image
                            src={video.thumbnail}
                            alt={video.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-epic-purple truncate max-w-[250px]">
                          {video.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            video.isShort ? "bg-epic-pink/10 text-epic-pink" : "bg-epic-blue/10 text-epic-blue"
                          }`}>
                            {video.isShort ? "Short" : "Long"}
                          </span>
                          <a
                            href={`https://youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-epic-blue/50 hover:text-epic-blue"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-3 text-epic-purple/70 font-mono">
                    {formatNumber(video.impressions)}
                  </td>
                  <td className="text-right py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 font-bold font-mono ${
                        isLow
                          ? "text-red-500"
                          : isHigh
                          ? "text-emerald-600"
                          : "text-epic-purple"
                      }`}
                    >
                      {video.ctr.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 text-epic-purple/70 font-mono">
                    {formatNumber(video.views)}
                  </td>
                  <td className="text-center py-3 px-3">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                        <AlertTriangle className="w-3 h-3" />
                        Low CTR
                      </span>
                    ) : isHigh ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        <TrendingUp className="w-3 h-3" />
                        Top
                      </span>
                    ) : (
                      <span className="text-xs text-epic-purple/30">Avg</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CTR bar chart */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="space-y-2">
          {sorted.slice(0, 5).map((video) => (
            <div key={video.videoId} className="flex items-center gap-3">
              <span className="text-xs text-epic-purple/50 truncate w-32 text-right flex-shrink-0">
                {video.title.slice(0, 20)}...
              </span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    video.ctr < weightedCtr * 0.7
                      ? "bg-red-400"
                      : video.ctr > weightedCtr * 1.3
                      ? "bg-emerald-400"
                      : "bg-epic-blue"
                  }`}
                  style={{ width: `${Math.min((video.ctr / 15) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-epic-purple w-12 text-right">
                {video.ctr.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
