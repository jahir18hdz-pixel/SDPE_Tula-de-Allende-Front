import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./Auth.context";
import { clearToken, getToken, setToken } from "../services/token.service";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(() => getToken());
  const [emailState, setEmailState] = useState<string | null>(() => localStorage.getItem("userEmail"));


  const loginWithToken = (token: string, email?: string) => {
    setToken(token);
    setTokenState(token);

     if (email) {
    localStorage.setItem("userEmail", email);
    setEmailState(email);
    }
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setEmailState(null);

  };

  useEffect(() => {
    const onStorage = () => setTokenState(getToken());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
  () => ({
    token: tokenState,
    email: emailState,
    isAuthenticated: !!tokenState,
    loginWithToken,
    logout,
  }),
  [tokenState, emailState]
);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
