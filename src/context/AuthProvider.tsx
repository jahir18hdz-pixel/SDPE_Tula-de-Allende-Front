import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./Auth.context";
import { clearToken, getToken, setToken } from "../services/token.service";

function readAllowedModulesFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem("allowedModules");
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(arr)) {
      return new Set(arr.map(String).filter(Boolean));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(() => getToken());
  const [emailState, setEmailState] = useState<string | null>(() =>
    localStorage.getItem("userEmail")
  );

  const [allowedModulesState, setAllowedModulesState] = useState<Set<string>>(() =>
    readAllowedModulesFromStorage()
  );

  const loginWithToken = (token: string, email?: string, allowedModules?: string[]) => {
    setToken(token);
    setTokenState(token);

    if (email) {
      localStorage.setItem("userEmail", email);
      setEmailState(email);
    }

    if (allowedModules) {
      localStorage.setItem("allowedModules", JSON.stringify(allowedModules));
      setAllowedModulesState(new Set(allowedModules));
    } else {
      setAllowedModulesState(readAllowedModulesFromStorage());
    }
  };

  const logout = () => {
  clearToken();

  localStorage.removeItem("auth"); 
  localStorage.removeItem("userEmail");
  localStorage.removeItem("allowedModules");

  setTokenState(null);
  setEmailState(null);
  setAllowedModulesState(new Set());
};

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "authToken" || e.key === "token") {
        setTokenState(getToken());
      }

      if (e.key === "userEmail") {
        setEmailState(localStorage.getItem("userEmail"));
      }

      if (e.key === "allowedModules") {
        setAllowedModulesState(readAllowedModulesFromStorage());
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      token: tokenState,
      email: emailState,
      isAuthenticated: !!tokenState,
      allowedModules: allowedModulesState, 
      loginWithToken, 
      logout,
    }),
    [tokenState, emailState, allowedModulesState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
