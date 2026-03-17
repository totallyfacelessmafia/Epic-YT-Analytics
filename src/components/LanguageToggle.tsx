"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export default function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      <button
        onClick={() => setLocale("en")}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
          locale === "en"
            ? "bg-epic-purple text-white shadow-sm"
            : "text-epic-purple/80 hover:text-epic-purple"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("zh")}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
          locale === "zh"
            ? "bg-epic-purple text-white shadow-sm"
            : "text-epic-purple/80 hover:text-epic-purple"
        }`}
      >
        中文
      </button>
    </div>
  );
}
