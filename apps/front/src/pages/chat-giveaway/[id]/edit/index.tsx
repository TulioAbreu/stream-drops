import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useChatGiveawayDb, type ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { ChatGiveawayFormComponent } from "../../components/chat-giveaway-form";
import { type ChatGiveawayForm } from "../../types";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { redirectIfGiveawayDeleted } from "@/pages/giveaway-deleted";
import { useRedirectWhenMissing } from "@/pages/use-redirect-when-missing";

export function ChatGiveawayEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
  const [giveaway, setGiveaway] = useState<ChatGiveawayFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  useRedirectWhenMissing(missing, "/dashboard/chat-giveaway");

  useEffect(() => {
    if (!id) return;

    const fetchGiveaway = async () => {
      try {
        const data = await getChatGiveaway(id);
        if (data) {
          setGiveaway(data);
        } else {
          setMissing(true);
        }
      } catch (error) {
        console.error("Error fetching giveaway:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGiveaway();
  }, [id, getChatGiveaway, navigate]);

  const onClickSubmit = async (data: ChatGiveawayForm) => {
    if (!giveaway) return;

    try {
      setIsSaving(true);
      const updatedGiveaway: ChatGiveawayFormData = {
        ...giveaway,
        title: data.title,
        description: data.description,
        keyword: data.keyword,
        minimumSuscriptionTimeInMonths: data.minimumSuscriptionTimeInMonths,
        subscriberMultiplier: data.subscriberMultiplier,
        subscribersOnly: data.subscribersOnly,
        updatedAt: new Date().toISOString(),
      };

      const saved = await updateChatGiveaway(updatedGiveaway);
      if (redirectIfGiveawayDeleted(saved, navigate, "/dashboard/chat-giveaway")) {
        return;
      }
      navigate(`/dashboard/chat-giveaway/${giveaway.id}`);
    } catch (error) {
      console.error("Error updating giveaway:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div>Carregando...</div>
      </Layout>
    );
  }

  if (!giveaway) {
    return null;
  }

  return (
    <Layout>
      <ShellHeader
        section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
        page={t("DASHBOARD_SIDEBAR_ITEM_CHAT_GIVEAWAY")}
        title={t("CHAT_GIVEAWAY_EDIT_TITLE")}
      />
      <InventoryPanel
        title={t("CHAT_GIVEAWAY_FORM_PANEL")}
        className="max-w-3xl"
      >
      <ChatGiveawayFormComponent
        defaultValues={{
          title: giveaway.title,
          description: giveaway.description,
          keyword: giveaway.keyword,
          minimumSuscriptionTimeInMonths: giveaway.minimumSuscriptionTimeInMonths,
          subscriberMultiplier: giveaway.subscriberMultiplier,
          subscribersOnly: giveaway.subscribersOnly,
        }}
        onSubmit={onClickSubmit}
        submitLabel="Salvar Alterações"
        isLoading={isSaving}
      />
      </InventoryPanel>
    </Layout>
  );
}
