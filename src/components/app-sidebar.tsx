import {
    UserRoundCheck,
    Ticket
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
    {
        title: "DASHBOARD_SIDEBAR_ITEM_TICKET_GIVEAWAY",
        icon: <Ticket />,
        url: "/dashboard/",
    },
]

export function AppSidebar() {
    const { t } = useTranslation();

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
                                    <SidebarMenuButton asChild>
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
