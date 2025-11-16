export interface ChatGiveawayForm {
    title: string;
    description: string;
    keyword: string;
    minimumSuscriptionTimeInMonths: number;
    subscriberMultiplier: number;
}

export interface ChatParticipant {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    subscriber: boolean;
    message: string;
    timestamp: string;
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
