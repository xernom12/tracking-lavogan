import { useEffect, useState, ReactNode } from "react";
import { AuthContext } from "@/contexts/auth-context.shared";

const AUTH_STORAGE_KEY = "tracking-os-auth";
const AUTH_USER_STORAGE_KEY = "tracking-os-auth-user";

const getInitialAuthState = () => {
  if (typeof window === "undefined") {
    return {
      isLoggedIn: false,
      adminEmail: "",
    };
  }

  return {
    isLoggedIn: window.localStorage.getItem(AUTH_STORAGE_KEY) === "true",
    adminEmail: window.localStorage.getItem(AUTH_USER_STORAGE_KEY) || "",
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [{ isLoggedIn, adminEmail }, setAuthState] = useState(getInitialAuthState);

  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) return false;

    setAuthState({
      isLoggedIn: true,
      adminEmail: normalizedEmail,
    });
    return true;
  };

  const logout = () => {
    setAuthState({
      isLoggedIn: false,
      adminEmail: "",
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoggedIn) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      return;
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [adminEmail, isLoggedIn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminEmail) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, adminEmail);
      return;
    }
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }, [adminEmail]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, adminEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
