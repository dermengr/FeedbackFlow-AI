"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Bell,
  Inbox,
} from "lucide-react";
import { PageShell, PageHeader, PageSection, AnimatedCard } from "@/components/PageShell";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LocaleContext";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  status: "unread" | "read";
  createdAt: string;
  feedbackItemId?: string | null;
  link?: string | null;
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const url = new URL("/api/notifications/inbox", window.location.origin);
      url.searchParams.set("limit", "100");
      if (unreadOnly) url.searchParams.set("unread", "true");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      showToast(
        t("errors.failedToLoad"),
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, t]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markRead(id: string) {
    try {
      const res = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      showToast(
        t("errors.failedToUpdate"),
        "error",
        err instanceof Error ? err.message : undefined
      );
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/inbox/mark-all-read", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: "read" }))
      );
      setUnreadCount(0);
    } catch (err) {
      showToast(
        t("errors.failedToUpdate"),
        "error",
        err instanceof Error ? err.message : undefined
      );
    }
  }

  async function removeNotification(id: string) {
    try {
      const res = await fetch("/api/notifications/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) =>
        notifications.find((n) => n.id === id)?.status === "unread"
          ? Math.max(0, prev - 1)
          : prev
      );
    } catch (err) {
      showToast(
        t("errors.failedToDelete"),
        "error",
        err instanceof Error ? err.message : undefined
      );
    }
  }

  const feedbackLink = (n: Notification) =>
    n.link ?? (n.feedbackItemId ? `/inbox/${n.feedbackItemId}` : null);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                unreadOnly
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              <Bell className="h-4 w-4" />
              {unreadOnly ? t("notifications.showAll") : t("notifications.unreadOnly")}
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="btn-secondary inline-flex items-center gap-1.5"
              >
                <CheckCheck className="h-4 w-4" />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
        }
      />

      <PageSection>
        <AnimatedCard className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {t("notifications.message")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {t("notifications.type")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {t("notifications.status")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {t("notifications.createdAt")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : notifications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      {unreadOnly
                        ? t("notifications.noUnread")
                        : t("notifications.none")}
                    </td>
                  </tr>
                ) : (
                  notifications.map((n) => {
                    const link = feedbackLink(n);
                    return (
                      <tr
                        key={n.id}
                        className={cn(
                          "transition-colors",
                          n.status === "unread"
                            ? "bg-brand-50/40 dark:bg-brand-900/10"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {n.title}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {n.body}
                            </span>
                            {link && (
                              <Link
                                href={link}
                                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {t("notifications.viewFeedback")}
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-soft">{n.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              n.status === "unread"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            )}
                          >
                            {n.status === "unread"
                              ? t("notifications.unread")
                              : t("notifications.read")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {n.status === "unread" && (
                              <button
                                type="button"
                                onClick={() => markRead(n.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                aria-label={t("notifications.markRead")}
                                title={t("notifications.markRead")}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeNotification(n.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-100 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                              aria-label={t("common.delete")}
                              title={t("common.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {link && (
                              <Link
                                href={link}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                aria-label={t("notifications.viewFeedback")}
                                title={t("notifications.viewFeedback")}
                              >
                                <Inbox className="h-4 w-4" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </AnimatedCard>
      </PageSection>
    </PageShell>
  );
}
