import {
    UserRoundCheck,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useTranslation } from "@/i18n";
import { useLocation } from "react-router";

interface NavbarItem {
    title: string;
    icon: React.ReactNode;
    url: string;
}

const items: NavbarItem[] = [
    {
        title: "DASHBOARD_SIDEBAR_ITEM_FOLLOWER_GIVEAWAY",
        icon: <UserRoundCheck />,
        url: "/dashboard/follower-giveaway",
    },
    // {
    //     title: "DASHBOARD_SIDEBAR_ITEM_TICKET_GIVEAWAY",
    //     icon: <Ticket />,
    //     url: "/dashboard/",
    // },
]

export function AppSidebar() {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <Sidebar>
            <SidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarHeader className="text-2xl font-bold">
                        📦 StreamDrops
                    </SidebarHeader>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild className={location.pathname === item.url ? "bg-neutral-800" : ""}>
                                        <a href={item.url}>
                                            {item.icon}
                                            <span>{t(item.title)}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter />
        </Sidebar >
    )
}
