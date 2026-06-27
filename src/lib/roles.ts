// ---------------------------------------------------------------------------
// RBAC: Roles, Permissions, and Access Control
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// 10 canonical roles
export const ROLES = [
  "Admin",
  "Manager",
  "Analyst",
  "Support Agent",
  "Viewer",
  "Developer",
  "QA Engineer",
  "Product Owner",
  "Marketing",
  "Sales",
] as const;

export type RoleName = (typeof ROLES)[number];

// Permission names follow `resource:action` convention
export const PERMISSIONS = {
  // Pages
  PAGE_DASHBOARD: "page:dashboard",
  PAGE_INBOX: "page:inbox",
  PAGE_CLUSTERS: "page:clusters",
  PAGE_SOURCES: "page:sources",
  PAGE_TEAM: "page:team",
  PAGE_ROUTING: "page:routing",
  PAGE_HEALTH: "page:health",
  PAGE_WEBHOOKS: "page:webhooks",
  PAGE_API_KEYS: "page:api_keys",
  PAGE_ONBOARDING: "page:onboarding",
  PAGE_SETTINGS: "page:settings",
  PAGE_ADMIN: "page:admin",

  // API read
  API_FEEDBACK_READ: "api:feedback:read",
  API_INSIGHTS_READ: "api:insights:read",
  API_TRENDS_READ: "api:trends:read",
  API_TEAM_READ: "api:team:read",
  API_SOURCES_READ: "api:sources:read",
  API_HEALTH_READ: "api:health:read",
  API_LOGS_READ: "api:logs:read",
  API_LABELS_READ: "api:labels:read",
  API_REPLY_TEMPLATES_READ: "api:reply_templates:read",
  API_API_KEYS_READ: "api:api_keys:read",
  API_ROUTING_READ: "api:routing:read",
  API_WEBHOOKS_READ: "api:webhooks:read",
  API_WIDGETS_READ: "api:widgets:read",
  API_VIEWS_READ: "api:views:read",
  API_EXPORT_READ: "api:export:read",

  // API write
  API_FEEDBACK_WRITE: "api:feedback:write",
  API_FEEDBACK_BULK: "api:feedback:bulk",
  API_ROUTING_WRITE: "api:routing:write",
  API_WEBHOOKS_WRITE: "api:webhooks:write",
  API_WIDGETS_WRITE: "api:widgets:write",
  API_VIEWS_WRITE: "api:views:write",
  API_EXPORT_WRITE: "api:export:write",
  API_SOURCES_WRITE: "api:sources:write",
  API_SETTINGS_WRITE: "api:settings:write",
  API_LABELS_WRITE: "api:labels:write",
  API_COMMENTS_WRITE: "api:comments:write",
  API_ASSIGN_WRITE: "api:assign:write",
  API_ARCHIVE_WRITE: "api:archive:write",
  API_SNOOZE_WRITE: "api:snooze:write",
  API_VOTE_WRITE: "api:vote:write",
  API_LINKS_WRITE: "api:links:write",
  API_INGEST_WRITE: "api:ingest:write",
  API_REPLY_TEMPLATES_WRITE: "api:reply_templates:write",
  API_NOTIFICATIONS_WRITE: "api:notifications:write",
  API_API_KEYS_WRITE: "api:api_keys:write",
  API_USERS_WRITE: "api:users:write",
  API_TRANSLATE_WRITE: "api:translate:write",
  API_PREDICT_WRITE: "api:predict:write",
  API_SUMMARIZE_WRITE: "api:summarize:write",
  API_ROOT_CAUSE_WRITE: "api:root_cause:write",
  API_CORRELATIONS_READ: "api:correlations:read",
  API_COMPARISON_READ: "api:comparison:read",
  API_FUNNEL_READ: "api:funnel:read",
  API_HEATMAP_READ: "api:heatmap:read",
  API_ANOMALIES_READ: "api:anomalies:read",
  API_EMERGING_TRENDS_READ: "api:emerging_trends:read",
  API_REALTIME_STATS_READ: "api:realtime_stats:read",
  API_SEARCH_READ: "api:search:read",
  API_TIMELINE_READ: "api:timeline:read",
  API_DIGEST_READ: "api:digest:read",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Which permissions each role gets
export const ROLE_PERMISSIONS: Record<RoleName, PermissionName[]> = {
  Admin: Object.values(PERMISSIONS),

  Manager: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_INBOX,
    PERMISSIONS.PAGE_TEAM,
    PERMISSIONS.PAGE_ROUTING,
    PERMISSIONS.PAGE_HEALTH,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.PAGE_ONBOARDING,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_FEEDBACK_WRITE,
    PERMISSIONS.API_FEEDBACK_BULK,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_TEAM_READ,
    PERMISSIONS.API_HEALTH_READ,
    PERMISSIONS.API_ROUTING_READ,
    PERMISSIONS.API_ROUTING_WRITE,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_WIDGETS_WRITE,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_VIEWS_WRITE,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_EXPORT_WRITE,
    PERMISSIONS.API_SETTINGS_WRITE,
    PERMISSIONS.API_LABELS_READ,
    PERMISSIONS.API_LABELS_WRITE,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_ASSIGN_WRITE,
    PERMISSIONS.API_ARCHIVE_WRITE,
    PERMISSIONS.API_SNOOZE_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_LINKS_WRITE,
    PERMISSIONS.API_NOTIFICATIONS_WRITE,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_COMPARISON_READ,
    PERMISSIONS.API_FUNNEL_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_ANOMALIES_READ,
    PERMISSIONS.API_EMERGING_TRENDS_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_DIGEST_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_PREDICT_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
    PERMISSIONS.API_ROOT_CAUSE_WRITE,
  ],

  Analyst: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_CLUSTERS,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_HEALTH,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_HEALTH_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_COMPARISON_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_ANOMALIES_READ,
    PERMISSIONS.API_EMERGING_TRENDS_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_DIGEST_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_PREDICT_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
    PERMISSIONS.API_ROOT_CAUSE_WRITE,
  ],

  "Support Agent": [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_INBOX,
    PERMISSIONS.PAGE_ROUTING,
    PERMISSIONS.PAGE_TEAM,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.PAGE_ONBOARDING,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_FEEDBACK_WRITE,
    PERMISSIONS.API_TEAM_READ,
    PERMISSIONS.API_ROUTING_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_ASSIGN_WRITE,
    PERMISSIONS.API_ARCHIVE_WRITE,
    PERMISSIONS.API_SNOOZE_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_LINKS_WRITE,
    PERMISSIONS.API_NOTIFICATIONS_WRITE,
    PERMISSIONS.API_REPLY_TEMPLATES_READ,
    PERMISSIONS.API_REPLY_TEMPLATES_WRITE,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
    PERMISSIONS.API_FUNNEL_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
  ],

  Viewer: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_INBOX,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_COMPARISON_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_DIGEST_READ,
  ],

  Developer: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_CLUSTERS,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_HEALTH,
    PERMISSIONS.PAGE_ADMIN,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_FEEDBACK_WRITE,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_SOURCES_WRITE,
    PERMISSIONS.API_HEALTH_READ,
    PERMISSIONS.API_LOGS_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_ASSIGN_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_LINKS_WRITE,
    PERMISSIONS.API_INGEST_WRITE,
    PERMISSIONS.API_API_KEYS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_ANOMALIES_READ,
    PERMISSIONS.API_EMERGING_TRENDS_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_PREDICT_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
    PERMISSIONS.API_ROOT_CAUSE_WRITE,
  ],

  "QA Engineer": [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_CLUSTERS,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_HEALTH,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_FEEDBACK_WRITE,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_HEALTH_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_ASSIGN_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_LINKS_WRITE,
    PERMISSIONS.API_API_KEYS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_ANOMALIES_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_PREDICT_WRITE,
  ],

  "Product Owner": [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_LINKS_WRITE,
    PERMISSIONS.API_API_KEYS_READ,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_CORRELATIONS_READ,
    PERMISSIONS.API_COMPARISON_READ,
    PERMISSIONS.API_EMERGING_TRENDS_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_DIGEST_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
    PERMISSIONS.API_ROOT_CAUSE_WRITE,
  ],

  Marketing: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_EMERGING_TRENDS_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_DIGEST_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
  ],

  Sales: [
    PERMISSIONS.PAGE_DASHBOARD,
    PERMISSIONS.PAGE_SOURCES,
    PERMISSIONS.PAGE_SETTINGS,
    PERMISSIONS.API_FEEDBACK_READ,
    PERMISSIONS.API_INSIGHTS_READ,
    PERMISSIONS.API_TRENDS_READ,
    PERMISSIONS.API_SOURCES_READ,
    PERMISSIONS.API_WIDGETS_READ,
    PERMISSIONS.API_VIEWS_READ,
    PERMISSIONS.API_EXPORT_READ,
    PERMISSIONS.API_COMMENTS_WRITE,
    PERMISSIONS.API_VOTE_WRITE,
    PERMISSIONS.API_SEARCH_READ,
    PERMISSIONS.API_TIMELINE_READ,
    PERMISSIONS.API_FUNNEL_READ,
    PERMISSIONS.API_HEATMAP_READ,
    PERMISSIONS.API_REALTIME_STATS_READ,
    PERMISSIONS.API_DIGEST_READ,
    PERMISSIONS.API_TRANSLATE_WRITE,
    PERMISSIONS.API_SUMMARIZE_WRITE,
  ],
};

