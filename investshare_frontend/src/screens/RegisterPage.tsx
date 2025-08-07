// src/screens/RegisterPage.tsx
import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { register, login } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";

export function RegisterPage() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [email, setE] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      // auto-login after successful registration
      await login(username.trim(), password);
      // go to My Portfolio (your original behavior). If you want /public, change below.
      nav("/my-portfolio");
    } catch (e: any) {
      // Try to extract backend error message if present
      const msg =
        e?.message ||
        e?.detail ||
        (typeof e === "object" && e !== null ? JSON.stringify(e) : "") ||
        "Registration failed.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Create account</h2>
        <p className="text-sm text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">Log in</Link>
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setU(e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setE(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setP(e.target.value)}
        />

        {err && <p className="text-danger-500 text-sm">{err}</p>}

        <Button type="submit" className="w-full" loading={loading} disabled={!canSubmit || loading}>
          Sign up
        </Button>

        <p className="text-[11px] text-text-muted">
          By creating an account you agree to our terms. Not financial advice / not for profit.
        </p>
      </form>
    </div>
  );
}
