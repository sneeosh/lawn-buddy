export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  EMAIL: SendEmail;
  CF_ACCOUNT_ID: string;
  CF_AI_GATEWAY_ID: string;
  CF_AI_GATEWAY_TOKEN?: string;
  LLM_PROVIDER_TOKEN: string;
  LLM_MODEL: string;
  EMAIL_FROM: string;
};

export type Variables = {
  userEmail: string;
};

export type AppContext = { Bindings: Env; Variables: Variables };

export type LawnRow = {
  id: string;
  user_email: string;
  name: string;
  climate_zone: string;
  intake_json: string | null;
  soil_test_json: string | null;
  created_at: number;
  updated_at: number;
};

export type PhotoRow = {
  id: string;
  lawn_id: string;
  r2_key: string;
  source: 'onboarding' | 'chat';
  taken_at: number;
};

export type MessageRow = {
  id: string;
  lawn_id: string;
  role: 'user' | 'assistant';
  content: string;
  photo_ids_json: string | null;
  created_at: number;
};

export type NotificationRow = {
  id: string;
  lawn_id: string;
  type: 'seasonal' | 'weather';
  title: string;
  body: string;
  sent_at: number;
  read_at: number | null;
  dedup_key: string | null;
};
