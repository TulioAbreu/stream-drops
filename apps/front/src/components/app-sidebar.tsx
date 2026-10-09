import { BrowserChest } from "@/components/shell/browser-chest";
import { LogoutDialog } from "@/components/logout-dialog";
import { BrandLogo } from "@/components/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Coins,
  Disc3,
  LogOutIcon,
  MessageSquare,
  Settings,
  Star,
  Timer,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";

interface NavItem {
  title: string;
  icon: LucideIcon;
  url: string;
  badge?: "beta";
  match: "exact" | "prefix";
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const homeItem: NavItem = {
  title: "DASHBOARD_SIDEBAR_ITEM_HOME",
  icon: Star,
  url: "/dashboard",
  match: "exact",
};

const sections: NavSection[] = [
  {
    label: "DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS",
    items: [
      {
        title: "DASHBOARD_SIDEBAR_ITEM_FOLLOWER_GIVEAWAY",
        icon: UserRoundCheck,
        url: "/dashboard/follower-giveaway",
        match: "prefix",
      },
      {
        title: "DASHBOARD_SIDEBAR_ITEM_CHAT_GIVEAWAY",
        icon: MessageSquare,
        url: "/dashboard/chat-giveaway",
        match: "prefix",
      },
      {
        title: "DASHBOARD_SIDEBAR_ITEM_ROULETTE",
        icon: Disc3,
        url: "/dashboard/roulette",
        match: "prefix",
      },
      {
        title: "DASHBOARD_SIDEBAR_ITEM_CHANNEL_POINTS_GIVEAWAY",
        icon: Coins,
        url: "/dashboard/channel-points-giveaway",
        match: "prefix",
      },
    ],
  },
  {
    label: "DASHBOARD_SIDEBAR_SECTION_LIVE",
    items: [
      {
        title: "DASHBOARD_SIDEBAR_ITEM_SUBATHON",
        icon: Timer,
        url: "/dashboard/subathon",
        match: "prefix",
        badge: "beta",
      },
    ],
  },
  {
    label: "DASHBOARD_SIDEBAR_SECTION_ACCOUNT",
    items: [
      {
        title: "DASHBOARD_SIDEBAR_ITEM_SETTINGS",
        icon: Settings,
        url: "/dashboard/settings",
        match: "prefix",
      },
    ],
  },
];

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.url;
  return pathname === item.url || pathname.startsWith(`${item.url}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <Link
      to={item.url}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[42px] items-center gap-2.5 rounded-[10px] px-2 text-sm font-semibold text-foreground/80 hover:bg-sidebar-accent",
        active && "bg-primary/10 text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-border bg-[var(--sd-surface-3)]",
          active &&
            "border-primary text-[var(--sd-brand-amber-strong)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent),0_0_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="truncate">{t(item.title)}</span>
      {item.badge === "beta" ? (
        <span className="ml-auto rounded-[5px] border border-primary/40 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wide text-[var(--sd-brand-amber-strong)] uppercase">
          {t("SIDEBAR_BETA_BADGE")}
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { userData } = useTwitchApi();
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link to="/dashboard" className="px-2" aria-label={t("APP_NAME")}>
          <BrandLogo variant="horizontal" className="h-8 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <nav className="flex flex-col gap-0.5" aria-label={t("APP_NAME")}>
          <NavLink
            item={homeItem}
            active={isItemActive(location.pathname, homeItem)}
          />
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                {t(section.label)}
              </p>
              {section.items.map((item) => (
                <NavLink
                  key={item.url}
                  item={item}
                  active={isItemActive(location.pathname, item)}
                />
              ))}
            </div>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 pt-2 pb-3">
        <BrowserChest />
        <div className="flex items-center gap-2.5 px-1 pt-1">
          {userData ? (
            <>
              <Avatar className="size-8">
                <AvatarImage
                  src={userData.profileImageUrl}
                  alt={userData.displayName}
                />
                <AvatarFallback>
                  {userData.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">
                  {userData.displayName}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground">
                  {t("SIDEBAR_ACCOUNT_CONNECTED")}
                </div>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </>
          )}
          <LogoutDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8"
                aria-label={t("SIDEBAR_LOGOUT_BUTTON_TOOLTIP")}
              >
                <LogOutIcon className="size-4" />
              </Button>
            }
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
