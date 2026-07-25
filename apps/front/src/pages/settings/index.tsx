import { Layout } from "@/components/layout"
import { PageHeader } from "@/components/page-header/page-header";
import { PageHeaderTitle } from "@/components/page-header/page-header-title";
import { useTranslation } from "@/i18n";
import { SettingsExclusionList } from "./exclusion-list";

export function SettingsPage() {
    const { t } = useTranslation();
    return (
        <Layout>
            <PageHeader>
                <PageHeaderTitle>
                    {t("SETTINGS_PAGE_TITLE")}
                </PageHeaderTitle>
            </PageHeader>
            <div className="flex flex-col">
                <SettingsExclusionList />
            </div>
        </Layout>
    );
}
