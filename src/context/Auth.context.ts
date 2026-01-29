import { createContext } from "react";

export type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);
