export type HubArticle = {
  title: string;
  publishedAt: string;
  url: string;
  source: string;
  imageUrl: string | null;
  articleId?: number | null;
  summaryId?: number | null;
};

export type HubNewsStatus = 'pending' | 'approved' | 'rejected';
export type HubSummaryState = 'queued' | 'processing' | 'draft' | 'approved' | 'rejected' | 'failed' | 'insufficient';
export type HubNewsItem = HubArticle & {
  id: number; status: HubNewsStatus; revision: number; imageApproved: 0 | 1;
  sourceExcerpt?: string | null; summaryState?: HubSummaryState | null;
  summaryTitle?: string | null; summaryText?: string | null; summaryError?: string | null;
  summaryGeneratedAt?: string | null;
};
export type HubSummarySettings = {
  enabled: boolean; keyConfigured: boolean; model: string; dailyLimit: number;
  usage: { requests: number; inputTokens: number; outputTokens: number };
};
export type HubSummaryArticle = {
  id: number; title: string; summary: string | null; originalTitle: string; sourceUrl: string;
  source: string; publishedAt: string; generatedAt: string | null; imageUrl: string | null;
};
export type HubNewsPage = { items: HubNewsItem[]; hasMore: boolean };
export type HubNewsChanges = { added: number; imagesAdded: number };
export type HubNewsSync = HubNewsChanges & { found: number; failedSources: string[]; articlesRead?: number };

export type Standing = {
  position: number;
  team: string;
  played: number;
  points: number;
  porto?: true;
};

export type StandingsSnapshot = {
  name: string;
  asOf: string;
  scope: string;
  sourceUrl: string;
  rows: Standing[];
};

export type InstagramPost = {
  url: string;
  image: string;
  caption: string;
  date: string;
  type: 'Publicação' | 'Carrossel' | 'Arquivo';
};

export type HubContent = {
  edition: { date: string; label: string };
  articles: HubArticle[];
  newsAvailable: boolean;
  standings: { liga: StandingsSnapshot; champions: StandingsSnapshot };
  instagram: { profileUrl: string; summary: string; posts: InstagramPost[] };
  cadernetaEnabled: boolean;
};
