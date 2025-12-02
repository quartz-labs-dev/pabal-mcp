import { z } from "zod";

export const appStoreSchema = z.object({
  keyId: z.string().min(1),
  issuerId: z.string().min(1),
  privateKey: z.string().min(1), // PEM format string
});

export const playStoreSchema = z.object({
  serviceAccountJson: z.string().min(1), // JSON string
});
