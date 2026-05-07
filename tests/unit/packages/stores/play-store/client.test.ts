import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GooglePlayClient } from "@/packages/stores/play-store/client";

interface CommitEditTestClient {
  androidPublisher: {
    edits: {
      commit(request: unknown, options: unknown): Promise<{ data: unknown }>;
    };
  };
  commitEdit(session: {
    auth: unknown;
    packageName: string;
    editId: string;
  }): Promise<{ data: unknown }>;
}

const createClient = (): CommitEditTestClient =>
  new GooglePlayClient({
    packageName: "com.example.app",
    serviceAccountKey: {
      client_email: "service-account@example.com",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nfake-private-key\n-----END PRIVATE KEY-----",
    },
  }) as unknown as CommitEditTestClient;

describe("GooglePlayClient edit commits", () => {
  it("disables retry for non-idempotent edit commits", async () => {
    const client = createClient();
    const calls: Array<{ request: unknown; options: unknown }> = [];

    client.androidPublisher = {
      edits: {
        commit: async (request: unknown, options: unknown) => {
          calls.push({ request, options });
          return { data: { id: "edit-id" } };
        },
      },
    };

    await client.commitEdit({
      auth: "auth-client",
      packageName: "com.example.app",
      editId: "edit-id",
    });

    assert.deepEqual(calls, [
      {
        request: {
          auth: "auth-client",
          packageName: "com.example.app",
          editId: "edit-id",
        },
        options: { retry: false },
      },
    ]);
  });
});
