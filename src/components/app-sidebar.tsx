import {
  UserRoundCheck,
  Settings,
  LogOutIcon,
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
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent } from "./ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";

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
  const { userData } = useTwitchApi();
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="text-2xl font-bold flex flex-row gap-2">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 inline-block" />
          StreamDrops
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
      <SidebarFooter>
        <div className="p-4 flex space-between items-center">
          {userData ? (
            <div className="flex flex-row items-center w-full justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={userData.profileImageUrl} alt={userData.displayName} />
                  <AvatarFallback>{userData.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm">{userData.displayName}</div>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon">
                    <LogOutIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Logout
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Skeleton className="w-full h-10 rounded-md" />
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
