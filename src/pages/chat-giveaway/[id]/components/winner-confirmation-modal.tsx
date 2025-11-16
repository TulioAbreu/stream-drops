import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, CheckIcon, XIcon, Clock, Star } from "lucide-react";
import confetti from "canvas-confetti";
import type { ChatParticipant, ChatMessage } from "../../types";

interface WinnerConfirmationModalProps {
    pendingWinner: ChatParticipant | null;
    messages: ChatMessage[];
    onConfirm: () => void;
    onCancel: () => void;
}

export function WinnerConfirmationModal({
    pendingWinner,
    messages,
    onConfirm,
    onCancel
}: WinnerConfirmationModalProps) {
    const [confirmationStartTime, setConfirmationStartTime] = useState<Date | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    // Format seconds to HH:MM:SS
    const formatElapsedTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // Start timer when modal opens with a pending winner
    useEffect(() => {
        if (pendingWinner && !confirmationStartTime) {
            setConfirmationStartTime(new Date());
            setElapsedSeconds(0);

            // Fire confetti with realistic look
            const count = 200;
            const defaults = {
                origin: { y: 0.7 }
            };

            function fire(particleRatio: number, opts: confetti.Options) {
                confetti({
                    ...defaults,
                    ...opts,
                    particleCount: Math.floor(count * particleRatio)
                });
            }

            fire(0.25, {
                spread: 26,
                startVelocity: 55,
            });
            fire(0.2, {
                spread: 60,
            });
            fire(0.35, {
                spread: 100,
                decay: 0.91,
                scalar: 0.8
            });
            fire(0.1, {
                spread: 120,
                startVelocity: 25,
                decay: 0.92,
                scalar: 1.2
            });
            fire(0.1, {
                spread: 120,
                startVelocity: 45,
            });

        } else if (!pendingWinner && confirmationStartTime) {
            setConfirmationStartTime(null);
            setElapsedSeconds(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingWinner]); // Only depend on pendingWinner to avoid infinite loop

    // Timer effect
    useEffect(() => {
        if (!confirmationStartTime) return;

        const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - confirmationStartTime.getTime()) / 1000);
            setElapsedSeconds(diff);
        }, 1000);

        return () => clearInterval(interval);
    }, [confirmationStartTime]);

    const handleCancel = () => {
        setConfirmationStartTime(null);
        setElapsedSeconds(0);
        onCancel();
    };

    return (
        <Dialog open={!!pendingWinner} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <Trophy className="w-6 h-6" />
                        Temos um vencedor!
                    </DialogTitle>
                </DialogHeader>

                {pendingWinner && (
                    <div className="space-y-4">
                        {/* Winner Info */}
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10 border relative">
                            <Avatar className="w-16 h-16">
                                <AvatarImage src={pendingWinner.avatar} />
                                <AvatarFallback>
                                    {pendingWinner.displayName[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="text-xl font-bold flex items-center gap-2">
                                    {pendingWinner.displayName}
                                    {pendingWinner.subscriber && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Subscriber</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </p>
                            </div>
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-xs font-mono text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatElapsedTime(elapsedSeconds)}
                            </div>
                        </div>

                        {/* Winner Messages */}
                        <div className="border rounded-lg">
                            <ScrollArea className="h-[300px]">
                                <div className="p-3 space-y-2">
                                    {messages
                                        .filter(msg => msg.userId === pendingWinner.id)
                                        .slice(-20) // Last 20 messages
                                        .map((msg, index) => (
                                            <div key={`${msg.id}-${index}`} className="flex gap-2 p-2 rounded bg-muted/50">
                                                <div className="flex-1">
                                                    <p className="text-sm">{msg.message}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    {messages.filter(msg => msg.userId === pendingWinner.id).length === 0 && (
                                        <p className="text-center text-muted-foreground text-sm py-8">
                                            Nenhuma mensagem do vencedor ainda
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        <XIcon className="w-4 h-4 mr-2" />
                        Cancelar Sorteio
                    </Button>
                    <Button onClick={onConfirm}>
                        <CheckIcon className="w-4 h-4 mr-2" />
                        Confirmar Vencedor
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
