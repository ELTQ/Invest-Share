import { Navigate, useLocation } from "react-router-dom";
import { useAuthStatus } from "@/state/useAuthStatus";

export function LoggedOutOnly({ children }: { children: JSX.Element }) {
  const loggedIn = useAuthStatus();
  const loc = useLocation();
  if (loggedIn) return <Navigate to="/public" replace state={{ from: loc }} />;
  return children;
}
