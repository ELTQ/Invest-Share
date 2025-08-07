// src/screens/LoginPage.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "@/hooks/useAuth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export default function LoginPage() {
  const nav = useNavigate();

  // login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const me = await login(username.trim(), password);
      // On success, go to public portfolios (as requested)
      nav("/public");
    } catch {
      setErr("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md w-full space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Invest Share</h1>
        <p className="text-text-muted text-sm">Sign in or continue as guest</p>
      </div>

      <div className="card p-4 space-y-3">
        {/* Login only */}
        <form className="space-y-3" onSubmit={onLogin}>
          <Input
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={loading} disabled={!username || !password}>
            Log in
          </Button>
          {err && <p className="text-danger-500 text-sm">{err}</p>}
        </form>

        {/* Link to register page */}
        <div className="text-sm text-center">
          Don’t have an account?{" "}
          <Link to="/register" className="text-brand hover:underline">
            Create one
          </Link>
        </div>

        {/* Guest */}
        <div className="pt-2 border-t border-stroke-soft">
          <Button variant="ghost" onClick={() => nav("/public")}>
            Continue as guest
          </Button>
        </div>

        <p className="text-[11px] text-text-muted">
          Disclaimer: Not financial advice / not for profit.
        </p>
      </div>

      <div className="text-center text-xs text-text-muted">
        By using this site you agree to the Terms and acknowledge the Disclaimer.
      </div>
    </div>
  );
}
