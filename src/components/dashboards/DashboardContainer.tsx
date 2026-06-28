"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export function DashboardContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function DashboardHeader({
  title,
  badge,
  description,
  actions,
}: {
  title: string;
  badge?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: smoothEase } },
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {badge && (
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {actions}
      </div>
    </motion.div>
  );
}
