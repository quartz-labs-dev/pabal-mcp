import { verifyPlayStoreAuth } from "@packages/play-store";

/**
 * Google Play authentication status check tool
 */
export async function handleAuthPlayStore() {
  const result = verifyPlayStoreAuth();
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
