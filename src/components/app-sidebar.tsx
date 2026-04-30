import {
  UserRoundCheck,
  Settings,
  LogOutIcon,
  MessageSquare,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLoginStore } from "@/storage/login";

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
    title: "DASHBOARD_SIDEBAR_ITEM_CHAT_GIVEAWAY",
    icon: <MessageSquare />,
    url: "/dashboard/chat-giveaway",
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
  const [deleteLocalData, setDeleteLocalData] = useState(false);
  const setTwitchAccessToken = useLoginStore((state) => state.setTwitchAccessToken);

  const handleLogout = () => {
    if (deleteLocalData) {
      localStorage.clear();
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          indexedDB.deleteDatabase(db.name!);
        });
      });
    } else {
      setTwitchAccessToken(null);
    }
    window.location.href = "/";
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="text-2xl font-bold flex flex-row gap-2">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 inline-block" />
          {t("APP_NAME")}
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
          <div className="flex flex-row items-center w-full justify-between">
            <div className="flex items-center gap-3">
              {userData ? (
                <>
                  <Avatar>
                    <AvatarImage src={userData.profileImageUrl} alt={userData.displayName} />
                    <AvatarFallback>{userData.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm">{userData.displayName}</div>
                  </div>
                </>
              ) : (
                <>
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="w-24 h-4 rounded-md" />
                </>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <LogOutIcon className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>{t("SIDEBAR_LOGOUT_DIALOG_TITLE")}</DialogTitle>
                    <DialogDescription>
                      {t("SIDEBAR_LOGOUT_DIALOG_DESCRIPTION")}
                    </DialogDescription>
                    <div className="flex items-center space-x-2 py-4">
                      <Checkbox
                        id="delete-data"
                        checked={deleteLocalData}
                        onCheckedChange={(checked) => setDeleteLocalData(checked as boolean)}
                      />
                      <Label
                        htmlFor="delete-data"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {t("SIDEBAR_LOGOUT_DELETE_DATA_LABEL")}
                      </Label>
                    </div>
                    <DialogFooter>
                      <Button variant="destructive" onClick={handleLogout}>
                        <LogOutIcon className="h-4 w-4" />
                        {t("SIDEBAR_LOGOUT_BUTTON")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t("SIDEBAR_LOGOUT_BUTTON_TOOLTIP")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
