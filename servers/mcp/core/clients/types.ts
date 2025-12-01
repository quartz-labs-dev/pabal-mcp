export type ClientFactoryResult<TClient> =
  | { success: true; client: TClient }
  | { success: false; error: string };
