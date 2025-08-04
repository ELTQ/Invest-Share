import { Link, useNavigate } from "react-router-dom";
import { auth } from "@/state/auth";
import { Button } from "./Button";
import { useAuthStatus } from "@/state/useAuthStatus";
import { useGuestStatus } from "@/state/guest";


export function Navbar() {
  const nav = useNavigate();
  const loggedIn = useAuthStatus(); // ← reactive
  const isGuest = useGuestStatus();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-stroke-soft bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <Link to={isGuest ? "/" : "/public"} className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-brand"></div>
          <span className="text-base font-semibold">Invest Share</span>
        </Link>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <Button variant="ghost" onClick={() => nav("/my-portfolio")}>My Portfolio</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  auth.clear();
                  nav("/login");
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => nav("/login")}>Log in</Button>
              <Button onClick={() => nav("/register")}>Sign up</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
