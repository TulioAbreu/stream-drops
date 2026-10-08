import { type ChatGiveawayForm } from "../types";
import { v7 } from "uuid";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { useNavigate } from "react-router";
import { ChatGiveawayFormComponent } from "../components/chat-giveaway-form";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";

export function ChatGiveawayCreate() {
  const { t } = useTranslation();
  const { addChatGiveaway } = useChatGiveawayDb();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const onClickSubmit = async (data: ChatGiveawayForm) => {
    try {
      setIsLoading(true);
      const id = v7();
      const now = new Date().toISOString();
      await addChatGiveaway({
        id,
        title: data.title,
        description: data.description,
        keyword: data.keyword,
        cost: 0,
        minimumSuscriptionTimeInMonths: data.minimumSuscriptionTimeInMonths,
        subscriberMultiplier: data.subscriberMultiplier,
        subscribersOnly: data.subscribersOnly,
        winners: [],
        participants: [],
        createdAt: now,
        updatedAt: now,
      });
      navigate(`/dashboard/chat-giveaway/${id}`);
    } catch (error) {
      console.error("Error adding chat giveaway:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <ShellHeader
        section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
        page={t("DASHBOARD_SIDEBAR_ITEM_CHAT_GIVEAWAY")}
        title={t("CHAT_GIVEAWAY_CREATE_TITLE")}
      />
      <InventoryPanel
        title={t("CHAT_GIVEAWAY_FORM_PANEL")}
        className="max-w-3xl"
      >
        <ChatGiveawayFormComponent
          onSubmit={onClickSubmit}
          submitLabel="Criar Sorteio"
          isLoading={isLoading}
        />
      </InventoryPanel>
    </Layout>
  );
}

