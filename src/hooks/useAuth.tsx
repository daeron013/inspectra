import { createContext, ReactNode, useContext, useEffect } from "react";
import { Auth0Provider, AppState, useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { setApiAccessTokenProvider } from "@/lib/api";

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

function parseOrganizationNameMap(rawValue: string | undefined) {
  if (!rawValue) return {};

  return Object.fromEntries(
    rawValue
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf(":");
        if (separatorIndex === -1) return null;

        const organizationId = entry.slice(0, separatorIndex).trim();
        const organizationName = entry.slice(separatorIndex + 1).trim();
        if (!organizationId || !organizationName) return null;
        return [organizationId, organizationName];
      })
      .filter((entry): entry is [string, string] => Array.isArray(entry))
  );
}

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
  const organizationNameMap = parseOrganizationNameMap(import.meta.env.VITE_AUTH0_ORGANIZATION_NAMES);
  const organizationId =
    typeof (user as Record<string, unknown> | undefined)?.org_id === "string"
      ? ((user as Record<string, string>).org_id as string)
      : undefined;
  const explicitOrganizationName =
    typeof (user as Record<string, unknown> | undefined)?.org_name === "string"
      ? ((user as Record<string, string>).org_name as string)
      : undefined;
  const mappedOrganizationName = organizationId ? organizationNameMap[organizationId] : undefined;

  useEffect(() => {
    setApiAccessTokenProvider(async () => {
      if (!isAuthenticated) return null;
      return getAccessTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {}),
        },
        cacheMode: "off",
      });
    });

    return () => {
      setApiAccessTokenProvider(null);
    };
  }, [audience, getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const resolvedOrganizationName = explicitOrganizationName || mappedOrganizationName;
    if (resolvedOrganizationName) {
      localStorage.setItem("inspectra:last-org-name", resolvedOrganizationName);
      return;
    }

    localStorage.removeItem("inspectra:last-org-name");
  }, [explicitOrganizationName, isAuthenticated, mappedOrganizationName, user]);

  const fallbackOrganizationName =
    typeof window !== "undefined" ? localStorage.getItem("inspectra:last-org-name") || undefined : undefined;

  const appUser = user
    ? {
        id: user.sub || user.email || "unknown-user",
        email: user.email,
        name: user.name,
        picture: user.picture,
        organizationId,
        organizationName: explicitOrganizationName || mappedOrganizationName || fallbackOrganizationName,
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
      return getAccessTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {}),
        },
        cacheMode: "off",
      });
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
