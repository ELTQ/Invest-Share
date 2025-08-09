// src/routes.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { HomePage } from "@/screens/HomePage";
import LoginPage from "@/screens/LoginPage";
import { RegisterPage } from "@/screens/RegisterPage";

// IMPORTANT: use default imports for pages that default-export
import PublicPortfoliosPage from "@/screens/PublicPortfoliosPage"; // list page MUST default-export
import { PortfolioPage } from "@/screens/PortfolioPage";               // detail page (public/:id) default-export
import { MyPortfolioPage } from "@/screens/MyPortfolioPage";

import { useQuery } from "@tanstack/react-query";
import { me } from "@/hooks/useAuth";

function AutoHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: me,
    staleTime: 60_000,
  });
  if (isLoading) return null;              // avoid flicker
  return data ? <Navigate to="/public" replace /> : <HomePage />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <AutoHome /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },

      // Public list and detail
      { path: "public", element: <PublicPortfoliosPage /> },   // list
      { path: "public/:id", element: <PortfolioPage /> },      // detail

      // Legacy route support → redirect to new scheme
      { path: "portfolio/:id", element: <PortfolioPage /> },

      // Authenticated user's own portfolio
      { path: "my-portfolio", element: <MyPortfolioPage /> },

      // Fallback
      { path: "*", element: <Navigate to="/public" replace /> },
    ],
  },
]);
