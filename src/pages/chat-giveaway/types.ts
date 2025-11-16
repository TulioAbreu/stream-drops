export interface ChatGiveawayForm {
    title: string;
    description: string;
    keyword: string;
    minimumSuscriptionTimeInMonths: number;
    subscriberMultiplier: number;
    subscribersOnly: boolean;
}

export interface ChatParticipant {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    subscriber: boolean;
    subscriptionMonths?: number;
    joinedAt: number; // timestamp in milliseconds
}

export interface ChatMessage {
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
