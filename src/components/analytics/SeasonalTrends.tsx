"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sun, Moon, TrendingUp, Lightbulb } from "lucide-react";
import type { MonthlySeasonalData } from "@/types/analytics";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  data: MonthlySeasonalData[];
  peakMonth: string;
  lowMonth: string;
  growthRate: number;
}

export function SeasonalTrends({ data, peakMonth, lowMonth, growthRate }: Props) {
  const { t } = useLanguage();
  const maxProjects = Math.max(...data.map(d => d.projects), 1);
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  const getIntensityColor = (value: number, max: number) => {
    const ratio = value / max;
    if (ratio === 0) return "bg-zinc-100 text-zinc-300";
    if (ratio < 0.25) return "bg-coral-100 text-coral-400";
    if (ratio < 0.5)  return "bg-coral-200 text-coral-500";
    if (ratio < 0.75) return "bg-coral-300 text-coral-600";
    return "bg-coral-400 text-white";
  };

  const insights = [
    peakMonth
      ? `${peakMonth} ${t("anComp.peakMonthInsight")}`
      : null,
    lowMonth
      ? `${lowMonth} ${t("anComp.lowMonthInsight")}`
      : null,
    growthRate > 0
      ? `${t("anComp.yoyGrewPrefix")} ${growthRate}% ${t("anComp.yoyGrewSuffix")}`
      : growthRate < 0
      ? `${t("anComp.revenueDeclinedPrefix")} ${Math.abs(growthRate)}% ${t("anComp.revenueDeclinedSuffix")}`
      : t("anComp.revenueStable"),
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass-card p-6"
    >
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-5">{t("anComp.seasonalHeatmap")}</p>

      {/* Heatmap */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 mb-6">
        {data.map((d) => (
          <div key={d.month} className="flex flex-col items-center gap-1">
            <div
              title={`${d.month}: ${d.projects} ${t("anComp.projects")}, $${d.revenue.toLocaleString()}`}
              className={cn(
                "w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold cursor-default transition-all hover:scale-110",
                getIntensityColor(d.projects, maxProjects)
              )}
            >
              {d.projects}
            </div>
            <span className="text-[9px] text-zinc-400 font-medium">{d.month}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-6 text-xs text-zinc-400">
        <span>{t("anComp.low")}</span>
        <div className="flex gap-1">
          {["bg-zinc-100","bg-coral-100","bg-coral-200","bg-coral-300","bg-coral-400"].map((c, i) => (
            <span key={i} className={`w-5 h-3 rounded ${c}`} />
          ))}
        </div>
        <span>{t("anComp.high")}</span>
      </div>

      {/* Peak / Low indicators */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 bg-emerald-50 rounded-xl flex items-center gap-3">
          <Sun className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs text-zinc-400 font-medium">{t("anComp.peakSeason")}</p>
            <p className="font-bold text-emerald-700">{peakMonth || "—"}</p>
          </div>
        </div>
        <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-3">
          <Moon className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-zinc-400 font-medium">{t("anComp.lowSeason")}</p>
            <p className="font-bold text-blue-600">{lowMonth || "—"}</p>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" /> {t("anComp.insights")}
        </p>
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-zinc-600">
            <TrendingUp className="w-3.5 h-3.5 text-coral-400 shrink-0 mt-0.5" />
            {insight}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
