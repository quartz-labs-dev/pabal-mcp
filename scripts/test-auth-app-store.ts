import { loadConfig } from "../packages/core/config";
import { createAppStoreJWT, decodeJwt } from "../packages/app-store/auth";

try {
  const cfg = loadConfig().appStore;
  if (!cfg) {
    console.error(
      "secrets/aso-config.json 파일에 App Store 설정이 없습니다.",
    );
    process.exit(1);
  }

  const token = createAppStoreJWT(cfg, { expirationSeconds: 300 });
  const decoded = decodeJwt(token);

  console.log(
    JSON.stringify(
      { ok: true, header: decoded.header, payload: decoded.payload },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`App Store 인증 확인 실패: ${message}`);
  process.exit(1);
}

