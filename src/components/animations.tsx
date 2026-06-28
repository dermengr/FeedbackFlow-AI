"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: smoothEase },
  },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: smoothEase },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: smoothEase },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: smoothEase },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: smoothEase },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
};

interface AnimatedProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
}

export function FadeIn({ children, delay = 0, ...props }: AnimatedProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeInScale({ children, delay = 0, ...props }: AnimatedProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInScale}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ children, delay = 0, direction = "left", ...props }: AnimatedProps & { direction?: "left" | "right" | "up" | "down" }) {
  const variants = {
    left: slideInLeft,
    right: slideInRight,
    up: fadeIn,
    down: fadeIn,
  };
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants[direction]}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
  delay = 0,
  ...props
}: AnimatedProps & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: AnimatedProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

export function PopIn({ children, delay = 0, ...props }: AnimatedProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={popIn}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ children, ...props }: AnimatedProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function HoverScale({
  children,
  className,
  scale = 1.02,
  ...props
}: AnimatedProps & { scale?: number }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCard({
  children,
  className,
  ...props
}: AnimatedProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px -12px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ duration: 0.2 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedButton({
  children,
  className,
  ...props
}: AnimatedProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
