import { BrowserRouter, Route, Routes } from "react-router"
import { ThemeProvider } from "./components/theme-provider"
import { LoginPage } from "./pages/login"
import { DashboardPage } from "./pages/dashboard"
import { FollowerGiveaway } from "./pages/follower-giveaway"
import { LoginRedirectPage } from "./pages/login-redirect"

export function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route path="/auth" element={<LoginRedirectPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/dashboard/follower-giveaway" element={<FollowerGiveaway />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    )
}
