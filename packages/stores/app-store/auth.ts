import { SignJWT, importPKCS8 } from "jose";
import type { AppStoreConfig } from "@/packages/configs/secrets-config/types";

type JwtOptions = {
  now?: number; // seconds
  expirationSeconds?: number; // default 600, capped at 1200
};

const AUDIENCE = "appstoreconnect-v1";
const MAX_EXP_SECONDS = 60 * 20;
const DEFAULT_EXP_SECONDS = 60 * 10;

export async function createAppStoreJWT(
  config: AppStoreConfig,
  options: JwtOptions = {}
): Promise<string> {
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const expSeconds = Math.min(
    options.expirationSeconds ?? DEFAULT_EXP_SECONDS,
    MAX_EXP_SECONDS
  );

  // Normalize private key
  const normalizedKey = config.privateKey.replace(/\\n/g, "\n").trim();

  // Import private key in PKCS8 format
  const privateKey = await importPKCS8(normalizedKey, "ES256");

  // Create JWT (App Store Connect API does not require iat)
  const jwt = await new SignJWT({
    iss: config.issuerId,
    aud: AUDIENCE,
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: config.keyId,
      typ: "JWT",
    })
    .setExpirationTime(nowSeconds + expSeconds)
    .sign(privateKey);

  return jwt;
}

export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
} {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new Error("Invalid JWT format");
  }
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf-8")),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")),
    signature,
  };
}
