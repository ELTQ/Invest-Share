// src/routes.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { HomePage } from "@/screens/HomePage";
import LoginPage from "@/screens/LoginPage";
import { RegisterPage } from "@/screens/RegisterPage";
import { PublicPortfoliosPage } from "@/screens/PublicPortfoliosPage";
import { PortfolioPage } from "@/screens/PortfolioPage";
import { MyPortfolioPage } from "@/screens/MyPortfolioPage";
import { me } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

// Redirects logged-in users away from "/" to "/public"
function AutoHome() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: me, staleTime: 60_000 });
  if (isLoading) return null;                // avoid flicker while checking
  return data ? <Navigate to="/public" replace /> : <HomePage />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <AutoHome /> },                 // ← changed
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "public", element: <PublicPortfoliosPage /> },
      { path: "portfolio/:id", element: <PortfolioPage /> },
      { path: "my-portfolio", element: <MyPortfolioPage /> },
    ],
  },
]);
