"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Loader2,
  Calendar,
  List,
  Eye,
  EyeOff,
  Clock,
  Globe,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
  Film,
} from "lucide-react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import Sidebar from "./Sidebar";
import LanguageToggle from "./LanguageToggle";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  scheduledAt: string | null;
  privacy: string;
  status: "published" | "unlisted" | "scheduled" | "private";
  duration: number;
  isShort: boolean;
  views: number;
  word: string;
}

interface Stats {
  unlisted: number;
  scheduled: number;
  publishedThisMonth: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadge(status: string) {
  switch (status) {
    case "published":
      return { icon: Globe, label: "Published", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "scheduled":
      return { icon: Clock, label: "Scheduled", classes: "bg-epic-blue/10 text-epic-blue border-epic-blue/20" };
    case "unlisted":
      return { icon: EyeOff, label: "Unlisted", classes: "bg-amber-50 text-amber-700 border-amber-200" };
    default:
      return { icon: Eye, label: "Private", classes: "bg-gray-50 text-gray-500 border-gray-200" };
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductionPage({ accessKey }: { accessKey: string }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen">
        <Suspense>
          <Sidebar />
        </Suspense>
        <div className="ml-64 flex-1">
          <ProductionContent accessKey={accessKey} />
        </div>
      </div>
    </LanguageProvider>
  );
}

function ProductionContent({ accessKey }: { accessKey: string }) {
  const { t } = useLanguage();

  const apiUrl = useCallback(
    (path: string) => `${path}?key=${encodeURIComponent(accessKey)}`,
    [accessKey]
  );

  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [stats, setStats] = useState<Stats>({ unlisted: 0, scheduled: 0, publishedThisMonth: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter
  const [dateRange, setDateRange] = useState<number>(30);
  const [customDays, setCustomDays] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Schedule modal
  const [scheduleVideoId, setScheduleVideoId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(apiUrl("/api/production") + `&days=${dateRange}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to fetch");
        }
        return res.json();
      })
      .then((data) => {
        setVideos(data.videos || []);
        setStats(data.stats || { unlisted: 0, scheduled: 0, publishedThisMonth: 0, total: 0 });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl, dateRange]);

  // Filtered videos
  const filteredVideos = statusFilter === "all"
    ? videos
    : videos.filter((v) => v.status === statusFilter);

  // Calendar data
  const calendarVideos = videos.filter((v) => {
    const date = v.scheduledAt ? new Date(v.scheduledAt) : new Date(v.publishedAt);
    return date.getMonth() === calMonth && date.getFullYear() === calYear;
  });

  function getDaysInMonth(month: number, year: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(month: number, year: number) {
    return new Date(year, month, 1).getDay();
  }

  // Schedule actions
  const handleSchedule = useCallback(async () => {
    if (!scheduleVideoId || !scheduleDate) return;
    setScheduling(true);
    setScheduleError("");

    try {
      const publishAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch(apiUrl("/api/schedule-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: scheduleVideoId, publishAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Schedule failed");

      setVideos((prev) =>
        prev.map((v) =>
          v.id === scheduleVideoId
            ? { ...v, status: "scheduled" as const, scheduledAt: publishAt, privacy: "private" }
            : v
        )
      );
      setStats((prev) => ({
        ...prev,
        scheduled: prev.scheduled + 1,
        unlisted: Math.max(0, prev.unlisted - 1),
      }));
      setScheduleVideoId(null);
      setActionSuccess("Video scheduled!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed");
    } finally {
      setScheduling(false);
    }
  }, [scheduleVideoId, scheduleDate, scheduleTime, apiUrl]);

  const handlePublishNow = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(apiUrl("/api/schedule-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, action: "publish-now" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, status: "published" as const, privacy: "public", scheduledAt: null }
            : v
        )
      );
      setActionSuccess("Video published!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }, [apiUrl]);

  const handleUnschedule = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(apiUrl("/api/schedule-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, action: "unschedule" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unschedule failed");

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, status: "unlisted" as const, privacy: "unlisted", scheduledAt: null }
            : v
        )
      );
      setActionSuccess("Schedule removed.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }, [apiUrl]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-epic-purple font-roboto flex items-center gap-2.5">
              <Film className="w-6 h-6 text-epic-pink" />
              Production Pipeline
            </h1>
            <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
              Track, schedule, and publish your videos
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === "list" ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === "calendar" ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Calendar
              </button>
            </div>
            {/* Date range buttons */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => { setDateRange(d); setShowCustomInput(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dateRange === d && !showCustomInput ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showCustomInput ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                }`}
              >
                Custom
              </button>
            </div>
            {showCustomInput && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Days"
                  min={1}
                  max={365}
                  className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-epic-purple focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                />
                <button
                  onClick={() => {
                    const val = parseInt(customDays, 10);
                    if (val > 0 && val <= 365) setDateRange(val);
                  }}
                  className="rounded-lg bg-epic-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-epic-blue/90"
                >
                  Go
                </button>
              </div>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
        {/* Success toast */}
        {actionSuccess && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-500 text-white px-4 py-3 shadow-lg text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {actionSuccess}
          </div>
        )}

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Unlisted", value: stats.unlisted, color: "text-amber-600", bg: "bg-amber-50", icon: EyeOff },
            { label: "Scheduled", value: stats.scheduled, color: "text-epic-blue", bg: "bg-epic-blue/10", icon: Clock },
            { label: "Published This Month", value: stats.publishedThisMonth, color: "text-emerald-600", bg: "bg-emerald-50", icon: Globe },
            { label: "Total Videos", value: stats.total, color: "text-epic-purple", bg: "bg-epic-purple/5", icon: Film },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => {
                if (stat.label === "Unlisted") setStatusFilter(statusFilter === "unlisted" ? "all" : "unlisted");
                else if (stat.label === "Scheduled") setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled");
                else if (stat.label.includes("Published")) setStatusFilter(statusFilter === "published" ? "all" : "published");
                else setStatusFilter("all");
              }}
              className={`rounded-2xl p-5 border transition-all text-left ${
                (stat.label === "Unlisted" && statusFilter === "unlisted") ||
                (stat.label === "Scheduled" && statusFilter === "scheduled") ||
                (stat.label.includes("Published") && statusFilter === "published")
                  ? "border-epic-purple/30 shadow-md"
                  : "border-gray-100 shadow-sm hover:shadow-md"
              } bg-white`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-epic-purple/50 mt-0.5">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-epic-purple/30" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/*  LIST VIEW                                     */}
        {/* ══════════════════════════════════════════════ */}
        {!loading && !error && viewMode === "list" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-6 py-3 bg-gray-50/50 border-b border-gray-100">
              {["all", "unlisted", "scheduled", "published"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    statusFilter === f
                      ? "bg-white text-epic-purple shadow-sm"
                      : "text-epic-purple/40 hover:text-epic-purple/60"
                  }`}
                >
                  {f === "all" ? `All (${videos.length})` : `${f} (${videos.filter((v) => v.status === f).length})`}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="divide-y divide-gray-50">
              {filteredVideos.length === 0 ? (
                <div className="text-center py-12 text-sm text-epic-purple/30">
                  No videos match this filter.
                </div>
              ) : (
                filteredVideos.map((video) => {
                  const badge = statusBadge(video.status);
                  const BadgeIcon = badge.icon;

                  return (
                    <div key={video.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      {/* Thumbnail */}
                      <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {video.thumbnail && (
                          <Image src={video.thumbnail} alt={video.title} fill className="object-cover" sizes="112px" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-epic-purple truncate">{video.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${badge.classes}`}>
                            <BadgeIcon className="w-3 h-3" />
                            {badge.label}
                          </span>
                          {video.word && (
                            <span className="text-[10px] font-bold text-epic-pink bg-epic-pink/10 px-2 py-0.5 rounded-md">
                              {video.word}
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            video.isShort ? "bg-epic-pink/10 text-epic-pink" : "bg-epic-blue/10 text-epic-blue"
                          }`}>
                            {video.isShort ? "Short" : "Long"}
                          </span>
                        </div>
                      </div>

                      {/* Date info */}
                      <div className="text-right flex-shrink-0 w-36">
                        {video.status === "scheduled" && video.scheduledAt ? (
                          <div>
                            <p className="text-xs font-medium text-epic-blue">{formatDateTime(video.scheduledAt)}</p>
                            <p className="text-[10px] text-epic-purple/40">Scheduled</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-epic-purple/60">{formatDate(video.publishedAt)}</p>
                            {video.status === "published" && (
                              <p className="text-[10px] text-epic-purple/40">{video.views.toLocaleString()} views</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {video.status === "unlisted" && (
                          <>
                            <button
                              onClick={() => {
                                setScheduleVideoId(video.id);
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                setScheduleDate(tomorrow.toISOString().split("T")[0]);
                                setScheduleTime("09:00");
                                setScheduleError("");
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors"
                            >
                              <Clock className="w-3 h-3" />
                              Schedule
                            </button>
                            <button
                              onClick={() => handlePublishNow(video.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              Publish
                            </button>
                          </>
                        )}
                        {video.status === "scheduled" && (
                          <button
                            onClick={() => handleUnschedule(video.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Unschedule
                          </button>
                        )}
                        <a
                          href={`https://youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-epic-blue hover:bg-epic-blue/10 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/*  CALENDAR VIEW                                 */}
        {/* ══════════════════════════════════════════════ */}
        {!loading && !error && viewMode === "calendar" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                  else setCalMonth(calMonth - 1);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-epic-purple/60" />
              </button>
              <h3 className="text-lg font-bold text-epic-purple font-roboto">
                {new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h3>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                  else setCalMonth(calMonth + 1);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-epic-purple/60" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center py-2 text-xs font-semibold text-epic-purple/40 uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells for first week offset */}
              {Array.from({ length: getFirstDayOfMonth(calMonth, calYear) }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/30" />
              ))}

              {/* Day cells */}
              {Array.from({ length: getDaysInMonth(calMonth, calYear) }).map((_, dayIdx) => {
                const day = dayIdx + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday =
                  day === new Date().getDate() &&
                  calMonth === new Date().getMonth() &&
                  calYear === new Date().getFullYear();

                const dayVideos = calendarVideos.filter((v) => {
                  const d = v.scheduledAt ? new Date(v.scheduledAt) : new Date(v.publishedAt);
                  return d.getDate() === day;
                });

                return (
                  <div
                    key={day}
                    className={`min-h-[100px] border-b border-r border-gray-50 p-1.5 ${
                      isToday ? "bg-epic-blue/5" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-epic-blue text-white"
                          : "text-epic-purple/60"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayVideos.slice(0, 3).map((v) => {
                        const badge = statusBadge(v.status);
                        return (
                          <div
                            key={v.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${badge.classes} cursor-pointer hover:opacity-80`}
                            title={`${v.title}\n${badge.label}${v.scheduledAt ? ` — ${formatDateTime(v.scheduledAt)}` : ""}`}
                          >
                            {v.word || v.title.slice(0, 15)}
                          </div>
                        );
                      })}
                      {dayVideos.length > 3 && (
                        <div className="text-[10px] text-epic-purple/40 px-1.5">
                          +{dayVideos.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Schedule Modal ── */}
        {scheduleVideoId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-epic-purple">Schedule Video</h3>
                <button
                  onClick={() => setScheduleVideoId(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <p className="text-sm text-epic-purple/60 truncate">
                {videos.find((v) => v.id === scheduleVideoId)?.title}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-epic-purple/60 uppercase tracking-wider mb-1">
                    Publish Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-epic-purple focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-epic-purple/60 uppercase tracking-wider mb-1">
                    Publish Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-epic-purple focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                  />
                </div>
              </div>

              {scheduleError && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {scheduleError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduleDate}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-epic-blue px-4 py-3 text-white text-sm font-semibold hover:bg-epic-blue/90 transition-all disabled:opacity-40"
                >
                  {scheduling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  {scheduling ? "Scheduling..." : "Schedule"}
                </button>
                <button
                  onClick={() => setScheduleVideoId(null)}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
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
