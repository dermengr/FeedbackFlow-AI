"use client";

import { motion } from "framer-motion";

// Reusable skeleton loading primitives.
// Use these inside page-level loading.tsx files and client components.

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-slate-200/80 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent ${className ?? ""}`}
      {...props}
    />
  );
}

export function SkeletonCard({
  title,
  rows = 1,
  children,
}: {
  title?: boolean;
  rows?: number;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card-modern p-4"
    >
      {title && <Skeleton className="mb-4 h-5 w-32" />}
      {children ? (
        children
      ) : (
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function SkeletonKpiCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card-modern p-4"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
    </motion.div>
  );
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:bg-slate-800 dark:border-slate-700"
    >
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-700/50">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-20" />
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

export function SkeletonPageHeaderWithAction() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <SkeletonPageHeader />
      <Skeleton className="h-9 w-32" />
    </div>
  );
}
