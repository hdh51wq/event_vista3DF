"use client";

import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { YearComparisonData } from "@/types/analytics";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  data: YearComparisonData[];
  total: number;
  comparison: { value: number; percentage: number };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold text-zinc-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-zinc-500">{p.name}:</span>
          <span className="font-semibold text-zinc-800">${p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function RevenueChart({ data, total, comparison }: Props) {
  const { t } = useLanguage();
  const isPositive = comparison.percentage >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{t("anComp.totalRevenue")}</p>
          <p className="text-3xl font-bold text-zinc-900">${total.toLocaleString()}</p>
          <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? "+" : ""}{comparison.percentage}% {t("anComp.vsPreviousPeriod")}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-coral-400" />
            <span className="text-zinc-500">{t("anComp.thisYear")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-200" />
            <span className="text-zinc-500">{t("anComp.lastYear")}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={4} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5" }} />
          <Bar dataKey="previous" name={t("anComp.lastYear")} fill="#e4e4e7" radius={[4, 4, 0, 0]} />
          <Bar dataKey="current" name={t("anComp.thisYear")} fill="#ff856a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
