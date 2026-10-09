import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { ShellHeader } from "@/components/shell/shell-header";
import { Skeleton } from "@/components/ui/skeleton";
import { browserClock } from "@/components/giveaway/winner-badge-win";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import type { EngineClock } from "@/lib/winner-badges/types";
import { useSettingsStore } from "@/storage/settings";
import {
  DashboardBlocks,
  EmptyDashboard,
  FilterBar,
  Notices,
  SummaryCards,
} from "./blocks";
import { buildDashboardView } from "./model";
import {
  readDashboardPreferences,
  writeDashboardPreference,
  type DashboardPeriod,
  type DashboardPreferences,
  type DashboardType,
} from "./preferences";
import { readDashboardSource, type DashboardSource } from "./source";
import { useDashboardSource } from "./use-dashboard-source";

export type DashboardPageProps = {
  clock?: EngineClock;
  broadcasterId?: string | null;
  loadSource?: () => Promise<DashboardSource>;
};

export function DashboardPage({
  clock: clockProp,
  broadcasterId: broadcasterProp,
  loadSource = readDashboardSource,
}: DashboardPageProps) {
  const { t } = useTranslation();
  const { userData } = useTwitchApi();
  const badgesEnabled = useSettingsStore((state) => state.badges.enabled);
  const [liveClock] = useState(browserClock);
  const clock = clockProp ?? liveClock;
  const [filters, setFilters] = useState<DashboardPreferences>(readDashboardPreferences);
  const { status, source } = useDashboardSource(loadSource);
  const broadcasterId = broadcasterProp ?? userData?.id ?? null;

  const view = useMemo(() => {
    if (!source) return null;
    return buildDashboardView(source, clock, filters, {
      badgesEnabled,
      broadcasterId,
    });
  }, [source, clock, filters, badgesEnabled, broadcasterId]);

  function selectPeriod(period: DashboardPeriod) {
    if (filters.period === period) return;
    setFilters({ ...filters, period });
    writeDashboardPreference({ period });
  }

  function selectType(type: DashboardType) {
    if (filters.type === type) return;
    setFilters({ ...filters, type });
    writeDashboardPreference({ type });
  }

  function dismissLocal() {
    setFilters({ ...filters, dismissLocalHistory: true });
    writeDashboardPreference({ dismissLocalHistory: true });
  }

  function dismissChat() {
    setFilters({ ...filters, dismissChatLegacy: true });
    writeDashboardPreference({ dismissChatLegacy: true });
  }

  return (
    <Layout>
      <div data-dashboard-root data-dashboard-status={status}>
        <ShellHeader
          section={t("DASHBOARD_PAGE_CRUMB_SECTION")}
          page={t("DASHBOARD_PAGE_CRUMB_PAGE")}
          title={t("DASHBOARD_PAGE_TITLE")}
          description={t("DASHBOARD_PAGE_DESCRIPTION")}
        />
        <FilterBar
          period={filters.period}
          type={filters.type}
          onPeriod={selectPeriod}
          onType={selectType}
        />
        <Notices
          showLocal={!filters.dismissLocalHistory}
          showChat={!filters.dismissChatLegacy}
          onDismissLocal={dismissLocal}
          onDismissChat={dismissChat}
        />
        {status === "loading" ? (
          <DashboardSkeleton />
        ) : status === "error" || !view ? (
          <p className="text-sm text-muted-foreground">{t("DASHBOARD_LOAD_ERROR")}</p>
        ) : view.empty ? (
          <EmptyDashboard />
        ) : (
          <div className="flex flex-col gap-4">
            <SummaryCards view={view} />
            <DashboardBlocks
              view={view}
              clock={clock}
              period={filters.period}
              onSeeAll={() => selectPeriod("all")}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}
