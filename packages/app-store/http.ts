import type { AppStoreConfig } from "../core/config";
import { createAppStoreJWT } from "./auth";

const BASE_URL = "https://api.appstoreconnect.apple.com/";

type TokenCache = {
  token: string;
  exp: number;
};

export class AppStoreRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "AppStoreRequestError";
  }
}

export class AppStoreHttpClient {
  private tokenCache?: TokenCache;

  constructor(private readonly config: AppStoreConfig) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<T> {
    const token = this.getToken();
    const url = new URL(path, BASE_URL);

    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      throw new AppStoreRequestError(
        `App Store request failed: ${res.status} ${res.statusText}`,
        res.status,
        payload,
      );
    }

    return payload as T;
  }

  // 간단한 토큰 캐시: exp 60초 전이면 재발급
  private getToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenCache && this.tokenCache.exp - 60 > now) {
      return this.tokenCache.token;
    }
    const token = createAppStoreJWT(this.config);
    const { payload } = parseJwtUnsafe(token);
    const exp = typeof payload.exp === "number" ? payload.exp : now;
    this.tokenCache = { token, exp };
    return token;
  }
}

function parseJwtUnsafe(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const [header, payload] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf-8")),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")),
  };
}
