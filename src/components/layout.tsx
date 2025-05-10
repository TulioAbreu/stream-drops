import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex flex-col h-screen flex-grow min-h-screen">
                <SidebarTrigger />
                {children}
            </main>
        </SidebarProvider>
    )
}
