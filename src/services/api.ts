export const BASE_URL =
  (import.meta.env.VITE_API_URL as string) || "https://localhost:7197";

type AuthStored = { token?: string; Token?: string };

export function readToken(): string {
  const rawAuth = localStorage.getItem("auth");
  if (rawAuth) {
    try {
      const parsed = JSON.parse(rawAuth) as AuthStored;
      const token = (parsed.token ?? parsed.Token ?? "").trim();
      if (token) return token;
    } catch {
      // ignore
    }
  }
  return "";
}

function safeJoin(base: string, path: string): string {
  if (!path) return base;
  if (path.startsWith("http")) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base.slice(0, -1) + path;
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  const t = (text ?? "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return text;
  }
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = readToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function requestJson(
  path: string,
  init?: RequestInit
): Promise<
  | { ok: true; data: unknown; status: number }
  | { ok: false; error: string; status: number }
> {
  const url = safeJoin(BASE_URL, path);

  const res = await fetch(url, {
    ...init,
    credentials: "omit",
    headers: authHeaders(init?.headers),
  });

  if (res.status === 204) return { ok: true, data: [], status: 204 };

  const text = await safeText(res);
  const parsed = tryParseJson(text);

  if (!res.ok) {
    const apiMsg =
      isRecord(parsed) && typeof parsed.message === "string" ? String(parsed.message) : "";
    const msg =
      apiMsg || (typeof parsed === "string" ? parsed : "") || text || `HTTP ${res.status}`;
    return { ok: false, error: msg, status: res.status };
  }

  return { ok: true, data: parsed, status: res.status };
}