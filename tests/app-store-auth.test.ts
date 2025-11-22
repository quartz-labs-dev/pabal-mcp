import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createAppStoreJWT, decodeJwt } from "../packages/app-store/auth";

describe("createAppStoreJWT", () => {
  it("생성된 토큰에 올바른 헤더/클레임을 포함하고 서명이 유효해야 한다", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });

    const config = {
      keyId: "ABC123KEY",
      issuerId: "ISSUER-ID-TEST",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };

    const token = createAppStoreJWT(config, { now: 1_700_000_000, expirationSeconds: 600 });
    const { header, payload, signature } = decodeJwt(token);

    assert.equal(header.alg, "ES256");
    assert.equal(header.kid, config.keyId);
    assert.equal(payload.iss, config.issuerId);
    assert.equal(payload.aud, "appstoreconnect-v1");
    assert.equal(payload.exp, 1_700_000_000 + 600);

    // 서명 검증
    const [encodedHeader, encodedPayload] = token.split(".").slice(0, 2);
    const data = `${encodedHeader}.${encodedPayload}`;

    const verifier = createVerify("SHA256");
    verifier.update(data);
    verifier.end();

    const ok = verifier.verify(publicKey, Buffer.from(signature, "base64url"));
    assert.equal(ok, true);
  });
});
