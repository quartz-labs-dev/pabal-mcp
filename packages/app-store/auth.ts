import { createSign } from "node:crypto";
import type { AppStoreConfig } from "../core/config";

type JwtOptions = {
  now?: number; // seconds
  expirationSeconds?: number; // default 600, capped at 1200
};

const AUDIENCE = "appstoreconnect-v1";
const MAX_EXP_SECONDS = 60 * 20;
const DEFAULT_EXP_SECONDS = 60 * 10;

export function createAppStoreJWT(
  config: AppStoreConfig,
  options: JwtOptions = {},
): string {
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const expSeconds = Math.min(
    options.expirationSeconds ?? DEFAULT_EXP_SECONDS,
    MAX_EXP_SECONDS,
  );

  const header = {
    alg: "ES256",
    kid: config.keyId,
    typ: "JWT",
  };

  const payload = {
    iss: config.issuerId,
    aud: AUDIENCE,
    exp: nowSeconds + expSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(config.privateKey);
  const encodedSignature = base64url(signature);

  return `${signingInput}.${encodedSignature}`;
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

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
