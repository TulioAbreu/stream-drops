import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useChatGiveawayDb, type ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { Layout } from "@/components/layout";
import { ChatGiveawayFormComponent } from "../../components/chat-giveaway-form";
import { type ChatGiveawayForm } from "../../types";

export function ChatGiveawayEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
  const [giveaway, setGiveaway] = useState<ChatGiveawayFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchGiveaway = async () => {
      try {
        const data = await getChatGiveaway(id);
        if (data) {
          setGiveaway(data);
        } else {
          // Handle not found
          navigate("/dashboard/chat-giveaway");
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

      await updateChatGiveaway(updatedGiveaway);
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
      <h1 className="text-2xl font-bold mb-6">Editar Chat Giveaway</h1>
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
    </Layout>
  );
}
