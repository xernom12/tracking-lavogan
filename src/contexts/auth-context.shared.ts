import { createContext } from "react";

export interface AuthContextType {
  isLoggedIn: boolean;
  adminEmail: string;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
