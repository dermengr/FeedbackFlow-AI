"use client";

import { useState } from "react";
import { VALID_EVENTS } from "@/lib/webhook-constants";

export function WebhookCreateForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const events = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="events"]:checked')
    ).map((i) => i.value);
    const body: Record<string, unknown> = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      url: (form.elements.namedItem("url") as HTMLInputElement).value,
      events,
    };
    const secret = (form.elements.namedItem("secret") as HTMLInputElement).value;
    if (secret) body.secret = secret;
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create webhook");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wh-name" className="text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="wh-name"
            name="name"
            required
            placeholder="e.g. Notify CRM"
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="wh-url" className="text-sm font-medium text-slate-700">
            URL
          </label>
          <input
            id="wh-url"
            name="url"
            type="url"
            required
            placeholder="https://example.com/webhook"
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="wh-secret" className="text-sm font-medium text-slate-700">
          Secret (optional, for HMAC signing)
        </label>
        <input
          id="wh-secret"
          name="secret"
          type="password"
          placeholder="Leave blank to skip signing"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <span className="text-sm font-medium text-slate-700">Events</span>
        <div className="mt-1 flex flex-wrap gap-3">
          {VALID_EVENTS.map((ev) => (
            <label
              key={ev}
              className="inline-flex items-center gap-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="events"
                value={ev}
                defaultChecked={ev === "feedback.new"}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {ev}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create webhook"}
        </button>
      </div>
    </form>
  );
}
