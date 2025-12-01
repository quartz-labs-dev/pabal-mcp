import type {
  PushAsoResult,
  PushFailedFields,
  UpdatedReleaseNotesResult,
} from "@servers/mcp/core/services/types";

const fieldDisplayNames: Record<string, string> = {
  name: "Name",
  subtitle: "Subtitle",
};

function formatFailedFields(failedFields: PushFailedFields[]): string {
  return failedFields
    .map((f) => {
      const fieldNames = f.fields.map(
        (field) => fieldDisplayNames[field] || field
      );
      return `   • ${f.locale}: ${fieldNames.join(", ")}`;
    })
    .join("\n");
}

export function formatPushResult(
  storeLabel: "App Store" | "Google Play",
  result: PushAsoResult
): string {
  if (!result.success) {
    if (result.needsNewVersion && result.versionInfo) {
      const { versionString, versionId } = result.versionInfo;
      return `✅ New version ${versionString} created (Version ID: ${versionId})`;
    }
    return `❌ ${storeLabel} push failed: ${result.error}`;
  }

  if (result.failedFields && result.failedFields.length > 0) {
    return `⚠️  ${storeLabel} data pushed with partial failures (${result.localesPushed.length} locales)\n${formatFailedFields(
      result.failedFields
    )}`;
  }

  return `✅ ${storeLabel} data pushed (${result.localesPushed.length} locales)`;
}

export const formatReleaseNotesUpdate = (
  storeLabel: "App Store" | "Google Play",
  result: UpdatedReleaseNotesResult
): string[] => {
  const lines: string[] = [];
  lines.push(`**${storeLabel}**`);
  if (result.updated.length > 0) {
    lines.push(`  ✅ Updated: ${result.updated.join(", ")}`);
  }
  if (result.failed.length > 0) {
    for (const fail of result.failed) {
      lines.push(`  ❌ ${fail.locale}: ${fail.error}`);
    }
  }
  return lines;
};
