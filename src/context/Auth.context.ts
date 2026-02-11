import { createContext } from "react";

export type AuthContextType = {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;

  allowedModules: Set<string>;

  loginWithToken: (token: string, email?: string, allowedModules?: string[]) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);



