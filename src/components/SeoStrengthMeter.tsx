"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface SeoCheck {
  label: string;
  passed: boolean;
  detail: string;
}

interface SeoStrengthMeterProps {
  title: string;
  description: string;
  tags: string[];
}

export default function SeoStrengthMeter({
  title,
  description,
  tags,
}: SeoStrengthMeterProps) {
  const { t } = useLanguage();

  const checks: SeoCheck[] = [
    {
      label: t("seo.keywordFirst40"),
      passed: /sight\s*word/i.test(title.slice(0, 40)),
      detail: title.length >= 40
        ? `"${title.slice(0, 40)}…"`
        : `"${title}"`,
    },
    {
      label: t("seo.titleLength"),
      passed: title.length > 0 && title.length <= 100,
      detail: `${title.length}/100`,
    },
    {
      label: t("seo.emojiPresent"),
      passed: /[\u{1F300}-\u{1FAD6}]/u.test(title),
      detail: /[\u{1F300}-\u{1FAD6}]/u.test(title)
        ? t("seo.found")
        : t("seo.missing"),
    },
    {
      label: t("seo.ctaFirst3Lines"),
      passed: (() => {
        const lines = description.split("\n").filter((l) => l.trim());
        const first3 = lines.slice(0, 3).join(" ").toLowerCase();
        return first3.includes("getepic.com");
      })(),
      detail: "getepic.com",
    },
    {
      label: t("seo.wordOfDay"),
      passed: /word\s*of\s*the\s*day/i.test(description),
      detail: /word\s*of\s*the\s*day/i.test(description)
        ? t("seo.found")
        : t("seo.missing"),
    },
    {
      label: t("seo.hashtags"),
      passed: (description.match(/#\w+/g) || []).length >= 5,
      detail: `${(description.match(/#\w+/g) || []).length} ${t("seo.hashtagsFound")}`,
    },
    {
      label: t("seo.tagCount"),
      passed: tags.length >= 15,
      detail: `${tags.length}/15+`,
    },
    {
      label: t("seo.brandTags"),
      passed: (() => {
        const lower = tags.map((t) => t.toLowerCase());
        return (
          lower.some((t) => t.includes("epic")) &&
          lower.some((t) => t.includes("kitten ninja"))
        );
      })(),
      detail: "Epic + Kitten Ninja",
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  let strengthColor = "text-epic-pink";
  let strengthBg = "bg-epic-pink";
  let strengthLabel = t("seo.weak");

  if (score >= 90) {
    strengthColor = "text-epic-blue";
    strengthBg = "bg-epic-blue";
    strengthLabel = t("seo.excellent");
  } else if (score >= 70) {
    strengthColor = "text-epic-teal";
    strengthBg = "bg-epic-teal";
    strengthLabel = t("seo.good");
  } else if (score >= 50) {
    strengthColor = "text-epic-yellow";
    strengthBg = "bg-epic-yellow";
    strengthLabel = t("seo.fair");
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-epic-purple font-roboto">
          {t("seo.title")}
        </h4>
        <span className={`text-sm font-bold ${strengthColor}`}>
          {score}% — {strengthLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${strengthBg}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5">
            {check.passed ? (
              <CheckCircle2 className="h-4 w-4 text-epic-blue flex-shrink-0 mt-0.5" />
            ) : score >= 50 ? (
              <AlertTriangle className="h-4 w-4 text-epic-yellow flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-epic-pink flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-epic-purple/80">{check.label}</p>
              <p className="text-xs text-epic-purple/50 truncate">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
