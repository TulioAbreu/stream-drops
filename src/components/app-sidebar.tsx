import {
    UserRoundCheck,
    Settings,
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
import { useLocation, Link } from "react-router";

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
    {
        title: "DASHBOARD_SIDEBAR_ITEM_SETTINGS",
        icon: <Settings />,
        url: "/dashboard/settings",
    }
]

export function AppSidebar() {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <Sidebar>
            <SidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarHeader className="text-2xl font-bold flex flex-row">
                        <img src="/icon.png" alt="Logo" className="w-8 h-8 mr-2 inline-block" />
                        StreamDrops
                    </SidebarHeader>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild className={location.pathname === item.url ? "bg-neutral-800" : ""}>
                                        <Link to={item.url}>
                                            {item.icon}
                                            <span>{t(item.title)}</span>
                                        </Link>
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
