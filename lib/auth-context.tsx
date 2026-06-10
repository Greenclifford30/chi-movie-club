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
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  completeGoogleSignIn: (code: string, state: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const storageKey = "movie-club-auth";
const oauthStateKey = "movie-club-oauth-state";
const defaultOauthScopes = "openid email profile";

type StoredAuth = {
  email?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
  provider?: "cognito" | "oauth";
};

type OauthState = {
  state: string;
  verifier: string;
  redirectPath: string;
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

function tokenFromSession(session: CognitoUserSession) {
  return session.getIdToken().getJwtToken();
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    return {};
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    return JSON.parse(atob(paddedPayload)) as { email?: unknown; exp?: unknown };
  } catch {
    return {};
  }
}

function emailFromSession(session: CognitoUserSession, fallbackEmail: string) {
  const payload = session.getIdToken().decodePayload() as { email?: unknown };
  return typeof payload.email === "string" && payload.email ? payload.email : fallbackEmail;
}

function emailFromToken(token: string, fallbackEmail = "") {
  const payload = decodeJwtPayload(token);
  return typeof payload.email === "string" && payload.email ? payload.email : fallbackEmail;
}

function expiresAtFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  return typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
}

function safeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/clubs";
  }
  return value;
}

function getOauthDomain() {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim();
  if (!domain) {
    throw new Error("Cognito OAuth domain is missing. Set NEXT_PUBLIC_COGNITO_DOMAIN.");
  }

  return domain.startsWith("https://") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
}

function getOauthRedirectUri() {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in is only available in the browser.");
  }

  return process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || `${window.location.origin}/auth/callback`;
}

function getOauthScopes() {
  return process.env.NEXT_PUBLIC_COGNITO_OAUTH_SCOPES || defaultOauthScopes;
}

function getOauthClientId() {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
  if (!clientId) {
    throw new Error("Cognito user pool client ID is missing.");
  }
  return clientId;
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(new Uint8Array(hash));
}

function readStoredAuth() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function storeAuth(nextAuth: StoredAuth) {
  window.localStorage.setItem(storageKey, JSON.stringify(nextAuth));
}

async function refreshOauthSession(refreshToken: string) {
  const response = await fetch(`${getOauthDomain()}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getOauthClientId(),
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Saved Google session could not be refreshed.");
  }

  return (await response.json()) as { id_token?: string; refresh_token?: string };
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
        const savedAuth = readStoredAuth();
        if (savedAuth?.provider === "oauth" && savedAuth.token) {
          const shouldRefresh = Boolean(savedAuth.refreshToken && (!savedAuth.expiresAt || savedAuth.expiresAt < Date.now() + 60_000));
          const refreshed = shouldRefresh && savedAuth.refreshToken ? await refreshOauthSession(savedAuth.refreshToken) : null;
          const nextToken = refreshed?.id_token || savedAuth.token;
          const nextEmail = emailFromToken(nextToken, savedAuth.email || "");
          const nextRefreshToken = refreshed?.refresh_token || savedAuth.refreshToken;
          const nextAuth = {
            email: nextEmail,
            token: nextToken,
            refreshToken: nextRefreshToken,
            expiresAt: expiresAtFromToken(nextToken),
            provider: "oauth" as const,
          };

          if (!cancelled) {
            setEmail(nextEmail);
            setToken(nextToken);
            storeAuth(nextAuth);
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
        const nextEmail = emailFromSession(session, savedAuth?.email || user.getUsername());

        if (!cancelled) {
          setEmail(nextEmail);
          setToken(nextToken);
          storeAuth({ email: nextEmail, token: nextToken, provider: "cognito" });
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
    storeAuth({ email: sessionEmail, token: nextToken, provider: "cognito" });
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    const state = randomBase64Url(24);
    const verifier = randomBase64Url(64);
    const challenge = await sha256Base64Url(verifier);
    const oauthState: OauthState = {
      state,
      verifier,
      redirectPath: safeRedirect(redirectPath),
    };

    window.sessionStorage.setItem(oauthStateKey, JSON.stringify(oauthState));

    const authorizationUrl = new URL(`${getOauthDomain()}/oauth2/authorize`);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", getOauthClientId());
    authorizationUrl.searchParams.set("redirect_uri", getOauthRedirectUri());
    authorizationUrl.searchParams.set("scope", getOauthScopes());
    authorizationUrl.searchParams.set("identity_provider", "Google");
    authorizationUrl.searchParams.set("code_challenge", challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("state", state);

    window.location.assign(authorizationUrl.toString());
  }, []);

  const completeGoogleSignIn = useCallback(async (code: string, state: string) => {
    const savedState = window.sessionStorage.getItem(oauthStateKey);
    if (!savedState) {
      throw new Error("Google sign-in session was not found. Please try again.");
    }

    const oauthState = JSON.parse(savedState) as OauthState;
    if (oauthState.state !== state) {
      throw new Error("Google sign-in state did not match. Please try again.");
    }

    const response = await fetch(`${getOauthDomain()}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: getOauthClientId(),
        redirect_uri: getOauthRedirectUri(),
        code,
        code_verifier: oauthState.verifier,
      }),
    });

    if (!response.ok) {
      throw new Error("Google sign-in could not be completed.");
    }

    const result = (await response.json()) as { id_token?: string; refresh_token?: string };
    if (!result.id_token) {
      throw new Error("Google sign-in did not return an ID token.");
    }

    const nextEmail = emailFromToken(result.id_token);
    const nextAuth = {
      email: nextEmail,
      token: result.id_token,
      refreshToken: result.refresh_token,
      expiresAt: expiresAtFromToken(result.id_token),
      provider: "oauth" as const,
    };

    setEmail(nextEmail);
    setToken(result.id_token);
    storeAuth(nextAuth);
    window.sessionStorage.removeItem(oauthStateKey);

    return safeRedirect(oauthState.redirectPath);
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
      signInWithGoogle,
      completeGoogleSignIn,
      signUp,
      confirmSignUp,
      signOut,
    }),
    [email, token, isLoading, signIn, signInWithGoogle, completeGoogleSignIn, signUp, confirmSignUp, signOut]
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