// Page routes mapped to required permissions
export const PAGE_PERMISSIONS: Record<string, PermissionName> = {
  "/dashboard": PERMISSIONS.PAGE_DASHBOARD,
  "/inbox": PERMISSIONS.PAGE_INBOX,
  "/clusters": PERMISSIONS.PAGE_CLUSTERS,
  "/sources": PERMISSIONS.PAGE_SOURCES,
  "/team": PERMISSIONS.PAGE_TEAM,
  "/routing": PERMISSIONS.PAGE_ROUTING,
  "/health": PERMISSIONS.PAGE_HEALTH,
  "/webhooks": PERMISSIONS.PAGE_WEBHOOKS,
  "/api-keys": PERMISSIONS.PAGE_API_KEYS,
  "/onboarding": PERMISSIONS.PAGE_ONBOARDING,
  "/settings": PERMISSIONS.PAGE_SETTINGS,
  "/admin": PERMISSIONS.PAGE_ADMIN,
};

/** Get the permission required for a given page path. */
export function getPagePermission(pathname: string): PermissionName | undefined {
  // Exact match first
  if (PAGE_PERMISSIONS[pathname]) return PAGE_PERMISSIONS[pathname];
  // Prefix match for sub-routes (e.g., /admin/logs -> page:admin)
  for (const [route, perm] of Object.entries(PAGE_PERMISSIONS)) {
    if (pathname.startsWith(route + "/")) return perm;
  }
  return undefined;
}

