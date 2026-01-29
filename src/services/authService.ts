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
    throw new Error("No se pudo iniciar sesión.");
  }

  return res.json();
}

export function extractToken(data: LoginResponse): string | null {
  return data.token ?? data.accessToken ?? data.jwt ?? null;
}
