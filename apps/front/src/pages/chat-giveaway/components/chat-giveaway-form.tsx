import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { type ChatGiveawayForm } from "../types";
import { Button } from "@/components/ui/button";

const FIELD_CONTAINER = "flex flex-col gap-2";

interface ChatGiveawayFormComponentProps {
  defaultValues?: Partial<ChatGiveawayForm>;
  onSubmit: (data: ChatGiveawayForm) => Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
}

export function ChatGiveawayFormComponent({
  defaultValues,
  onSubmit,
  submitLabel = "Salvar",
  isLoading = false
}: ChatGiveawayFormComponentProps) {
  const form = useForm<ChatGiveawayForm>({
    defaultValues: {
      title: "",
      description: "",
      keyword: "",
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 1,
      subscribersOnly: false,
      ...defaultValues,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className={FIELD_CONTAINER}>
        <Label>
          Título
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          placeholder="Título do sorteio"
          {...form.register("title", {
            required: "Título é obrigatório",
          })}
        />
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>Descrição</Label>
        <Textarea
          placeholder="Descrição do sorteio"
          className="resize-none"
          {...form.register("description")}
        />
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>Palavra-chave</Label>
        <Input
          placeholder="!sorteio"
          {...form.register("keyword")}
        />
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>Tempo mínimo de inscrição (meses)</Label>
        <Input
          type="number"
          placeholder="0"
          {...form.register("minimumSuscriptionTimeInMonths", {
            valueAsNumber: true,
            min: 0,
          })}
        />
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>Multiplicador de Sorte para Subscribers</Label>
        <Input
          type="number"
          placeholder="1"
          {...form.register("subscriberMultiplier", {
            valueAsNumber: true,
            min: 1,
          })}
        />
        <p className="text-sm text-muted-foreground">
          Subscribers terão este multiplicador aplicado às suas chances de ganhar (padrão: 1)
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="subscribersOnly"
          checked={form.watch("subscribersOnly")}
          onCheckedChange={(checked) => form.setValue("subscribersOnly", checked as boolean)}
        />
        <Label htmlFor="subscribersOnly" className="cursor-pointer">
          Apenas subscribers podem participar
        </Label>
      </div>

      <div className="flex flex-row items-center justify-end">
        <Button
          type="submit"
          onClick={form.handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
