import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { loadConfig } from "../../packages/core/config";
import { createAppStoreJWT, decodeJwt } from "../../packages/app-store/auth";

const server = new McpServer(
  { name: "pabal-mcp", version: "0.0.1" },
  {
    instructions:
      "ASO를 위한 App Store/Play Store 툴들을 제공합니다. 먼저 ping으로 연결 확인 후 사용하세요.",
  },
);

// 간단한 헬스체크용 도구
server.registerTool(
  "ping",
  {
    description: "연결 확인용 헬스체크",
  },
  async () => ({
    content: [{ type: "text" as const, text: "pong" }],
  }),
);

// App Store 인증 상태 확인
server.registerTool(
  "auth-app-store",
  {
    description: "secrets/aso-config.json 파일의 App Store Connect 키를 확인하고 JWT를 생성해본다.",
  },
  async () => {
    try {
      const cfg = loadConfig().appStore;
      if (!cfg) {
        return {
          content: [
            {
              type: "text" as const,
              text: "secrets/aso-config.json 파일에 App Store 설정이 없습니다.",
            },
          ],
        };
      }
      const token = createAppStoreJWT(cfg, { expirationSeconds: 300 });
      const decoded = decodeJwt(token);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ok: true, header: decoded.header, payload: decoded.payload },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `App Store 인증 확인 실패: ${message}`,
          },
        ],
      };
    }
  },
);

// Google Play 인증 상태 확인 (서비스 계정 JSON 존재 여부만 확인)
server.registerTool(
  "auth-play-store",
  {
    description:
      "secrets/aso-config.json 파일의 Google Play 서비스 계정 키를 확인합니다.",
  },
  async () => {
    try {
      const cfg = loadConfig().playStore;
      if (!cfg) {
        return {
          content: [
            {
              type: "text" as const,
              text: "secrets/aso-config.json 파일에 Play Store 설정이 없습니다.",
            },
          ],
        };
      }
      const parsed = JSON.parse(cfg.serviceAccountJson);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ok: true, client_email: parsed.client_email, project_id: parsed.project_id },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Play Store 인증 확인 실패: ${message}`,
          },
        ],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start", error);
  process.exit(1);
});
