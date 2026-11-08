export type HubArticle = {
  title: string;
  summary: string;
  category: string;
  time: string;
  url: string;
  source: string;
  image: string;
  imageAlt: string;
};

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
  articles: [HubArticle, ...HubArticle[]];
  standings: { liga: StandingsSnapshot; champions: StandingsSnapshot };
  instagram: { profileUrl: string; summary: string; posts: InstagramPost[] };
  cadernetaEnabled: boolean;
};
