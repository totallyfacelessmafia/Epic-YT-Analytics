"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import Sidebar from "./Sidebar";
import MetricCard from "./MetricCard";
import AnalyticsChart from "./AnalyticsChart";
import TopVideos from "./TopVideos";
import UploadFrequency from "./UploadFrequency";
import SubscribersChart from "./SubscribersChart";
import TopSearchTerms from "./TopSearchTerms";
import PostingHeatmap from "./PostingHeatmap";
import CtrTable from "./CtrTable";
import RetentionChart from "./RetentionChart";

type ContentFilter = "all" | "shorts" | "long";

interface TopVideo {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  avgViewDuration: number;
  isShort: boolean;
}

interface UploadCounts {
  thisWeek: number;
  lastWeek: number;
  last30Days: number;
}

interface UnlistedCounts {
  today: number;
  thisWeek: number;
  lastWeek: number;
}

interface SearchTerm {
  term: string;
  views: number;
  watchTime: number;
}

interface CtrVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  impressions: number;
  ctr: number;
  views: number;
  isShort: boolean;
}

interface RetentionVideo {
  videoId: string;
  title: string;
  avgViewDuration: number;
  videoDuration: number;
  retentionPct: number;
  views: number;
  isShort: boolean;
}

interface HeatmapCell {
  hour: number;
  day: number;
  avgViews: number;
  count: number;
}

interface AnalyticsData {
  totals: { views: number; watchTime: number; subscribers: number };
  changes: { views: number; watchTime: number; subscribers: number };
  dailyData: { date: string; views: number; watchTime: number; subscribers: number }[];
  topVideos: TopVideo[];
  uploadCounts: UploadCounts;
  unlistedCounts: UnlistedCounts;
  searchTerms: SearchTerm[];
  ctrData: CtrVideo[];
  retentionData: RetentionVideo[];
  postingHeatmap: HeatmapCell[];
  days: number;
}

type DateRange = 30 | 60 | 90;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function Dashboard({ accessKey }: { accessKey: string }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen">
        <Suspense>
          <Sidebar />
        </Suspense>
        <div className="ml-64 flex-1">
          <DashboardContent accessKey={accessKey} />
        </div>
      </div>
    </LanguageProvider>
  );
}

function DashboardContent({ accessKey }: { accessKey: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(
    (filter: ContentFilter, days: DateRange = dateRange) => {
      setLoading(true);
      setError(null);
      fetch(
        `/api/youtube?key=${encodeURIComponent(accessKey)}&filter=${filter}&days=${days}`
      )
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || body.error || t("error.fetchFailed"));
          }
          return res.json();
        })
        .then((d) => { setData(d); setLastUpdated(new Date()); })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [accessKey, t, dateRange]
  );

  useEffect(() => {
    fetchData(contentFilter, dateRange);
  }, [contentFilter, dateRange, fetchData]);

  const handleContentFilterChange = (filter: ContentFilter) => {
    setContentFilter(filter);
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const handleDownloadPdf = () => {
    setPdfLoading(true);
    // Use browser print dialog — works everywhere, no Puppeteer needed
    setTimeout(() => {
      window.print();
      setPdfLoading(false);
    }, 300);
  };

  function formatWatchTime(minutes: number): string {
    if (minutes >= 60) {
      const hrs = Math.round(minutes / 60);
      return hrs.toLocaleString() + " " + t("format.hrs");
    }
    return minutes.toLocaleString() + " " + t("format.min");
  }

  return (
    <div className="min-h-screen bg-epic-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-epic-purple font-roboto">
              {t("header.title")}
            </h1>
            <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
              {t("header.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {([30, 60, 90] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleDateRangeChange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dateRange === range
                      ? "bg-white text-epic-purple shadow-sm"
                      : "text-epic-purple/50 hover:text-epic-purple/70"
                  }`}
                >
                  {range}d
                </button>
              ))}
            </div>
            <LanguageToggle />
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !data}
              className="inline-flex items-center gap-2 rounded-xl bg-epic-blue px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-blue/90 disabled:opacity-50 disabled:cursor-not-allowed no-print"
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? t("header.downloading") : t("header.download")}
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-epic-blue animate-pulse" />
              <span className="text-xs text-epic-purple/50 font-roboto">{t("header.live")}</span>
              {lastUpdated && (
                <span className="text-xs text-epic-purple/40 font-roboto ml-1">
                  · {lastUpdated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{" "}
                  {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="h-10 w-10 rounded-full border-4 border-epic-blue/20 border-t-epic-blue animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-epic-pink/5 border border-epic-pink/20 p-6 text-center">
            <p className="text-epic-pink font-medium">{error}</p>
            <p className="text-sm text-epic-purple/50 mt-2 font-georgia">
              {t("error.checkCredentials")}
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title={t("metrics.totalViews")}
                value={formatNumber(data.totals.views)}
                change={data.changes.views}
                subtitle={`vs previous ${dateRange} days`}
              />
              <MetricCard
                title={t("metrics.watchTime")}
                value={formatWatchTime(data.totals.watchTime)}
                change={data.changes.watchTime}
                subtitle={`vs previous ${dateRange} days`}
              />
              <MetricCard
                title={t("metrics.subscribersGained")}
                value={formatNumber(data.totals.subscribers)}
                change={data.changes.subscribers}
                subtitle={`vs previous ${dateRange} days`}
              />
            </div>
            <AnalyticsChart
              data={data.dailyData}
              contentFilter={contentFilter}
              onContentFilterChange={handleContentFilterChange}
            />
            <SubscribersChart data={data.dailyData} />
            <TopVideos videos={data.topVideos} />
            {data.ctrData && data.ctrData.length > 0 && (
              <CtrTable data={data.ctrData} />
            )}
            {/* Retention chart removed — skewed by ad traffic */}
            {data.postingHeatmap && data.postingHeatmap.length > 0 && (
              <PostingHeatmap data={data.postingHeatmap} />
            )}
            <TopSearchTerms terms={data.searchTerms} />
            <UploadFrequency counts={data.uploadCounts} unlistedCounts={data.unlistedCounts} />
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 text-center">
          <p className="text-sm text-epic-purple/40 font-georgia">
            {t("footer.text")}
          </p>
        </div>
      </footer>
    </div>
  );
}
