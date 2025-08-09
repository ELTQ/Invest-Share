// src/screens/HomePage.tsx
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { guest } from "@/state/guest";
import { me } from "@/hooks/useAuth";

export function HomePage() {
  const nav = useNavigate();
  const { data: meData, isLoading } = useQuery({ queryKey: ["me"], queryFn: me });

  // wait until we know auth state
  if (isLoading) return null;

  // already logged in → go to Public
  if (meData) return <Navigate to="/public" replace />;

  // guest landing
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-semibold">Track & share portfolios with clarity.</h1>
        <p className="text-text-muted">
          Invest Share helps you track and share your investment portfolios.
          Not financial advice. Non-commercial use.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => nav("/login")}>Log in</Button>
          <Button
            variant="ghost"
            onClick={() => {
              guest.set(true);     // mark session as guest
              nav("/public");      // go straight to Public Portfolios
            }}
          >
            Continue as guest
          </Button>
        </div>
      </section>

      <section className="text-center text-sm text-text-muted">
        Disclaimer: This app is for educational purposes only and does not provide investment advice.
      </section>
    </div>
  );
}
