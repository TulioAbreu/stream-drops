import { Layout } from "@/components/layout";
import { ShellHeader } from "@/components/shell/shell-header";
import { useTranslation } from "@/i18n";
import { AccountPanel } from "./account-panel";
import { AppearancePanel } from "./appearance-panel";
import { SettingsExclusionList } from "./exclusion-list";
import { LocalDataPanel } from "./local-data-panel";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <Layout>
      <ShellHeader
        section={t("SETTINGS_PAGE_CRUMB_SECTION")}
        page={t("SETTINGS_PAGE_CRUMB_PAGE")}
        title={t("SETTINGS_PAGE_TITLE")}
        description={t("SETTINGS_PAGE_DESCRIPTION")}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,440px)]">
        <div className="flex flex-col gap-4">
          <SettingsExclusionList />
          <AppearancePanel />
        </div>
        <div className="flex flex-col gap-4">
          <LocalDataPanel />
          <AccountPanel />
        </div>
      </div>
    </Layout>
  );
}
