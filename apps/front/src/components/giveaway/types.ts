export interface GiveawayChatMessage {
  id: string;
  userId: string;
  userName: string;
  displayName: string;
  avatar: string;
  message: string;
  timestamp: string;
  subscriber: boolean;
  subscriptionMonths: number | undefined;
}

export interface PendingWinnerInfo {
  id: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  tier?: null | 1000 | 2000 | 3000;
  subscriptionMonths?: number;
}
