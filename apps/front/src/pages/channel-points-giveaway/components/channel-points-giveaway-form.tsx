import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { type ChannelPointsGiveawayForm } from "../types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriberTier, SubscriberTierLabels } from "@/domain/SubscriberTier";
import { useTranslation } from "@/i18n";
import { DEFAULT_CHANNEL_POINTS_MULTIPLIER } from "@/service/channel-points-giveaway";

const FIELD_CONTAINER = "flex flex-col gap-2";

interface ChannelPointsGiveawayFormComponentProps {
  defaultValues?: Partial<ChannelPointsGiveawayForm>;
  onSubmit: (data: ChannelPointsGiveawayForm) => Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChannelPointsGiveawayFormComponent({
  defaultValues,
  onSubmit,
  submitLabel,
  isLoading = false,
  disabled = false,
}: ChannelPointsGiveawayFormComponentProps) {
  const { t } = useTranslation();
  const form = useForm<ChannelPointsGiveawayForm>({
    defaultValues: {
      title: "",
      description: "",
      cost: 100,
      subscribersOnly: false,
      subscriptionRequirement: SubscriberTier.TIER_1,
      subscriberMultiplier: { ...DEFAULT_CHANNEL_POINTS_MULTIPLIER },
      refundIneligible: true,
      allowMultipleWins: false,
      ...defaultValues,
      subscriberMultiplier: {
        ...DEFAULT_CHANNEL_POINTS_MULTIPLIER,
        ...defaultValues?.subscriberMultiplier,
      },
    },
  });

  const subscribersOnly = form.watch("subscribersOnly");
  const subscriptionRequirement = form.watch("subscriptionRequirement");

  return (
    <div className="flex flex-col gap-4">
      <div className={FIELD_CONTAINER}>
        <Label>
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_TITLE")}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          placeholder={t("CHANNEL_POINTS_GIVEAWAY_FORM_TITLE_PLACEHOLDER")}
          maxLength={45}
          {...form.register("title", {
            required: true,
            maxLength: 45,
          })}
        />
        <p className="text-sm text-muted-foreground">
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_TITLE_HINT")}
        </p>
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>{t("CHANNEL_POINTS_GIVEAWAY_FORM_DESCRIPTION")}</Label>
        <Textarea
          placeholder={t("CHANNEL_POINTS_GIVEAWAY_FORM_DESCRIPTION_PLACEHOLDER")}
          className="resize-none"
          maxLength={200}
          {...form.register("description")}
        />
      </div>

      <div className={FIELD_CONTAINER}>
        <Label>
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_COST")}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          type="number"
          min={1}
          {...form.register("cost", {
            required: true,
            valueAsNumber: true,
            min: 1,
          })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="subscribersOnly"
          checked={subscribersOnly}
          onCheckedChange={(checked) =>
            form.setValue("subscribersOnly", checked as boolean)
          }
        />
        <Label htmlFor="subscribersOnly" className="cursor-pointer">
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBSCRIBERS_ONLY")}
        </Label>
      </div>

      {subscribersOnly && (
        <div className={FIELD_CONTAINER}>
          <Label>{t("CHANNEL_POINTS_GIVEAWAY_FORM_MIN_TIER")}</Label>
          <Select
            value={String(form.watch("subscriptionRequirement"))}
            onValueChange={(value) =>
              form.setValue("subscriptionRequirement", Number(value))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(SubscriberTier).map((tierValue) => (
                <SelectItem key={tierValue} value={String(tierValue)}>
                  {SubscriberTierLabels[tierValue]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {t("CHANNEL_POINTS_GIVEAWAY_FORM_MIN_TIER_HINT")}
          </p>
        </div>
      )}

      <div className={FIELD_CONTAINER}>
        <Label>{t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBSCRIBER_LUCK")}</Label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBSCRIBER_LUCK_TIER")}
              </TableHead>
              <TableHead>
                {t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBSCRIBER_LUCK_VALUE")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(SubscriberTier)
              .filter(
                (tier) =>
                  !subscribersOnly || tier >= subscriptionRequirement
              )
              .map((tierValue) => (
                <TableRow key={tierValue}>
                  <TableCell>{SubscriberTierLabels[tierValue]}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-[100px]"
                      {...form.register(
                        `subscriberMultiplier.${tierValue}` as const,
                        {
                          valueAsNumber: true,
                          min: 1,
                        }
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBSCRIBER_LUCK_HINT")}
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="refundIneligible"
          checked={form.watch("refundIneligible")}
          onCheckedChange={(checked) =>
            form.setValue("refundIneligible", checked as boolean)
          }
        />
        <Label htmlFor="refundIneligible" className="cursor-pointer">
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_REFUND_INELIGIBLE")}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        {t("CHANNEL_POINTS_GIVEAWAY_FORM_REFUND_INELIGIBLE_HINT")}
      </p>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="allowMultipleWins"
          checked={form.watch("allowMultipleWins")}
          onCheckedChange={(checked) =>
            form.setValue("allowMultipleWins", checked as boolean)
          }
        />
        <Label htmlFor="allowMultipleWins" className="cursor-pointer">
          {t("CHANNEL_POINTS_GIVEAWAY_FORM_ALLOW_MULTIPLE_WINS")}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        {t("CHANNEL_POINTS_GIVEAWAY_FORM_ALLOW_MULTIPLE_WINS_HINT")}
      </p>

      <div className="flex flex-row items-center justify-end">
        <Button
          type="submit"
          onClick={form.handleSubmit(onSubmit)}
          disabled={isLoading || disabled}
        >
          {isLoading
            ? t("CHANNEL_POINTS_GIVEAWAY_FORM_SAVING")
            : (submitLabel ?? t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBMIT"))}
        </Button>
      </div>
    </div>
  );
}
