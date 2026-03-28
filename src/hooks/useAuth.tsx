import { createContext, ReactNode, useContext, useEffect } from "react";
import { Auth0Provider, AppState, useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { setApiAccessTokenProvider } from "@/lib/api";

type AppUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type AuthContextType = {
  session: { user: AppUser } | null;
  user: AppUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  login: () => Promise<void>;
  signup: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
  getAccessToken: async () => null,
  signOut: async () => {},
  login: async () => {},
  signup: async () => {},
});

function Auth0Bridge({ children }: { children: ReactNode }) {
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const {
    isAuthenticated,
    isLoading,
    user,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();
  const auth0Origin = `${window.location.origin}/`;

  const appUser = user
    ? {
        id: user.sub || user.email || "unknown-user",
        email: user.email,
        name: user.name,
        picture: user.picture,
      }
    : null;

  useEffect(() => {
    setApiAccessTokenProvider(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently({
          authorizationParams: {
            ...(audience ? { audience } : {}),
          },
          cacheMode: "off",
        });
      } catch {
        return null;
      }
    });

    return () => {
      setApiAccessTokenProvider(null);
    };
  }, [audience, getAccessTokenSilently, isAuthenticated]);

  const value: AuthContextType = {
    session: appUser ? { user: appUser } : null,
    user: appUser,
    loading: isLoading,
    isAuthenticated,
    error: error?.message || null,
    getAccessToken: async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently({
          authorizationParams: {
            ...(audience ? { audience } : {}),
          },
          cacheMode: "off",
        });
      } catch {
        return null;
      }
    },
    signOut: async () => {
      logout({
        logoutParams: {
          returnTo: auth0Origin,
        },
      });
    },
    login: async () => {
      await loginWithRedirect({
        appState: { returnTo: "/" },
        authorizationParams: {
          redirect_uri: auth0Origin,
          ...(audience ? { audience } : {}),
        },
      });
    },
    signup: async () => {
      await loginWithRedirect({
        appState: { returnTo: "/" },
        authorizationParams: {
          redirect_uri: auth0Origin,
          ...(audience ? { audience } : {}),
          screen_hint: "signup",
        },
      });
    },
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
