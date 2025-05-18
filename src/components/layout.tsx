import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex flex-col h-screen flex-grow min-h-screen">
                <SidebarTrigger />
                <div className="px-[12px] py-[12px] sm:px-[100px] sm:py-[80px]">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}
