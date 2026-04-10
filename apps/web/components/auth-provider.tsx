"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api, AuthResponse, AuthUser } from "../lib/api";

const STORAGE_KEY = "sporza-auth";

/** Seconds since epoch, or null if token is not a JWT / has no exp. */
function getJwtExpSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isReady: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; username: string; fullName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function persistAuth(auth: AuthResponse | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!auth) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setIsReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as AuthResponse;
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken);

        const exp = getJwtExpSeconds(parsed.accessToken);
        const now = Math.floor(Date.now() / 1000);
        const needsRefresh = exp !== null && exp <= now + 60;

        if (needsRefresh && parsed.refreshToken) {
          const next = await api.refresh(parsed.refreshToken);
          if (cancelled) return;
          setUser(next.user);
          setAccessToken(next.accessToken);
          setRefreshToken(next.refreshToken);
          persistAuth(next);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
      }

      if (!cancelled) {
        setIsReady(true);
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!refreshToken) {
      return;
    }

    const intervalMs = 10 * 60 * 1000;

    const id = window.setInterval(() => {
      const rt = refreshTokenRef.current;
      if (!rt) return;

      void (async () => {
        try {
          const next = await api.refresh(rt);
          setUser(next.user);
          setAccessToken(next.accessToken);
          setRefreshToken(next.refreshToken);
          persistAuth(next);
        } catch {
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
          persistAuth(null);
        }
      })();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [refreshToken]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isReady,
      login: async (payload) => {
        const result = await api.login(payload);
        setUser(result.user);
        setAccessToken(result.accessToken);
        setRefreshToken(result.refreshToken);
        persistAuth(result);
      },
      register: async (payload) => {
        const result = await api.register(payload);
        setUser(result.user);
        setAccessToken(result.accessToken);
        setRefreshToken(result.refreshToken);
        persistAuth(result);
      },
      logout: () => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        persistAuth(null);
      },
    }),
    [accessToken, isReady, refreshToken, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
