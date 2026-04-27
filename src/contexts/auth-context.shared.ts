import { createContext } from "react";

export interface AuthContextType {
  isLoggedIn: boolean;
  adminEmail: string;
  isCheckingSession: boolean;
  login: (email: string, password: string) => boolean | Promise<boolean>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    registrationCode?: string;
  }) => boolean | Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
