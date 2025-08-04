import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { login } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";

export function LoginPage() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login(username, password);
      nav("/my-portfolio");
    } catch (e: any) {
      setErr("Invalid credentials.");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h2 className="text-2xl font-semibold">Log in</h2>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input placeholder="Username" value={username} onChange={(e) => setU(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} />
        {err && <p className="text-danger-500 text-sm">{err}</p>}
        <Button type="submit" className="w-full">Continue</Button>
      </form>
      <p className="text-sm text-text-muted">
        New here? <Link to="/register" className="text-brand">Create an account</Link>
      </p>
    </div>
  );
}
