import { verifyAppStoreAuth } from "@packages/app-store";

/**
 * App Store authentication status check tool
 */
export async function handleAuthAppStore() {
  const result = await verifyAppStoreAuth({ expirationSeconds: 300 });
  if (result.success && result.data) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: true,
              header: result.data.header,
              payload: result.data.payload,
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
