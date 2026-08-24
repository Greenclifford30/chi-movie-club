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
  identityProvider: "google" | "cognito" | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (redirect?: string) => Promise<void>;
  completeHostedUiSignIn: (code: string, state: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const storageKey = "movie-club-auth";
const hostedUiRequestKey = "movie-club-hosted-ui-request";

type StoredAuthSession = {
  email: string;
  token: string;
  source?: "srp" | "hosted-ui";
  identityProvider?: "google" | "cognito";
  refreshToken?: string;
  expiresAt?: number;
};

type HostedUiRequest = {
  codeVerifier: string;
  redirect: string;
  state: string;
};

type HostedUiTokenResponse = {
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

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

function getClientId() {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
  if (!clientId) {
    throw new Error("Cognito app client configuration is missing.");
  }
  return clientId;
}

function getHostedUiDomain() {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  if (!domain) {
    throw new Error("Cognito Hosted UI domain is missing. Set NEXT_PUBLIC_COGNITO_DOMAIN.");
  }
  return domain.replace(/\/+$/, "");
}

function getCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function tokenFromSession(session: CognitoUserSession) {
  return session.getIdToken().getJwtToken();
}

function emailFromSession(session: CognitoUserSession, fallbackEmail: string) {
  const payload = session.getIdToken().decodePayload() as { email?: unknown };
  return typeof payload.email === "string" && payload.email ? payload.email : fallbackEmail;
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Cognito returned an invalid ID token.");
  }

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = window.atob(padded);
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as { email?: unknown; exp?: unknown };
}

function emailFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("Cognito ID token did not include an email address.");
  }
  return payload.email;
}

function expiresAtFromToken(token: string, fallbackSeconds?: number) {
  const payload = decodeJwtPayload(token);
  if (typeof payload.exp === "number") {
    return payload.exp * 1000;
  }
  return Date.now() + (fallbackSeconds || 3600) * 1000;
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

function safeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/clubs";
  }
  return value;
}

function saveSession(nextSession: StoredAuthSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
}

function readSavedSession() {
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    return null;
  }
  return JSON.parse(saved) as StoredAuthSession;
}

function randomUrlSafeString(length = 32) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createCodeChallenge(codeVerifier: string) {
  const bytes = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(digest);
}

async function exchangeHostedUiTokens(body: URLSearchParams) {
  const response = await fetch(`${getHostedUiDomain()}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await response.json()) as HostedUiTokenResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || "Unable to complete Google sign-in.");
  }
  if (!data.id_token) {
    throw new Error("Cognito did not return an ID token.");
  }
  return data;
}

async function refreshHostedUiSession(refreshToken: string) {
  return exchangeHostedUiTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getClientId(),
      refresh_token: refreshToken,
    })
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [identityProvider, setIdentityProvider] = useState<"google" | "cognito" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const saved = readSavedSession();
        if (saved?.source === "hosted-ui" && saved.refreshToken) {
          const needsRefresh = !saved.expiresAt || saved.expiresAt - Date.now() < 60_000;
          const refreshed = needsRefresh ? await refreshHostedUiSession(saved.refreshToken) : null;
          const nextToken = refreshed?.id_token || saved.token;
          const nextRefreshToken = refreshed?.refresh_token || saved.refreshToken;
          const nextEmail = emailFromToken(nextToken);
          const nextSession: StoredAuthSession = {
            email: nextEmail,
            token: nextToken,
            source: "hosted-ui",
            identityProvider: saved.identityProvider || "google",
            refreshToken: nextRefreshToken,
            expiresAt: expiresAtFromToken(nextToken, refreshed?.expires_in),
          };

          if (!cancelled) {
            setEmail(nextEmail);
            setToken(nextToken);
            setIdentityProvider(nextSession.identityProvider || "google");
            saveSession(nextSession);
          }
          return;
        }

        const pool = getPool();
        const user = pool.getCurrentUser();
        if (!user) {
          window.localStorage.removeItem(storageKey);
          return;
        }

        const cachedSession = await currentSession(user);
        const session = await refreshSession(user, cachedSession).catch(() => cachedSession);
        const nextToken = tokenFromSession(session);
        const nextEmail = emailFromSession(session, saved?.email || user.getUsername());

        if (!cancelled) {
          setEmail(nextEmail);
          setToken(nextToken);
          setIdentityProvider("cognito");
          saveSession({ email: nextEmail, token: nextToken, source: "srp", identityProvider: "cognito" });
        }
      } catch {
        if (!cancelled) {
          setEmail(null);
          setToken(null);
          setIdentityProvider(null);
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
    setIdentityProvider("cognito");
    saveSession({ email: sessionEmail, token: nextToken, source: "srp", identityProvider: "cognito" });
  }, []);

  const signInWithGoogle = useCallback(async (redirect?: string) => {
    const state = randomUrlSafeString();
    const codeVerifier = randomUrlSafeString(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const nextRedirect = safeRedirect(redirect);
    const request: HostedUiRequest = {
      codeVerifier,
      redirect: nextRedirect,
      state,
    };

    window.sessionStorage.setItem(hostedUiRequestKey, JSON.stringify(request));

    const params = new URLSearchParams({
      client_id: getClientId(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      identity_provider: "Google",
      redirect_uri: getCallbackUrl(),
      response_type: "code",
      scope: "openid email profile",
      state,
    });

    window.location.assign(`${getHostedUiDomain()}/oauth2/authorize?${params}`);
  }, []);

  const completeHostedUiSignIn = useCallback(async (code: string, state: string) => {
    const savedRequest = window.sessionStorage.getItem(hostedUiRequestKey);
    if (!savedRequest) {
      throw new Error("Google sign-in request was not found. Please start sign-in again.");
    }

    const request = JSON.parse(savedRequest) as HostedUiRequest;
    if (request.state !== state) {
      throw new Error("Google sign-in state did not match. Please start sign-in again.");
    }

    const data = await exchangeHostedUiTokens(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: getClientId(),
        code,
        code_verifier: request.codeVerifier,
        redirect_uri: getCallbackUrl(),
      })
    );
    const nextToken = data.id_token || "";
    const nextEmail = emailFromToken(nextToken);
    const nextSession: StoredAuthSession = {
      email: nextEmail,
      token: nextToken,
      source: "hosted-ui",
      identityProvider: "google",
      refreshToken: data.refresh_token,
      expiresAt: expiresAtFromToken(nextToken, data.expires_in),
    };

    setEmail(nextEmail);
    setToken(nextToken);
    setIdentityProvider("google");
    saveSession(nextSession);
    window.sessionStorage.removeItem(hostedUiRequestKey);
    return safeRedirect(request.redirect);
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
    setIdentityProvider(null);
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(hostedUiRequestKey);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      email,
      token,
      identityProvider,
      isLoading,
      isAuthenticated: Boolean(token),
      signIn,
      signInWithGoogle,
      completeHostedUiSignIn,
      signUp,
      confirmSignUp,
      signOut,
    }),
    [email, token, identityProvider, isLoading, signIn, signInWithGoogle, completeHostedUiSignIn, signUp, confirmSignUp, signOut]
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
