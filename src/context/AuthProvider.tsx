import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./Auth.context";
import { clearToken, getToken, setToken } from "../services/token.service";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(() => getToken());

  const loginWithToken = (token: string) => {
    setToken(token);
    setTokenState(token);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
  };

  useEffect(() => {
    const onStorage = () => setTokenState(getToken());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      token: tokenState,
      isAuthenticated: !!tokenState,
      loginWithToken,
      logout,
    }),
    [tokenState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
