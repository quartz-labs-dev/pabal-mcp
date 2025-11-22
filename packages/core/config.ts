import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ConfigError } from "./errors";

// 프로젝트 루트 경로 찾기
// packages/core/config.ts 기준으로 상위 2단계가 프로젝트 루트
const getProjectRoot = (): string => {
  try {
    // ES module인 경우
    if (typeof import.meta !== "undefined" && import.meta.url) {
      const currentFile = fileURLToPath(import.meta.url);
      return resolve(dirname(currentFile), "../..");
    }
  } catch {
    // CommonJS인 경우 또는 import.meta가 없는 경우
  }
  // fallback: process.cwd() 사용
  return process.cwd();
};

const appStoreSchema = z.object({
  keyId: z.string().min(1),
  issuerId: z.string().min(1),
  privateKey: z.string().min(1), // PEM 포맷 문자열
});

const playStoreSchema = z.object({
  serviceAccountJson: z.string().min(1), // JSON 문자열
});

export type AppStoreConfig = z.infer<typeof appStoreSchema>;
export type PlayStoreConfig = z.infer<typeof playStoreSchema>;

export type EnvConfig = {
  appStore?: AppStoreConfig;
  playStore?: PlayStoreConfig;
};

export function loadConfig(): EnvConfig {
  // 프로젝트 루트 기준으로 secrets/aso-config.json 파일 읽기
  const projectRoot = getProjectRoot();
  const configPath = resolve(projectRoot, "secrets/aso-config.json");

  if (!existsSync(configPath)) {
    throw new ConfigError("secrets/aso-config.json 파일이 없습니다.");
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);

    const result: EnvConfig = {};

    // App Store 설정 로드
    if (config.appStore) {
      const { issuerId, keyId, privateKeyPath } = config.appStore;
      if (issuerId && keyId && privateKeyPath) {
        // 상대 경로를 프로젝트 루트 기준으로 해석
        const keyPath = resolve(projectRoot, privateKeyPath);
        const privateKey = readFileSafe(keyPath);
        if (privateKey) {
          result.appStore = appStoreSchema.parse({
            keyId,
            issuerId,
            privateKey: normalizePrivateKey(privateKey),
          });
        }
      }
    }

    // Play Store 설정 로드
    if (config.googlePlay?.serviceAccountKeyPath) {
      // 상대 경로를 프로젝트 루트 기준으로 해석
      const jsonPath = resolve(
        projectRoot,
        config.googlePlay.serviceAccountKeyPath
      );
      const json = readFileSafe(jsonPath);
      if (json) {
        result.playStore = playStoreSchema.parse({
          serviceAccountJson: json,
        });
      }
    }

    if (!result.appStore && !result.playStore) {
      throw new ConfigError(
        "secrets/aso-config.json 파일에 App Store 또는 Play Store 인증 정보가 없습니다."
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `secrets/aso-config.json 파일을 읽는 중 오류가 발생했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function readFileSafe(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

// PEM 키의 줄바꿈 복원
function normalizePrivateKey(raw: string): string {
  if (raw.includes("-----BEGIN")) {
    return raw;
  }
  const restored = raw.replace(/\\n/g, "\n");
  return restored;
}
