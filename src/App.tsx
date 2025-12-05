import { BrowserRouter, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "./components/theme-provider"
import { LoginPage } from "./pages/login"
import { DashboardPage } from "./pages/dashboard"
import { FollowerGiveawayCreate } from "./pages/follower-giveaway/create"
import { LoginRedirectPage } from "./pages/login-redirect"
import { LoginRedirectDrivePage } from "./pages/login-redirect-drive"
import { FollowerGiveawayId } from "./pages/follower-giveaway/[id]"
import { FollowerGiveaway } from "./pages/follower-giveaway"
import { EditFollowerGiveawayPage } from "./pages/follower-giveaway/[id]/edit"
import { Toaster } from "./components/ui/sonner"
import { SettingsPage } from "./pages/settings"
import { ChatGiveawayCreate } from "./pages/chat-giveaway/create"
import { ChatGiveawayDetail } from "./pages/chat-giveaway/[id]"
import { ChatGiveaway } from "./pages/chat-giveaway"
import { ChatGiveawayEdit } from "./pages/chat-giveaway/[id]/edit"

// Criar uma instância do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/auth" element={<LoginRedirectPage />} />
            <Route path="/auth/drive" element={<LoginRedirectDrivePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/follower-giveaway" element={<FollowerGiveaway />} />
            <Route path="/dashboard/follower-giveaway/create" element={<FollowerGiveawayCreate />} />
            <Route path="/dashboard/follower-giveaway/:id/edit" element={<EditFollowerGiveawayPage />} />
            <Route path="/dashboard/follower-giveaway/:id" element={<FollowerGiveawayId />} />
            <Route path="/dashboard/chat-giveaway" element={<ChatGiveaway />} />
            <Route path="/dashboard/chat-giveaway/create" element={<ChatGiveawayCreate />} />
            <Route path="/dashboard/chat-giveaway/:id/edit" element={<ChatGiveawayEdit />} />
            <Route path="/dashboard/chat-giveaway/:id" element={<ChatGiveawayDetail />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
