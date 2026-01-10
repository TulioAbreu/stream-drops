import { Badge } from "@/components/ui/badge";

interface SubscriptionTierBadgeProps {
  tier?: null | 1000 | 2000 | 3000;
}

export function SubscriptionTierBadge({ tier }: SubscriptionTierBadgeProps) {
  if (!tier) return null;

  const getTierStyle = () => {
    switch (tier) {
      case 3000:
        return "bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite] text-black border-0";
      case 2000:
        return "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite] text-black border-0";
      case 1000:
        return "bg-gradient-to-r from-orange-400 via-amber-600 to-orange-700 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite] text-white border-0";
      default:
        return "";
    }
  };

  return (
    <Badge
      variant="secondary"
      className={`text-xs font-semibold ${getTierStyle()}`}
    >
      Tier {tier / 1000}
    </Badge>
  );
}
