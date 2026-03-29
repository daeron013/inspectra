import { createContext, ReactNode, useContext, useEffect } from "react";
import { Auth0Provider, AppState, useAuth0 } from "@auth0/auth0-react";
import type { GetTokenSilentlyVerboseResponse } from "@auth0/auth0-spa-js";
import { useNavigate } from "react-router-dom";
import { setApiAccessTokenProvider } from "@/lib/api";

/** Auth0 often returns an opaque access token when no API audience is configured; ID token is always a JWT. */
function isLikelyJwt(value: string | undefined): value is string {
  return typeof value === "string" && value.split(".").length === 3;
}

function pickJwtForApi(response: string | GetTokenSilentlyVerboseResponse): string | null {
  if (typeof response === "string") {
    return isLikelyJwt(response) ? response : null;
  }
  if (isLikelyJwt(response.access_token)) return response.access_token;
  if (isLikelyJwt(response.id_token)) return response.id_token;
  return null;
}

type AppUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  organizationId?: string;
  organizationName?: string;
};

type AuthContextType = {
  session: { user: AppUser } | null;
  user: AppUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  login: (organization: string) => Promise<void>;
  signup: (organization: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  error: string | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {},
  login: async () => {},
  signup: async () => {},
  getAccessToken: async () => null,
  error: null,
});

function Auth0Bridge({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    error,
    getAccessTokenSilently,
  } = useAuth0();
  const auth0Origin = `${window.location.origin}/`;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  useEffect(() => {
    setApiAccessTokenProvider(async () => {
      if (!isAuthenticated) return null;
      const response = await getAccessTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {}),
        },
        cacheMode: "off",
        detailedResponse: true,
      });
      return pickJwtForApi(response);
    });

    return () => {
      setApiAccessTokenProvider(null);
    };
  }, [audience, getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const explicitOrgName =
      typeof (user as Record<string, unknown>).org_name === "string"
        ? (user as Record<string, string>).org_name
        : null;

    if (explicitOrgName) {
      localStorage.setItem("inspectra:last-org-name", explicitOrgName);
      return;
    }

    const typedOrganization = localStorage.getItem("inspectra:last-org");
    if (typedOrganization) {
      localStorage.setItem("inspectra:last-org-name", typedOrganization);
    }
  }, [isAuthenticated, user]);

  const fallbackOrganizationName =
    typeof window !== "undefined" ? localStorage.getItem("inspectra:last-org-name") || undefined : undefined;

  const appUser = user
    ? {
        id: user.sub || user.email || "unknown-user",
        email: user.email,
        name: user.name,
        picture: user.picture,
        organizationId: typeof (user as Record<string, unknown>).org_id === "string" ? (user as Record<string, string>).org_id : undefined,
        organizationName:
          (typeof (user as Record<string, unknown>).org_name === "string"
            ? (user as Record<string, string>).org_name
            : undefined) || fallbackOrganizationName,
      }
    : null;

  const value: AuthContextType = {
    session: appUser ? { user: appUser } : null,
    user: appUser,
    loading: isLoading,
    isAuthenticated,
    signOut: async () => {
      logout({
        logoutParams: {
          returnTo: auth0Origin,
        },
      });
    },
    login: async (organization: string) => {
      await loginWithRedirect({
        appState: { returnTo: "/" },
        authorizationParams: {
          redirect_uri: auth0Origin,
          ...(audience ? { audience } : {}),
          organization,
        },
      });
    },
    signup: async (organization: string) => {
      await loginWithRedirect({
        appState: { returnTo: "/" },
        authorizationParams: {
          redirect_uri: auth0Origin,
          ...(audience ? { audience } : {}),
          organization,
          screen_hint: "signup",
        },
      });
    },
    getAccessToken: async () => {
      if (!isAuthenticated) return null;
      const response = await getAccessTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {}),
        },
        cacheMode: "off",
        detailedResponse: true,
      });
      return pickJwtForApi(response);
    },
    error: error?.message || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0ProviderWithNavigate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-2">
          <div className="text-lg font-semibold text-foreground">Auth0 is not configured</div>
          <div className="text-sm text-muted-foreground">
            Set `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` to enable authentication.
          </div>
        </div>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/`,
        ...(audience ? { audience } : {}),
      }}
      onRedirectCallback={(appState?: AppState) => {
        navigate(appState?.returnTo || "/", { replace: true });
      }}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Auth0ProviderWithNavigate>{children}</Auth0ProviderWithNavigate>;
}

export const useAuth = () => useContext(AuthContext);
