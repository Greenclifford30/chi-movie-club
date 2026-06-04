"use client";

import {
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthState = {
  email: string | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const storageKey = "movie-club-auth";

function getPool() {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error("Cognito user pool configuration is missing.");
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
  });
}

function tokenFromSession(session: CognitoUserSession) {
  return session.getIdToken().getJwtToken();
}

function emailFromSession(session: CognitoUserSession, fallbackEmail: string) {
  const payload = session.getIdToken().decodePayload() as { email?: unknown };
  return typeof payload.email === "string" && payload.email ? payload.email : fallbackEmail;
}

function currentSession(user: CognitoUser) {
  return new Promise<CognitoUserSession>((resolve, reject) => {
    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      if (error || !session?.isValid()) {
        reject(error || new Error("Saved Cognito session is no longer valid."));
        return;
      }
      resolve(session);
    });
  });
}

function refreshSession(user: CognitoUser, session: CognitoUserSession) {
  return new Promise<CognitoUserSession>((resolve, reject) => {
    user.refreshSession(session.getRefreshToken(), (error: Error | null, refreshedSession: CognitoUserSession | null) => {
      if (error || !refreshedSession?.isValid()) {
        reject(error || new Error("Unable to refresh Cognito session."));
        return;
      }
      resolve(refreshedSession);
    });
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const pool = getPool();
        const user = pool.getCurrentUser();
        if (!user) {
          window.localStorage.removeItem(storageKey);
          return;
        }

        const cachedSession = await currentSession(user);
        const session = await refreshSession(user, cachedSession).catch(() => cachedSession);
        const nextToken = tokenFromSession(session);
        const saved = window.localStorage.getItem(storageKey);
        const savedEmail = saved ? (JSON.parse(saved) as { email?: string }).email : undefined;
        const nextEmail = emailFromSession(session, savedEmail || user.getUsername());

        if (!cancelled) {
          setEmail(nextEmail);
          setToken(nextToken);
          window.localStorage.setItem(storageKey, JSON.stringify({ email: nextEmail, token: nextToken }));
        }
      } catch {
        if (!cancelled) {
          setEmail(null);
          setToken(null);
          window.localStorage.removeItem(storageKey);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (nextEmail: string, password: string) => {
    const pool = getPool();
    const username = nextEmail.trim();
    if (!username) {
      throw new Error("Email is required.");
    }
    const user = new CognitoUser({
      Username: username,
      Pool: pool,
    });
    const details = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const session = await new Promise<CognitoUserSession>((resolve, reject) => {
      user.authenticateUser(details, {
        onSuccess: resolve,
        onFailure: reject,
        newPasswordRequired: () => reject(new Error("A new password is required before this account can sign in.")),
      });
    });

    const nextToken = tokenFromSession(session);
    const sessionEmail = emailFromSession(session, username);
    setEmail(sessionEmail);
    setToken(nextToken);
    window.localStorage.setItem(storageKey, JSON.stringify({ email: sessionEmail, token: nextToken }));
  }, []);

  const signUp = useCallback(async (nextEmail: string, password: string) => {
    const pool = getPool();
    const normalizedEmail = nextEmail.trim().toLowerCase();
    const attributes = [
      new CognitoUserAttribute({
        Name: "email",
        Value: normalizedEmail,
      }),
    ];

    await new Promise<void>((resolve, reject) => {
      pool.signUp(normalizedEmail, password, attributes, [], (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }, []);

  const confirmSignUp = useCallback(async (nextEmail: string, code: string) => {
    const pool = getPool();
    const normalizedEmail = nextEmail.trim().toLowerCase();
    const user = new CognitoUser({
      Username: normalizedEmail,
      Pool: pool,
    });

    await new Promise<void>((resolve, reject) => {
      user.confirmRegistration(code.trim(), true, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }, []);

  const signOut = useCallback(() => {
    try {
      const pool = getPool();
      const user = pool.getCurrentUser();
      user?.signOut();
    } catch {
      // Local session cleanup still matters if Cognito config is not present.
    }
    setEmail(null);
    setToken(null);
    window.localStorage.removeItem(storageKey);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      email,
      token,
      isLoading,
      isAuthenticated: Boolean(token),
      signIn,
      signUp,
      confirmSignUp,
      signOut,
    }),
    [email, token, isLoading, signIn, signUp, confirmSignUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
