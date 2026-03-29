import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Shield, LogIn, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const AuthPage = () => {
  const { session, loading: authLoading, login, signup, error } = useAuth();
  const [organization, setOrganization] = useState(() => localStorage.getItem("inspectra:last-org") || "");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const normalizedOrganization = organization.trim();

  const handleLogin = async () => {
    if (!normalizedOrganization) return;
    localStorage.setItem("inspectra:last-org", normalizedOrganization);
    await login(normalizedOrganization);
  };

  const handleSignup = async () => {
    if (!normalizedOrganization) return;
    localStorage.setItem("inspectra:last-org", normalizedOrganization);
    await signup(normalizedOrganization);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Inspectra</h1>
          <p className="text-sm text-muted-foreground">Use Auth0 Universal Login to access your QMS workspace.</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">Organization</div>
            <Input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              placeholder="Your organization"
              autoComplete="organization"
            />
            <p className="text-[11px] text-muted-foreground">
              Sign in through your organization so Inspectra only shows your company’s documents and records.
            </p>
          </div>
          <Button type="button" onClick={() => void handleLogin()} className="w-full gap-2" disabled={!normalizedOrganization}>
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleSignup()} className="w-full gap-2" disabled={!normalizedOrganization}>
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Authentication is handled by Auth0. Open this app at `http://127.0.0.1:8080/` to match your configured callback URL exactly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
