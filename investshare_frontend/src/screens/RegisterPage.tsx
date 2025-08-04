import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { register, login } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function RegisterPage() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [email, setE] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await register(username, email, password);
      await login(username, password);
      nav("/my-portfolio");
    } catch (e: any) {
      setErr("Registration failed.");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h2 className="text-2xl font-semibold">Create account</h2>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input placeholder="Username" value={username} onChange={(e) => setU(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setE(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} />
        {err && <p className="text-danger-500 text-sm">{err}</p>}
        <Button type="submit" className="w-full">Sign up</Button>
      </form>
    </div>
  );
}
