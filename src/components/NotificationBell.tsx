"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications/inbox?limit=10");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function markRead(id: string) {
    try {
      const res = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="relative rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Notifications
              </span>
              {unread > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {unread} unread
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-700 ${
                      n.status === "unread" ? "bg-slate-50/50 dark:bg-slate-700/30" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {n.status === "unread" && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-2 dark:border-slate-700">
              <Link
                href="/settings"
                className="block rounded-lg px-3 py-1.5 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Notification settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Notification = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
};
