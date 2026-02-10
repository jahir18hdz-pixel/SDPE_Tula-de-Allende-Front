export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  jwt?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7197";

type ProblemDetails = {
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
};

function looksLikeHtml(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("<!doctype html") || lower.includes("<html") || lower.includes("<head");
}

function normalizeAuthError(raw: string): string | null {
  const lower = raw.toLowerCase();

  // Tu caso: stacktrace con UnauthorizedAccessException + mensaje
  if (
    lower.includes("system.unauthorizedaccessexception") ||
    lower.includes("unauthorizedaccessexception") ||
    lower.includes("credenciales inválidas") ||
    lower.includes("invalid credentials") ||
    // a veces sale "Unauthorized" por proxies/middlewares
    lower.includes("unauthorized")
  ) {
    return "Credenciales inválidas.";
  }

  return null;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return "Ocurrió un error";

  // 1) Si por status ya sabemos que es credenciales
  if (res.status === 401) return "Credenciales inválidas.";

  // 2) Si viene el stacktrace / mensaje del back
  const normalized = normalizeAuthError(text);
  if (normalized) return normalized;

  // 3) Si viene HTML (Developer Exception Page), no lo muestres
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || looksLikeHtml(text)) {
    return "Ocurrió un error en el servidor.";
  }

  // 4) Si viene JSON tipo ProblemDetails
  try {
    const json = JSON.parse(text) as ProblemDetails;

    if (json.errors) {
      const firstKey = Object.keys(json.errors)[0];
      const firstMsg = json.errors[firstKey]?.[0];
      if (firstMsg) return firstMsg;
    }

    return json.message ?? json.error ?? json.detail ?? json.title ?? "Ocurrió un error";
  } catch {
    // 5) Texto plano
    return text;
  }
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    // Centralizado para cubrir 401/500-stacktrace/html/json
    throw new Error(await readError(res));
  }

  return res.json();
}

export function extractToken(data: LoginResponse): string | null {
  return data.token ?? data.accessToken ?? data.jwt ?? null;
}

// ===== Password Reset =====

export type RecoverPasswordRequest = { email: string };
export type ValidateCodeRequest = { email: string; code: string };
export type ChangePasswordRequest = { email: string; code: string; newPassword: string };

type ApiEnvelope<T> = { data: T };

export async function recoverPassword(req: RecoverPasswordRequest): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/recover-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}

export async function validateResetCode(req: ValidateCodeRequest): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/validate-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}

export async function changePassword(req: ChangePasswordRequest): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: req } satisfies ApiEnvelope<ChangePasswordRequest>),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}
