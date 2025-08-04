import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { guest } from "@/state/guest";

export function HomePage() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-semibold">Track & share portfolios with clarity.</h1>
        <p className="text-text-muted">
          Invest Share helps you visualize performance, allocations, and trades. Not financial advice. Non-commercial use.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => nav("/login")}>Log in</Button>
          <Button
         variant="ghost"
         onClick={() => {
           guest.set(true);      // remember guest session
           nav("/public");       // guest goes to Browse Public Portfolios
        }}
        >
         Continue as guest
       </Button>
        </div>
      </section>
      <section className="text-center text-sm text-text-muted">
        Disclaimer: This app is for educational purposes only and does not provide investment advice.
      </section>
      <section className="text-center">
        <Link to="/public" className="text-brand underline">Browse public portfolios →</Link>
      </section>
    </div>
  );
}
