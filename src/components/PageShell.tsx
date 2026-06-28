"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

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

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export function PageShell({
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

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function PageSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px -12px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ duration: 0.2 }}
      className={`card-modern ${className}`}
    >
      {children}
    </motion.div>
  );
}

type AnimatedButtonProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"button">, "children">;

export function AnimatedButton({
  children,
  className = "",
  ...props
}: AnimatedButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}
