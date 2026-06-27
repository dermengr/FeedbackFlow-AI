// ---------------------------------------------------------------------------
// Dashboard configuration per role
// ---------------------------------------------------------------------------

import type { RoleName } from "@/lib/roles";

/** Dashboard section IDs that can be shown/hidden per role. */
export type DashboardSection =
  | "realtimeStats"
  | "insights"
  | "anomalyAlerts"
  | "kpiCards"
  | "sentimentTrend"
  | "sentimentDistribution"
  | "topicDistribution"
  | "severityDistribution"
  | "emotionDistribution"
  | "risingTopics"
  | "emergingTrends"
  | "triageFunnel"
  | "sentimentHeatmap"
  | "topicCorrelations"
  | "activityTimeline"
  | "periodComparison"
  | "customWidgets"
  | "highSeverityList"
  | "teamMetrics"
  | "routingOverview"
  | "healthStatus"
  | "sourceHealth"
  | "feedbackVolume"
  | "conversionFunnel"
  | "customerSentiment"
  | "bugSeverity"
  | "qaMetrics";

/** Which sections each role sees on their dashboard. */
export const ROLE_DASHBOARD_SECTIONS: Record<RoleName, DashboardSection[]> = {
  Admin: [
    "realtimeStats",
    "insights",
    "anomalyAlerts",
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "severityDistribution",
    "emotionDistribution",
    "risingTopics",
    "emergingTrends",
    "triageFunnel",
    "sentimentHeatmap",
    "topicCorrelations",
    "activityTimeline",
    "periodComparison",
    "customWidgets",
    "highSeverityList",
    "teamMetrics",
    "healthStatus",
    "sourceHealth",
  ],

  Manager: [
    "realtimeStats",
    "insights",
    "anomalyAlerts",
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "severityDistribution",
    "risingTopics",
    "emergingTrends",
    "triageFunnel",
    "activityTimeline",
    "periodComparison",
    "customWidgets",
    "highSeverityList",
    "teamMetrics",
    "routingOverview",
  ],

  Analyst: [
    "realtimeStats",
    "insights",
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "severityDistribution",
    "emotionDistribution",
    "risingTopics",
    "emergingTrends",
    "sentimentHeatmap",
    "topicCorrelations",
    "activityTimeline",
    "periodComparison",
    "customWidgets",
    "highSeverityList",
    "sourceHealth",
  ],

  "Support Agent": [
    "realtimeStats",
    "kpiCards",
    "sentimentTrend",
    "triageFunnel",
    "activityTimeline",
    "highSeverityList",
    "routingOverview",
  ],

  Viewer: [
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "severityDistribution",
    "risingTopics",
    "emergingTrends",
    "sentimentHeatmap",
    "topicCorrelations",
  ],

  Developer: [
    "realtimeStats",
    "kpiCards",
    "sentimentTrend",
    "topicDistribution",
    "severityDistribution",
    "risingTopics",
    "triageFunnel",
    "sentimentHeatmap",
    "activityTimeline",
    "highSeverityList",
    "healthStatus",
    "sourceHealth",
    "bugSeverity",
  ],

  "QA Engineer": [
    "realtimeStats",
    "kpiCards",
    "sentimentTrend",
    "severityDistribution",
    "emotionDistribution",
    "risingTopics",
    "triageFunnel",
    "sentimentHeatmap",
    "topicCorrelations",
    "highSeverityList",
    "bugSeverity",
    "qaMetrics",
  ],

  "Product Owner": [
    "realtimeStats",
    "insights",
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "severityDistribution",
    "emotionDistribution",
    "risingTopics",
    "emergingTrends",
    "triageFunnel",
    "topicCorrelations",
    "activityTimeline",
    "periodComparison",
    "highSeverityList",
    "feedbackVolume",
  ],

  Marketing: [
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "risingTopics",
    "emergingTrends",
    "sentimentHeatmap",
    "topicCorrelations",
    "periodComparison",
    "highSeverityList",
    "customerSentiment",
    "feedbackVolume",
  ],

  Sales: [
    "kpiCards",
    "sentimentTrend",
    "sentimentDistribution",
    "topicDistribution",
    "risingTopics",
    "sentimentHeatmap",
    "periodComparison",
    "highSeverityList",
    "conversionFunnel",
    "customerSentiment",
    "feedbackVolume",
  ],
};

export function getDashboardSections(role: RoleName): DashboardSection[] {
  return ROLE_DASHBOARD_SECTIONS[role] ?? ROLE_DASHBOARD_SECTIONS["Viewer"];
}
