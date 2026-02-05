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

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Credenciales inválidas.");
    throw new Error(await readError(res));
  }

  return res.json();
}

export function extractToken(data: LoginResponse): string | null {
  return data.token ?? data.accessToken ?? data.jwt ?? null;
}

type ProblemDetails = {
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
};

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return "Ocurrió un error";

  try {
    const json = JSON.parse(text) as ProblemDetails;

    if (json.errors) {
      const firstKey = Object.keys(json.errors)[0];
      const firstMsg = json.errors[firstKey]?.[0];
      if (firstMsg) return firstMsg;
    }

    return json.message ?? json.error ?? json.detail ?? json.title ?? text;
  } catch {
    return text;
  }
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
    // 👇 si tu RequestPasswordResetCommand NO tiene Data, déjalo plano:
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}

export async function validateResetCode(req: ValidateCodeRequest): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/validate-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 👇 si tu ValidateResetCodeCommand NO tiene Data, déjalo plano:
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}

export async function changePassword(req: ChangePasswordRequest): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ✅ ChangePasswordCommand pide Data (por tu error)
    body: JSON.stringify({ data: req } satisfies ApiEnvelope<ChangePasswordRequest>),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.text();
}
