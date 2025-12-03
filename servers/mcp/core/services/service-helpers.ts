import type { ClientFactoryResult } from "../clients/types";
import type { ServiceResult } from "./types";
import { updateAppSupportedLocales } from "@/packages/configs/secrets-config/registered-apps";

export const toServiceResult = <T>(
  clientResult: ClientFactoryResult<T>
): ServiceResult<T> =>
  clientResult.success
    ? { success: true, data: clientResult.client }
    : { success: false, error: clientResult.error };

export const serviceSuccess = <T>(data: T): ServiceResult<T> => ({
  success: true,
  data,
});

export const serviceFailure = <T = never>(error: string): ServiceResult<T> => ({
  success: false,
  error,
});

export const updateRegisteredLocales = (
  identifier: string,
  store: "appStore" | "googlePlay",
  locales: string[]
): boolean => updateAppSupportedLocales({ identifier, store, locales });

export const checkPushPrerequisites = ({
  storeLabel,
  configured,
  identifierLabel,
  identifier,
  hasData,
  dataPath,
}: {
  storeLabel: string;
  configured: boolean;
  identifierLabel: string;
  identifier?: string;
  hasData: boolean;
  dataPath?: string;
}): string | null => {
  if (!configured) {
    return `⏭️  Skipping ${storeLabel} (not configured in secrets/aso-config.json)`;
  }
  if (!identifier) {
    return `⏭️  Skipping ${storeLabel} (no ${identifierLabel} provided)`;
  }
  if (!hasData) {
    console.error(
      `[MCP]   ⏭️  Skipping ${storeLabel}: No data found after preparation`
    );
    if (dataPath) {
      console.error(`[MCP]     Check if data exists in: ${dataPath}`);
    }
    return `⏭️  Skipping ${storeLabel} (no data found)`;
  }
  return null;
};
