import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "@/packages/common/errors/error-codes";
import { HTTP_STATUS } from "@/packages/common/errors/status-codes";
import { ConfigError } from "./errors";
import { DATA_DIR_ENV_KEY } from "./constants";
import { appStoreSchema, playStoreSchema } from "./schemas";
import type { EnvConfig } from "./types";

// Get project root
// MCP config sets cwd to project root via "cwd" property
export const getProjectRoot = (): string => {
  const cwd = process.cwd();
  console.error(`[Config] 📂 Project root: ${cwd}`);
  return cwd;
};

export function getConfigPath(): string {
  return resolve(getProjectRoot(), "secrets/aso-config.json");
}

export function readConfigFile(): any {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error(
      `[Config]   ⚠️  Failed to read config file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

export function getDataDir(): string {
  const projectRoot = getProjectRoot();

  console.error(`[Config] 🔍 Checking data directory config...`);
  console.error(`[Config]   Project Root: ${projectRoot}`);

  // 1. Check config file first
  const config = readConfigFile();
  if (config?.dataDir && typeof config.dataDir === "string") {
    const normalized = config.dataDir.trim();
    if (normalized) {
      const resultDir = isAbsolute(normalized)
        ? normalized
        : resolve(projectRoot, normalized);
      console.error(`[Config]   ✅ Using config file dataDir: ${resultDir}`);
      return resultDir;
    }
  }

  // 2. Check environment variable
  const override = process.env[DATA_DIR_ENV_KEY];
  if (override && override.trim()) {
    const normalized = override.trim();
    const resultDir = isAbsolute(normalized)
      ? normalized
      : resolve(projectRoot, normalized);
    console.error(`[Config]   ✅ Using environment variable: ${resultDir}`);
    return resultDir;
  }

  // 3. Default to project root
  console.error(`[Config]   ✅ Using default (project root): ${projectRoot}`);
  return projectRoot;
}

export function loadConfig(): EnvConfig {
  const projectRoot = getProjectRoot();
  const config = readConfigFile();

  if (!config) {
    const configPath = getConfigPath();
    throw new ConfigError(
      `secrets/aso-config.json file not found or failed to parse: ${configPath}`,
      { status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODES.CONFIG_NOT_FOUND }
    );
  }

  try {
    const result: EnvConfig = {};

    if (config.appStore) {
      const { issuerId, keyId, privateKeyPath } = config.appStore;
      if (issuerId && keyId && privateKeyPath) {
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

    if (config.googlePlay?.serviceAccountKeyPath) {
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
        "secrets/aso-config.json file does not contain App Store or Play Store authentication information.",
        {
          status: HTTP_STATUS.UNAUTHORIZED,
          code: ERROR_CODES.CONFIG_AUTH_NOT_FOUND,
        }
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Error reading secrets/aso-config.json file: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: ERROR_CODES.CONFIG_READ_FAILED,
        cause: error,
      }
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

// Restore line breaks in PEM key
function normalizePrivateKey(raw: string): string {
  if (raw.includes("-----BEGIN")) {
    return raw;
  }
  const restored = raw.replace(/\\n/g, "\n");
  return restored;
}
