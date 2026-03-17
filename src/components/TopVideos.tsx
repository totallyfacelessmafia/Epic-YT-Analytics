"use client";

import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  avgViewDuration: number;
  isShort: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TopVideos({ videos }: { videos: Video[] }) {
  const { t } = useLanguage();

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100 text-center">
        <p className="text-epic-purple/50 font-georgia">{t("topVideos.empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-epic-purple font-roboto mb-6">
        {t("topVideos.title")}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-epic-purple/50 uppercase tracking-wider pb-3 pr-4">
                {t("topVideos.video")}
              </th>
              <th className="text-right text-xs font-medium text-epic-purple/50 uppercase tracking-wider pb-3 px-4">
                {t("topVideos.type")}
              </th>
              <th className="text-right text-xs font-medium text-epic-purple/50 uppercase tracking-wider pb-3 px-4">
                {t("topVideos.views")}
              </th>
              <th className="text-right text-xs font-medium text-epic-purple/50 uppercase tracking-wider pb-3 px-4">
                {t("topVideos.avgViewDuration")}
              </th>
              <th className="text-right text-xs font-medium text-epic-purple/50 uppercase tracking-wider pb-3 pl-4">
                {t("topVideos.link")}
              </th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video, i) => (
              <tr
                key={video.id}
                className={`${i < videos.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/50 transition-colors`}
              >
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                      {video.thumbnail ? (
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-100 rounded-lg" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-epic-blue line-clamp-2">
                      {video.title}
                    </span>
                  </div>
                </td>
                <td className="text-right py-4 px-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      video.isShort
                        ? "bg-epic-yellow/20 text-epic-purple"
                        : "bg-epic-teal/20 text-epic-purple"
                    }`}
                  >
                    {video.isShort ? t("topVideos.short") : t("topVideos.long")}
                  </span>
                </td>
                <td className="text-right py-4 px-4 text-sm font-medium text-epic-purple tabular-nums">
                  {video.views.toLocaleString()}
                </td>
                <td className="text-right py-4 px-4 text-sm text-epic-purple/70 tabular-nums">
                  {formatDuration(video.avgViewDuration)}
                </td>
                <td className="text-right py-4 pl-4">
                  <a
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-epic-blue hover:text-epic-purple transition-colors"
                  >
                    {t("topVideos.viewOnYouTube")}
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
