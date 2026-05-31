"use client";

import {
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { email?: string; token?: string };
        setEmail(parsed.email || null);
        setToken(parsed.token || null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async (nextEmail: string, password: string) => {
    const pool = getPool();
    const user = new CognitoUser({
      Username: nextEmail,
      Pool: pool,
    });
    const details = new AuthenticationDetails({
      Username: nextEmail,
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
    setEmail(nextEmail);
    setToken(nextToken);
    window.localStorage.setItem(storageKey, JSON.stringify({ email: nextEmail, token: nextToken }));
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
      signOut,
    }),
    [email, token, isLoading, signIn, signOut]
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
