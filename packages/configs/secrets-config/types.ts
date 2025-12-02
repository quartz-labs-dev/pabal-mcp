import { z } from "zod";
import { appStoreSchema, playStoreSchema } from "./schemas";

export type AppStoreConfig = z.infer<typeof appStoreSchema>;
export type PlayStoreConfig = z.infer<typeof playStoreSchema>;

export type EnvConfig = {
  appStore?: AppStoreConfig;
  playStore?: PlayStoreConfig;
};
