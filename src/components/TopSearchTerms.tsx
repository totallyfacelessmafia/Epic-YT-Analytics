"use client";

import { Search, TrendingUp } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface SearchTerm {
  term: string;
  views: number;
  watchTime: number;
}

export default function TopSearchTerms({ terms }: { terms: SearchTerm[] }) {
  const { t } = useLanguage();

  if (!terms || terms.length === 0) return null;

  const maxViews = terms[0]?.views ?? 1;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-epic-blue/10">
          <Search className="h-4.5 w-4.5 text-epic-blue" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-epic-purple font-roboto">
            {t("search.title")}
          </h2>
          <p className="text-sm text-epic-purple/50 font-georgia">
            {t("search.subtitle")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {terms.slice(0, 15).map((term, i) => (
          <div key={term.term} className="flex items-center gap-3">
            <span className="w-6 text-right text-sm font-bold text-epic-purple/40 font-roboto">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-epic-purple font-roboto">
                  {term.term}
                </span>
                <span className="text-sm font-bold text-epic-purple font-roboto">
                  {term.views.toLocaleString()} {t("search.views")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(term.views / maxViews) * 100}%`,
                    background:
                      i < 3
                        ? "#0A96E6"
                        : i < 7
                        ? "#92D0D2"
                        : "#E2E8F0",
                  }}
                />
              </div>
            </div>
            {i < 3 && (
              <TrendingUp className="h-4 w-4 text-epic-blue flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
