import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "@/contexts/auth-context.shared";
import { buildApiUrl, isRemoteStorageEnabled } from "@/lib/submission-env";

const AUTH_STORAGE_KEY = "tracking-os-auth";
const AUTH_USER_STORAGE_KEY = "tracking-os-auth-user";

const remoteModeEnabled = isRemoteStorageEnabled();

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
  const [isCheckingSession, setIsCheckingSession] = useState(remoteModeEnabled);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) return false;

    if (!remoteModeEnabled) {
      setAuthState({
        isLoggedIn: true,
        adminEmail: normalizedEmail,
      });
      return true;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.authenticated) {
        return false;
      }

      setAuthState({
        isLoggedIn: true,
        adminEmail: payload.email || normalizedEmail,
      });
      return true;
    } catch {
      return false;
    }
  };

  const register = async (input: {
    fullName: string;
    email: string;
    password: string;
    registrationCode?: string;
  }) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!fullName || !normalizedEmail || !input.password.trim()) return false;

    if (!remoteModeEnabled) {
      setAuthState({
        isLoggedIn: true,
        adminEmail: normalizedEmail,
      });
      return true;
    }

    try {
      const response = await fetch(buildApiUrl("/api/auth/register"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email: normalizedEmail,
          password: input.password,
          registrationCode: input.registrationCode || "",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.authenticated) {
        return false;
      }

      setAuthState({
        isLoggedIn: true,
        adminEmail: payload.email || normalizedEmail,
      });
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    if (remoteModeEnabled) {
      void fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    }

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
  }, [isLoggedIn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminEmail) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, adminEmail);
      return;
    }
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }, [adminEmail]);

  useEffect(() => {
    if (!remoteModeEnabled || typeof window === "undefined") {
      setIsCheckingSession(false);
      return;
    }

    let isMounted = true;
    const verifySession = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));

        if (!isMounted) return;
        if (!response.ok || !payload?.email) {
          setAuthState({
            isLoggedIn: false,
            adminEmail: "",
          });
          return;
        }

        setAuthState({
          isLoggedIn: true,
          adminEmail: payload.email,
        });
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, adminEmail, isCheckingSession, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
