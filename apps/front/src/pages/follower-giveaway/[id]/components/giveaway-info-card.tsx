import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface GiveawayInfoCardProps {
    title: string;
    icon: React.ElementType;
    className?: string;
    children: ReactNode;
}

export function GiveawayInfoCard({
    title,
    icon,
    children,
    className = "",
}: GiveawayInfoCardProps) {
    const Icon = icon;
    return (
        <Card className={className}>
            <CardHeader className="relative flex flex-col h-full items-center justify-center text-center">
                <CardTitle className="text-3xl font-semibold tabular-nums">
                    <div className="flex flex-row gap-2 items-center justify-center">
                        <Icon className="w-6 h-6" />
                        {children}
                    </div>
                </CardTitle>
                <CardDescription>{title}</CardDescription>
            </CardHeader>
        </Card>
    );
}
