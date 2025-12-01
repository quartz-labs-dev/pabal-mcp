export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type MaybeResult<T> =
  | ({ found: true } & T)
  | { found: false; error?: string };

export interface StoreAppSummary {
  id: string;
  name: string;
  bundleId: string;
  sku: string;
  isReleased: boolean;
}
