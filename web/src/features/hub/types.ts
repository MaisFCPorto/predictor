export type HubArticle = {
  title: string;
  publishedAt: string;
  url: string;
  source: string;
  imageUrl: string | null;
};

export type HubNewsStatus = 'pending' | 'approved' | 'rejected';
export type HubNewsItem = HubArticle & { id: number; status: HubNewsStatus; revision: number; imageApproved: 0 | 1 };
export type HubNewsPage = { items: HubNewsItem[]; hasMore: boolean };
export type HubNewsChanges = { added: number; imagesAdded: number };
export type HubNewsSync = HubNewsChanges & { found: number; failedSources: string[] };

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
