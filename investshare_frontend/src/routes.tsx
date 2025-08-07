// src/routes.tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { HomePage } from "@/screens/HomePage";
import LoginPage from "@/screens/LoginPage";
import { RegisterPage } from "@/screens/RegisterPage";
import { PublicPortfoliosPage } from "@/screens/PublicPortfoliosPage";
import { PortfolioPage } from "@/screens/PortfolioPage";
import { MyPortfolioPage } from "@/screens/MyPortfolioPage";
// If you still want a guard for logged-out only, you can re-enable it:
// import { LoggedOutOnly } from "@/components/RouteGuards";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      // { path: "/", element: <LoggedOutOnly><HomePage /></LoggedOutOnly> }, // duplicate; remove
      { path: "public", element: <PublicPortfoliosPage /> },
      { path: "portfolio/:id", element: <PortfolioPage /> },
      { path: "my-portfolio", element: <MyPortfolioPage /> },
    ],
  },
]);