/** Fetch all permission names for a user from the database. */
export async function getUserPermissions(userId: string): Promise<PermissionName[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          permissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });
  const names = new Set<PermissionName>();
  for (const row of rows) {
    for (const rp of row.role.permissions) {
      names.add(rp.permission.name as PermissionName);
    }
  }
  return Array.from(names);
}

/** Check if a user has a specific permission. */
export async function hasPermission(
  userId: string,
  permission: PermissionName
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(permission);
}

/** Check if a user has any of the given permissions. */
export async function hasAnyPermission(
  userId: string,
  permissions: PermissionName[]
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return permissions.some((p) => perms.includes(p));
}

/** Check if a user has all of the given permissions. */
export async function hasAllPermissions(
  userId: string,
  permissions: PermissionName[]
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return permissions.every((p) => perms.includes(p));
}

/** Get all role names assigned to a user. */
export async function getUserRoles(userId: string): Promise<RoleName[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  return rows.map((r) => r.role.name as RoleName);
}

/** Seed the default roles and permissions into the database.
 *  Safe to call multiple times (idempotent).
 */
export async function seedRolesAndPermissions(): Promise<void> {
  // Upsert all permissions
  const allPermissionNames = Object.values(PERMISSIONS);
  for (const name of allPermissionNames) {
    await prisma.permission.upsert({
      where: { name },
      create: { name, description: name },
      update: {},
    });
  }

  // Upsert all roles and link permissions
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, description: `${roleName} role` },
      update: {},
    });

    const permissionNames = ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
      select: { id: true },
    });

    // Remove old links and create new ones
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}
