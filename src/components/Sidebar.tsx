"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Clapperboard } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const keyParam = searchParams.get("key") ?? "";

  const links = [
    {
      href: `/?key=${encodeURIComponent(keyParam)}`,
      label: t("nav.analytics"),
      icon: BarChart3,
      active: pathname === "/",
    },
    {
      href: `/automation?key=${encodeURIComponent(keyParam)}`,
      label: t("nav.automation"),
      icon: Clapperboard,
      active: pathname === "/automation",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-100 bg-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-epic-purple font-roboto">Epic</h1>
        <p className="text-xs text-epic-purple/50 font-georgia">Revelation Inc. AI</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
              link.active
                ? "bg-epic-blue/10 text-epic-blue"
                : "text-epic-purple/70 hover:bg-gray-50 hover:text-epic-purple"
            }`}
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-epic-purple/40 font-georgia">
          {t("footer.text")}
        </p>
      </div>
    </aside>
  );
}
