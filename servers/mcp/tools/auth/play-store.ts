import { GooglePlayService } from "@servers/mcp/core/services";

const googlePlayService = new GooglePlayService();

/**
 * Google Play authentication status check tool
 */
export async function handleAuthPlayStore() {
  const result = await googlePlayService.verifyAuth();
  if (result.success && result.data) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: true,
              client_email: result.data.client_email,
              project_id: result.data.project_id,
            },
            null,
            2
          ),
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: result.error || "An unknown error occurred.",
      },
    ],
  };
}
