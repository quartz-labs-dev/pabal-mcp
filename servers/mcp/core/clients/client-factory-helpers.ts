import type { ClientFactoryResult } from "./types";
export type { ClientFactoryResult } from "./types";

export const success = <TClient>(
  client: TClient
): ClientFactoryResult<TClient> => ({
  success: true,
  client,
});

export const failure = <TClient>(
  error: string
): ClientFactoryResult<TClient> => ({
  success: false,
  error,
});

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
