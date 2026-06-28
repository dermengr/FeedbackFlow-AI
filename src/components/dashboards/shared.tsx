"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Inbox } from "lucide-react";
import type { HighSeverityItem } from "./types";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px -12px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ duration: 0.2 }}
      className="card-modern p-4"
    >
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      {children}
    </motion.div>
  );
}

export function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px -12px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ duration: 0.2 }}
      className="card-modern p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <motion.p
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-900 dark:text-slate-100"}`}
      >
        {value}
      </motion.p>
    </motion.div>
  );
}

export function EmptyState({ message = "No data yet." }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400"
    >
      <Inbox className="h-10 w-10 text-slate-300" />
      {message}
    </motion.div>
  );
}

export function HighSeverityList({ items }: { items: HighSeverityItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="No high-severity feedback." />;
  }
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } },
      }}
      className="divide-y divide-slate-100 dark:divide-slate-700/50"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants} className="py-3">
          <Link
            href={`/inbox/${item.id}`}
            className="group flex flex-wrap items-center gap-2 transition-colors hover:text-brand-600"
          >
            <span className="font-medium text-slate-900 transition-colors group-hover:text-brand-600 dark:text-slate-100">
              {item.title ?? item.externalId}
            </span>
            {item.analysis && (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                Severity {item.analysis.severityScore}
              </span>
            )}
            {item.analysis && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.analysis.sentiment === "positive"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : item.analysis.sentiment === "negative"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                    : "bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {item.analysis.sentiment}
              </span>
            )}
          </Link>
          {item.analysis?.summary && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {item.analysis.summary.slice(0, 200)}
              {item.analysis.summary.length > 200 ? "…" : ""}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {(item.analysis?.topics as string[] | undefined)?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:text-slate-300"
              >
                {t}
              </span>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {new Date(item.originalTimestamp).toLocaleDateString()}
            </span>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
