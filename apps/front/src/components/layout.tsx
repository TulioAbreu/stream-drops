import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

const HUD_DOTS =
  "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 5%, transparent) 1px, transparent 0)";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "248px" } as React.CSSProperties}
    >
      <AppSidebar />
      <main
        className="flex min-h-svh flex-1 flex-col bg-background"
        style={{ backgroundImage: HUD_DOTS, backgroundSize: "22px 22px" }}
      >
        <div className="flex items-center px-3 py-2 md:hidden">
          <SidebarTrigger />
        </div>
        <div className="px-4 py-5 sm:px-7 sm:py-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
