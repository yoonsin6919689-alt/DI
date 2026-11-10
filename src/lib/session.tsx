import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { User, Verification } from "./types";

type SessionValue = {
  user: User | null;
  verification: Verification | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applySession: (user: User, verification: Verification | null) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: User; verification: Verification | null }>("/api/me");
      setUser(result.user);
      setVerification(result.verification);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null);
        setVerification(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Approval or in-game verification happens outside this tab, so the cached
  // user must be re-read when the window regains focus and while waiting.
  useEffect(() => {
    if (!user) return;
    const revalidate = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [user, refresh]);

  useEffect(() => {
    if (!user || user.verified) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [user, refresh]);

  const applySession = useCallback((nextUser: User, nextVerification: Verification | null) => {
    setUser(nextUser);
    setVerification(nextVerification);
  }, []);

  const logout = useCallback(async () => {
    await api("/api/logout", { method: "POST" });
    setUser(null);
    setVerification(null);
  }, []);

  const value = useMemo(
    () => ({ user, verification, loading, refresh, applySession, logout }),
    [user, verification, loading, refresh, applySession, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
