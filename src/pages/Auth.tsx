import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Shield, LogIn, UserPlus } from "lucide-react";

const AuthPage = () => {
  const { session, loading: authLoading, login, signup } = useAuth();

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
          <Button type="button" onClick={() => void login()} className="w-full gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          <Button type="button" variant="outline" onClick={() => void signup()} className="w-full gap-2">
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
