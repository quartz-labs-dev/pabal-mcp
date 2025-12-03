import { findApp } from "@/packages/configs/secrets-config/registered-apps";
import { toErrorMessage } from "@servers/mcp/core/clients/client-factory-helpers";
import { serviceFailure, serviceSuccess } from "./service-helpers";
import { type ResolvedAppContext, type ServiceResult } from "./types";

interface ResolveAppOptions {
  slug?: string;
  bundleId?: string;
  packageName?: string;
}

/**
 * Resolve registered app and store identifiers from user input.
 * Separates "which store data is available" from tool-level orchestration.
 */
export class AppResolutionService {
  resolve(options: ResolveAppOptions): ServiceResult<ResolvedAppContext> {
    const { slug, bundleId, packageName } = options;
    const identifier = slug || bundleId || packageName;

    if (!identifier) {
      return serviceFailure(
        `❌ App not found. Please provide app (slug), packageName, or bundleId.`
      );
    }

    try {
      const app = findApp(identifier);
      if (!app) {
        return serviceFailure(
          `❌ App registered with "${identifier}" not found. Check registered apps using apps-search.`
        );
      }

      return serviceSuccess({
        app,
        slug: app.slug,
        bundleId: bundleId ?? app.appStore?.bundleId,
        packageName: packageName ?? app.googlePlay?.packageName,
        hasAppStore: Boolean(app.appStore),
        hasGooglePlay: Boolean(app.googlePlay),
      });
    } catch (error) {
      return serviceFailure(toErrorMessage(error));
    }
  }
}
