"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";

// Notification preferences management UI. Fetches the current user's prefs
// from /api/notifications, lets them toggle email/slack, set a minimum
// severity threshold, and choose a digest frequency, then PATCHes updates.

type Prefs = {
  id: string;
  userId: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  minSeverity: number;
  digestFrequency: "daily" | "weekly" | "monthly" | "never";
  createdAt: string;
  updatedAt: string;
};

const DIGEST_OPTIONS: { value: Prefs["digestFrequency"]; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "never", label: "Never" },
];

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local editable form state, synced from server prefs once loaded.
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [minSeverity, setMinSeverity] = useState(3);
  const [digestFrequency, setDigestFrequency] =
    useState<Prefs["digestFrequency"]>("daily");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) {
          throw new Error(`Failed to load (status ${res.status})`);
        }
        const data = (await res.json()) as { prefs: Prefs };
        if (!active) return;
        setPrefs(data.prefs);
        setEmailEnabled(data.prefs.emailEnabled);
        setSlackEnabled(data.prefs.slackEnabled);
        setMinSeverity(data.prefs.minSeverity);
        setDigestFrequency(data.prefs.digestFrequency);
      } catch (err) {
        if (active) {
          showToast(
            (err as Error).message ?? "Failed to load preferences",
            "error"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled,
          slackEnabled,
          minSeverity,
          digestFrequency,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to save (status ${res.status})`);
      }
      const data = (await res.json()) as { prefs: Prefs };
      setPrefs(data.prefs);
      showToast("Preferences saved", "success");
    } catch (err) {
      showToast(
        (err as Error).message ?? "Failed to save preferences",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card-modern p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading preferences…</p>
      </div>
    );
  }

  return (
    <div className="card-modern space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Notification Preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Control how and when you receive feedback notifications.
        </p>
      </div>

      <div className="space-y-5">
        {/* Email toggle */}
        <ToggleRow
          label="Email notifications"
          description="Receive notifications via email"
          checked={emailEnabled}
          onChange={setEmailEnabled}
          disabled={saving}
        />

        {/* Slack toggle */}
        <ToggleRow
          label="Slack notifications"
          description="Receive notifications in Slack"
          checked={slackEnabled}
          onChange={setSlackEnabled}
          disabled={saving}
        />

        {/* Minimum severity */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label
              htmlFor="minSeverity"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Minimum severity
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only notify for events at or above this level (1-5)
            </p>
          </div>
          <input
            id="minSeverity"
            type="number"
            min={1}
            max={5}
            value={minSeverity}
            disabled={saving}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                setMinSeverity(Math.max(1, Math.min(5, Math.trunc(v))));
              }
            }}
            className="input-modern w-20"
          />
        </div>

        {/* Digest frequency */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label
              htmlFor="digestFrequency"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Digest frequency
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              How often to send a summary digest
            </p>
          </div>
          <select
            id="digestFrequency"
            value={digestFrequency}
            disabled={saving}
            onChange={(e) =>
              setDigestFrequency(
                e.target.value as Prefs["digestFrequency"]
              )
            }
            className="input-modern"
          >
            {DIGEST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {prefs && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Last updated{" "}
            {new Date(prefs.updatedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

    </div>
  );
}

// Small reusable toggle switch row used for the email/slack booleans.
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
