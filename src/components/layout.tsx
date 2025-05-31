import { AppSidebar } from "./app-sidebar";
import { LayoutUserPopover } from "./layout-user-popover";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex flex-col h-screen flex-grow min-h-screen">
                <div className="flex flex-row justify-between p-4">
                    <SidebarTrigger />
                    <LayoutUserPopover />
                </div>
                <div className="px-[12px] py-[12px] sm:px-[100px] sm:py-[80px]">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}
