export interface ChannelPointsGiveawayForm {
  title: string;
  description: string;
  cost: number;
  subscribersOnly: boolean;
  subscriptionRequirement: number;
  subscriberMultiplier: {
    "1000": number;
    "2000": number;
    "3000": number;
  };
  refundIneligible: boolean;
  allowMultipleWins: boolean;
}
