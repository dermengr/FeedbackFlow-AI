/** English UI message catalog — source of truth for AI UI translation. */
export const enMessages = {
  "app.name": "FeedbackFlow AI",
  "nav.dashboard": "Dashboard",
  "nav.inbox": "Inbox",
  "nav.clusters": "Clusters",
  "nav.sources": "Sources",
  "nav.team": "Team",
  "nav.routing": "Routing",
  "nav.health": "Health",
  "nav.webhooks": "Webhooks",
  "nav.apiKeys": "API Keys",
  "nav.onboarding": "Onboarding",
  "nav.settings": "Settings",
  "nav.logs": "Logs",
  "nav.more": "More",
  "nav.signOut": "Sign out",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "search.placeholder": "Search feedback...",
  "locale.label": "Language",
  "locale.translating": "Translating interface…",
  "translation.title": "Translation",
  "translation.translate": "Translate",
  "translation.to": "Translate to",
  "translation.translating": "Translating…",
  "translation.showOriginal": "Show original",
  "translation.detected": "Detected language",
} as const;

export type MessageKey = keyof typeof enMessages;

export const MESSAGE_KEYS = Object.keys(enMessages) as MessageKey[];