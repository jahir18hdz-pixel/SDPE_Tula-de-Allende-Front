import { requestJson } from "../services/api"; // ajusta la ruta según dónde esté este archivo

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  jwt?: string;
};

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

  if (
    lower.includes("system.unauthorizedaccessexception") ||
    lower.includes("unauthorizedaccessexception") ||
    lower.includes("credenciales inválidas") ||
    lower.includes("invalid credentials") ||
    lower.includes("unauthorized")
  ) {
    return "Credenciales inválidas.";
  }
  return null;
}

/**
 * Convierte cualquier error (html / texto / problemdetails) a mensaje amigable.
 * Úsalo con lo que venga en `result.error` o con strings crudos.
 */
function normalizeErrorMessage(status: number, raw: string): string {
  const text = (raw ?? "").toString();

  if (status === 401) return "Credenciales inválidas.";

  const normalized = normalizeAuthError(text);
  if (normalized) return normalized;

  if (looksLikeHtml(text)) return "Ocurrió un error en el servidor.";

  // ProblemDetails
  try {
    const json = JSON.parse(text) as ProblemDetails;

    if (json.errors) {
      const firstKey = Object.keys(json.errors)[0];
      const firstMsg = json.errors[firstKey]?.[0];
      if (firstMsg) return firstMsg;
    }

    return json.message ?? json.error ?? json.detail ?? json.title ?? "Ocurrió un error";
  } catch {
    return text || "Ocurrió un error";
  }
}

export function extractToken(data: LoginResponse): string | null {
  return data.token ?? data.accessToken ?? data.jwt ?? null;
}

// ===== AUTH =====

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(req),
  });

  if (!result.ok) {
    // result.error ya viene como string (puede ser html/json/texto)
    throw new Error(normalizeErrorMessage(result.status, result.error));
  }

  // requestJson devuelve unknown, casteamos
  return result.data as LoginResponse;
}

// ===== Password Reset =====

export type RecoverPasswordRequest = { email: string };
export type ValidateCodeRequest = { email: string; code: string };
export type ChangePasswordRequest = { email: string; code: string; newPassword: string };

type ApiEnvelope<T> = { data: T };

export async function recoverPassword(req: RecoverPasswordRequest): Promise<string> {
  const result = await requestJson("/api/auth/recover-password", {
    method: "POST",
    body: JSON.stringify(req),
  });

  if (!result.ok) throw new Error(normalizeErrorMessage(result.status, result.error));

  // Si tu API devuelve texto: requestJson lo parsea como string cuando no es JSON
  return String(result.data ?? "");
}

export async function validateResetCode(req: ValidateCodeRequest): Promise<string> {
  const result = await requestJson("/api/auth/validate-code", {
    method: "POST",
    body: JSON.stringify(req),
  });

  if (!result.ok) throw new Error(normalizeErrorMessage(result.status, result.error));
  return String(result.data ?? "");
}

export async function changePassword(req: ChangePasswordRequest): Promise<string> {
  const payload = { data: req } satisfies ApiEnvelope<ChangePasswordRequest>;

  const result = await requestJson("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!result.ok) throw new Error(normalizeErrorMessage(result.status, result.error));
  return String(result.data ?? "");
}
