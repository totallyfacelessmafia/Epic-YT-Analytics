"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  FolderSearch,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Users,
  BookOpen,
  Play,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import Sidebar from "./Sidebar";
import SeoStrengthMeter from "./SeoStrengthMeter";

type VideoStatus = "ready" | "generating" | "review" | "uploading" | "done" | "error";

interface DriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  thumbnail: string | null;
}

interface VideoItem extends DriveFile {
  status: VideoStatus;
  title?: string;
  description?: string;
  tags?: string[];
  youtubeUrl?: string;
  youtubeId?: string;
  error?: string;
  progress?: number; // 0–100 for ring
}

export default function AutomationPage({ accessKey }: { accessKey: string }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen">
        <Suspense>
          <Sidebar />
        </Suspense>
        <div className="ml-64 flex-1">
          <AutomationContent accessKey={accessKey} />
        </div>
      </div>
    </LanguageProvider>
  );
}

// SVG progress ring component
function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#0A96E6"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

function AutomationContent({ accessKey }: { accessKey: string }) {
  const { t } = useLanguage();
  const [folderId, setFolderId] = useState("1EHL7tCmbv2zY2bULeXBmfFhrP4qJhIjp");
  const [scanning, setScanning] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkCurrent, setBulkCurrent] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);

  function formatSize(bytes: number): string {
    if (bytes >= 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + " GB";
    if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + " MB";
    return (bytes / 1_000).toFixed(0) + " KB";
  }

  const apiUrl = useCallback(
    (path: string) => `${path}?key=${encodeURIComponent(accessKey)}`,
    [accessKey]
  );

  async function handleScan() {
    if (!folderId.trim()) return;
    setScanning(true);
    setScanError(null);
    setVideos([]);
    setShowSummary(false);

    try {
      const res = await fetch(
        apiUrl(`/api/drive`) + `&folderId=${encodeURIComponent(folderId.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scan folder");

      setVideos(
        data.files.map((f: DriveFile) => ({
          ...f,
          status: "ready" as VideoStatus,
          progress: 0,
        }))
      );
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function generateSeo(videoId: string): Promise<boolean> {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, status: "generating", progress: 25 } : v
      )
    );

    try {
      const video = videos.find((v) => v.id === videoId);
      if (!video) return false;

      const res = await fetch(apiUrl("/api/generate-metadata"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: video.name, driveFileId: video.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate metadata");

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? {
                ...v,
                status: "review",
                progress: 50,
                title: data.title,
                description: data.description,
                tags: data.tags,
              }
            : v
        )
      );
      return true;
    } catch (err: unknown) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, status: "error", error: err instanceof Error ? err.message : "Error" }
            : v
        )
      );
      return false;
    }
  }

  async function uploadVideo(videoId: string): Promise<boolean> {
    // Get the latest state
    const video = videos.find((v) => v.id === videoId);
    if (!video?.title || !video?.description) return false;

    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, status: "uploading", progress: 75 } : v
      )
    );

    try {
      const res = await fetch(apiUrl("/api/upload-youtube"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveFileId: video.id,
          title: video.title,
          description: video.description,
          tags: video.tags,
          sourceFolderId: folderId.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? {
                ...v,
                status: "done",
                progress: 100,
                youtubeUrl: data.url,
                youtubeId: data.videoId,
              }
            : v
        )
      );
      return true;
    } catch (err: unknown) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, status: "error", error: err instanceof Error ? err.message : "Error" }
            : v
        )
      );
      return false;
    }
  }

  // Single video: generate + review
  async function handleGenerateSeo(videoId: string) {
    await generateSeo(videoId);
    setEditingId(videoId);
  }

  // Single video: upload after review
  async function handleUpload(videoId: string) {
    await uploadVideo(videoId);
    setEditingId(null);
  }

  // Bulk: process all videos sequentially
  async function handleProcessAll() {
    abortRef.current = false;
    setBulkProcessing(true);
    setBulkCurrent(0);
    setShowSummary(false);

    const readyVideos = videos.filter(
      (v) => v.status === "ready" || v.status === "error"
    );

    for (let i = 0; i < readyVideos.length; i++) {
      if (abortRef.current) break;
      setBulkCurrent(i + 1);
      const vid = readyVideos[i];

      const seoOk = await generateSeo(vid.id);
      if (!seoOk || abortRef.current) continue;

      // Need fresh state for upload
      await new Promise((r) => setTimeout(r, 300));
      await uploadVideo(vid.id);
    }

    setBulkProcessing(false);
    setShowSummary(true);
  }

  function updateVideoField(videoId: string, field: "title" | "description", value: string) {
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, [field]: value } : v))
    );
  }

  function handleCopySummary() {
    const doneVideos = videos.filter((v) => v.status === "done" && v.youtubeUrl);
    const summaryText = doneVideos
      .map((v) => `${v.title}\n${v.youtubeUrl}`)
      .join("\n\n");
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const readyCount = videos.filter(
    (v) => v.status === "ready" || v.status === "error"
  ).length;
  const doneCount = videos.filter((v) => v.status === "done").length;

  function statusOverlay(video: VideoItem) {
    if (video.status === "done") {
      return (
        <div className="absolute inset-0 bg-epic-teal/20 rounded-xl flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      );
    }
    if (video.status === "error") {
      return (
        <div className="absolute inset-0 bg-epic-pink/20 rounded-xl flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      );
    }
    if (
      video.status === "generating" ||
      video.status === "uploading"
    ) {
      return (
        <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center">
          <div className="relative h-12 w-12">
            <ProgressRing progress={video.progress ?? 0} size={48} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {video.progress ?? 0}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-epic-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-epic-purple font-roboto">
              {t("auto.title")}
            </h1>
            <p className="text-sm text-epic-purple/50 font-georgia mt-0.5">
              {t("auto.subtitle")}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
        {/* Upload Settings */}
        <div className="rounded-2xl bg-white p-5 shadow-md border border-gray-100">
          <h3 className="text-sm font-medium text-epic-purple/80 font-roboto uppercase tracking-wider mb-3">
            {t("auto.settings")}
          </h3>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-sm text-epic-purple/70">
              <Lock className="h-4 w-4" /> {t("auto.privacy")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-sm text-epic-purple/70">
              <Users className="h-4 w-4" /> {t("auto.audience")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-sm text-epic-purple/70">
              <BookOpen className="h-4 w-4" /> {t("auto.category")}
            </span>
          </div>
        </div>

        {/* Folder Scanner */}
        <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
          <label className="block text-sm font-medium text-epic-purple/80 font-roboto uppercase tracking-wider mb-3">
            {t("auto.folderLabel")}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder={t("auto.folderPlaceholder")}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-epic-purple font-roboto placeholder:text-epic-purple/40 focus:outline-none focus:ring-2 focus:ring-epic-blue/30 focus:border-epic-blue transition-all"
            />
            <button
              onClick={handleScan}
              disabled={scanning || !folderId.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-epic-blue px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderSearch className="h-4 w-4" />
              )}
              {scanning ? t("auto.scanning") : t("auto.scanFolder")}
            </button>
          </div>
          {scanError && (
            <div className="mt-4 rounded-xl bg-epic-pink/5 border border-epic-pink/20 px-4 py-3">
              <p className="text-sm text-epic-pink font-medium">{scanError}</p>
            </div>
          )}
        </div>

        {/* Video Grid */}
        {videos.length > 0 && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-epic-purple font-roboto">
                {t("auto.reviewQueue")}
                <span className="ml-2 text-sm font-normal text-epic-purple/50">
                  ({videos.length})
                </span>
              </h2>
              <div className="flex items-center gap-3">
                {bulkProcessing && (
                  <span className="text-sm text-epic-purple/60">
                    {t("auto.bulkProgress")} {bulkCurrent} {t("auto.of")} {readyCount + doneCount > 0 ? videos.length : readyCount}
                  </span>
                )}
                <button
                  onClick={handleProcessAll}
                  disabled={bulkProcessing || readyCount === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-epic-purple px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-purple/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {bulkProcessing ? t("auto.processing") : t("auto.processAll")}
                </button>
              </div>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden transition-all hover:shadow-lg"
                >
                  {/* Thumbnail Area */}
                  <div className="relative aspect-video bg-gray-100">
                    {video.thumbnail ? (
                      <Image
                        src={video.thumbnail}
                        alt={video.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-epic-blue/10 to-epic-purple/10">
                        <Play className="h-10 w-10 text-epic-purple/20" />
                      </div>
                    )}
                    {statusOverlay(video)}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-epic-purple truncate">
                        {video.name}
                      </p>
                      <p className="text-xs text-epic-purple/50 font-georgia mt-0.5">
                        {formatSize(video.size)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {video.status === "ready" && (
                      <button
                        onClick={() => handleGenerateSeo(video.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-epic-purple px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-purple/90"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("auto.generateSeo")}
                      </button>
                    )}

                    {video.status === "generating" && (
                      <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-epic-purple/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auto.generating")}
                      </div>
                    )}

                    {video.status === "review" && (
                      <button
                        onClick={() => setEditingId(editingId === video.id ? null : video.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-epic-blue px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-blue/90"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("auto.previewMetadata")}
                      </button>
                    )}

                    {video.status === "uploading" && (
                      <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-epic-purple/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auto.uploading")}
                      </div>
                    )}

                    {video.status === "done" && video.youtubeUrl && (
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-epic-teal/20 px-4 py-2.5 text-sm font-medium text-epic-purple transition-all hover:bg-epic-teal/30"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t("auto.viewOnYt")}
                      </a>
                    )}

                    {video.status === "error" && (
                      <div className="space-y-2">
                        <p className="text-xs text-epic-pink truncate">{video.error}</p>
                        <button
                          onClick={() => handleGenerateSeo(video.id)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-epic-pink/30 px-4 py-2 text-sm font-medium text-epic-pink transition-all hover:bg-epic-pink/5"
                        >
                          {t("auto.retry")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Panel — Side by side preview */}
            {editingId && (() => {
              const video = videos.find((v) => v.id === editingId);
              if (!video?.title || !video?.description) return null;
              return (
                <div className="rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-epic-purple font-roboto">
                      {t("auto.previewMetadata")}
                    </h3>
                    <span className="text-sm text-epic-purple/50 truncate max-w-xs">
                      {video.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    {/* Edit Side */}
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-epic-purple/60 uppercase tracking-wider mb-1.5">
                          {t("auto.editTitle")}
                        </label>
                        <input
                          type="text"
                          value={video.title}
                          onChange={(e) =>
                            updateVideoField(video.id, "title", e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-epic-purple font-roboto focus:outline-none focus:ring-2 focus:ring-epic-blue/30 focus:border-epic-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-epic-purple/60 uppercase tracking-wider mb-1.5">
                          {t("auto.editDescription")}
                        </label>
                        <textarea
                          value={video.description}
                          onChange={(e) =>
                            updateVideoField(video.id, "description", e.target.value)
                          }
                          rows={8}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-epic-purple/80 font-georgia leading-relaxed focus:outline-none focus:ring-2 focus:ring-epic-blue/30 focus:border-epic-blue resize-y"
                        />
                      </div>
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {video.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-epic-blue/10 px-3 py-1 text-xs font-medium text-epic-blue"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview Side */}
                    <div className="p-6 bg-gray-50/50 space-y-4">
                      {/* SEO Strength Meter */}
                      <SeoStrengthMeter
                        title={video.title}
                        description={video.description}
                        tags={video.tags ?? []}
                      />

                      <p className="text-xs font-medium text-epic-purple/40 uppercase tracking-wider">
                        YouTube Preview
                      </p>
                      <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-3">
                        <h4 className="text-base font-medium text-epic-purple leading-snug">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-epic-purple/50">
                          <span className="rounded-full bg-epic-yellow/20 px-2 py-0.5 font-medium text-epic-purple">
                            Education
                          </span>
                          <span>Unlisted</span>
                          <span>Made for Kids</span>
                        </div>
                        <p className="text-sm text-epic-purple/70 font-georgia leading-relaxed whitespace-pre-wrap">
                          {video.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-epic-purple/60 hover:text-epic-purple transition-colors"
                    >
                      {t("auto.cancel")}
                    </button>
                    <button
                      onClick={() => handleUpload(video.id)}
                      disabled={video.status === "uploading"}
                      className="inline-flex items-center gap-2 rounded-xl bg-epic-blue px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-epic-blue/90 disabled:opacity-50"
                    >
                      {video.status === "uploading" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {video.status === "uploading"
                        ? t("auto.uploading")
                        : t("auto.confirmUpload")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Upload Summary */}
        {showSummary && doneCount > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-md border border-epic-teal/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-epic-teal/20">
                  <CheckCircle2 className="h-5 w-5 text-epic-purple" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-epic-purple font-roboto">
                    {t("auto.summary")}
                  </h2>
                  <p className="text-sm text-epic-purple/50 font-georgia">
                    {doneCount} {t("auto.summaryDesc")}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-epic-purple transition-all hover:bg-gray-50"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-epic-blue" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? t("auto.copied") : t("auto.copyLink")}
              </button>
            </div>

            <div className="space-y-3">
              {videos
                .filter((v) => v.status === "done" && v.youtubeUrl)
                .map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-epic-purple truncate">
                        {video.title}
                      </p>
                      <p className="text-xs text-epic-purple/50 font-georgia mt-0.5">
                        {video.name}
                      </p>
                    </div>
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 inline-flex items-center gap-1.5 text-sm font-medium text-epic-blue hover:text-epic-purple transition-colors flex-shrink-0"
                    >
                      {t("auto.viewOnYt")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {videos.length === 0 && !scanning && !scanError && (
          <div className="rounded-2xl bg-white p-12 shadow-md border border-gray-100 text-center">
            <FolderSearch className="h-12 w-12 text-epic-purple/20 mx-auto mb-4" />
            <p className="text-epic-purple/50 font-georgia">{t("auto.noVideos")}</p>
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
