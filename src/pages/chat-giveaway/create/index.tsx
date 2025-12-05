import { type ChatGiveawayForm } from "../types";
import { v7 } from "uuid";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { useNavigate } from "react-router";
import { ChatGiveawayFormComponent } from "../components/chat-giveaway-form";
import { useState } from "react";

export function ChatGiveawayCreate() {
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
      <h1 className="text-2xl font-bold mb-6">Criar Chat Giveaway</h1>
      <ChatGiveawayFormComponent
        onSubmit={onClickSubmit}
        submitLabel="Criar Sorteio"
        isLoading={isLoading}
      />
    </Layout>
  );
}

