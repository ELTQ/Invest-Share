import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { HomePage } from "@/screens/HomePage";
import { LoginPage } from "@/screens/LoginPage";
import { RegisterPage } from "@/screens/RegisterPage";
import { PublicPortfoliosPage } from "@/screens/PublicPortfoliosPage";
import { PortfolioPage } from "@/screens/PortfolioPage";
import { MyPortfolioPage } from "@/screens/MyPortfolioPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "public", element: <PublicPortfoliosPage /> },
      { path: "portfolio/:id", element: <PortfolioPage /> },
      { path: "my-portfolio", element: <MyPortfolioPage /> },
    ],
  },
]);
