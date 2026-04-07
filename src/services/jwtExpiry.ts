// src/services/jwtExpiry.ts
export function getJwtExpMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadB64 = parts[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { exp?: number };

    if (!payload.exp) return null;
    return payload.exp * 1000; // exp viene en segundos
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const expMs = getJwtExpMs(token);
  if (!expMs) return false; // si no trae exp, no asumimos expirado
  return Date.now() >= expMs;
}
