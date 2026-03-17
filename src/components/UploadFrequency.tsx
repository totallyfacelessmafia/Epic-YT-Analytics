"use client";

import { Video, EyeOff } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

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

export default function UploadFrequency({
  counts,
  unlistedCounts,
}: {
  counts: UploadCounts;
  unlistedCounts?: UnlistedCounts;
}) {
  const { t } = useLanguage();

  const uploadItems = [
    { label: t("upload.thisWeek"), value: counts.thisWeek },
    { label: t("upload.lastWeek"), value: counts.lastWeek },
    { label: t("upload.last30Days"), value: counts.last30Days },
  ];

  const unlistedItems = unlistedCounts
    ? [
        { label: t("upload.today") ?? "Today", value: unlistedCounts.today },
        { label: t("upload.thisWeek"), value: unlistedCounts.thisWeek },
        { label: t("upload.lastWeek"), value: unlistedCounts.lastWeek },
      ]
    : [];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      {/* Total Uploads */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-epic-teal/20">
          <Video className="h-4.5 w-4.5 text-epic-purple" />
        </div>
        <h2 className="text-xl font-bold text-epic-purple font-roboto">
          {t("upload.title")}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {uploadItems.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-4xl font-bold text-epic-purple font-roboto">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-epic-purple/50 font-georgia">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Unlisted Uploads */}
      {unlistedCounts && (
        <>
          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-epic-yellow/20">
                <EyeOff className="h-4.5 w-4.5 text-epic-purple" />
              </div>
              <h2 className="text-xl font-bold text-epic-purple font-roboto">
                Unlisted Uploads
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {unlistedItems.map((item, i) => (
                <div key={i} className="text-center">
                  <p className="text-4xl font-bold text-epic-purple font-roboto">
                    {item.value}
                  </p>
                  <p className="mt-1 text-sm text-epic-purple/50 font-georgia">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
