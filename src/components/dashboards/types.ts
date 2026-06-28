// Common props for all role-specific dashboards.
export interface SentimentGroup {
  sentiment: string;
  count: number;
}

export interface SeverityGroup {
  severity: number;
  count: number;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface TrendDatum {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface AnalysisItem {
  sentiment: string;
  severityScore: number;
  summary: string | null;
  topics: unknown;
}

export interface HighSeverityItem {
  id: string;
  title: string | null;
  externalId: string;
  originalTimestamp: Date;
  analysis: AnalysisItem | null;
}

export interface RoleDashboardProps {
  role: string;
  sentimentData: SentimentGroup[];
  severityData: SeverityGroup[];
  emotionData: { emotion: string; count: number }[];
  topicDistribution: TopicCount[];
  sentimentTrend: TrendDatum[];
  highSeverity: HighSeverityItem[];
  totalAnalyses: number;
  positive: number;
  negative: number;
  neutral: number;
  highSeverityCount: number;
  lastRun?: {
    status: string;
    itemsNew: number;
    createdAt: Date;
  } | null;
}

export interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
}
