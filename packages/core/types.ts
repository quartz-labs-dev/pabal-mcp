export type Store = "app-store" | "play-store";

export type AppId = string;
export type LocaleKey = string;

export type LocalizedText = Record<LocaleKey, string>;

export type ReleaseNote = {
  locale: LocaleKey;
  text: string;
};

// 메타데이터 구조는 스토어별로 달라질 수 있어 느슨하게 정의.
export type StoreMetadata = {
  name?: LocalizedText;
  subtitle?: LocalizedText;
  description?: LocalizedText;
  keywords?: LocalizedText;
  supportUrl?: LocalizedText;
  marketingUrl?: LocalizedText;
  whatsNew?: LocalizedText;
  // 필요 시 추가 확장.
  [key: string]: unknown;
};

export type CreateVersionResult = {
  version: string;
  raw?: unknown;
};
