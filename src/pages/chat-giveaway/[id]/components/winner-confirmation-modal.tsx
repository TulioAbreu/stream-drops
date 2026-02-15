import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, CheckIcon, XIcon, Clock, Star } from "lucide-react";
import confetti from "canvas-confetti";
import type { ChatParticipant, ChatMessage } from "../../types";
import { ChatContainer } from "./chat-container";
import { SubscriptionTierBadge } from "./subscription-tier-badge";

interface WinnerConfirmationModalProps {
  pendingWinner: ChatParticipant | null;
  messages: ChatMessage[];
  onConfirm: () => void;
  onCancel: () => void;
  onRedraw: () => void;
  isRedrawing: boolean;
}

export function WinnerConfirmationModal({
  pendingWinner,
  messages,
  onConfirm,
  onCancel,
  onRedraw,
  isRedrawing
}: WinnerConfirmationModalProps) {
  const [confirmationStartTime, setConfirmationStartTime] = useState<Date | null>(null);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Filter winner messages once - only messages after they were drawn
  const winnerMessages = useMemo(() => {
    if (!pendingWinner || !timerStartTimestamp) return [];

    return messages.filter(
      msg => msg.userId === pendingWinner.id &&
        new Date(msg.timestamp).getTime() > timerStartTimestamp
    );
  }, [messages, pendingWinner, timerStartTimestamp]);

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
      const now = new Date();
      setConfirmationStartTime(now);
      setTimerStartTimestamp(now.getTime());
      setElapsedSeconds(0);
      setIsPaused(false);

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
      setTimerStartTimestamp(null);
      setElapsedSeconds(0);
      setIsPaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWinner]); // Only depend on pendingWinner to avoid infinite loop

  // Check for new messages from winner after timer started
  useEffect(() => {
    if (!pendingWinner || !timerStartTimestamp || isPaused) return;

    if (winnerMessages.length > 0) {
      setIsPaused(true);
    }
  }, [winnerMessages, timerStartTimestamp, isPaused, pendingWinner]);

  // Timer effect
  useEffect(() => {
    if (!confirmationStartTime || isPaused) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - confirmationStartTime.getTime()) / 1000);
      setElapsedSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmationStartTime, isPaused]);

  const handleCancel = () => {
    setConfirmationStartTime(null);
    setTimerStartTimestamp(null);
    setElapsedSeconds(0);
    setIsPaused(false);
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
                <div className="flex items-center gap-2 mt-2">
                  <SubscriptionTierBadge tier={pendingWinner.tier} />
                  {pendingWinner.subscriptionMonths && (
                    <Badge variant="secondary" className="text-xs">
                      {pendingWinner.subscriptionMonths} {pendingWinner.subscriptionMonths === 1 ? 'mês' : 'meses'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className={`absolute top-2 right-2 flex items-center gap-1 text-xs font-mono ${isPaused ? 'text-orange-500' : 'text-muted-foreground'}`}>
                <Clock className="w-3 h-3" />
                {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>

            {/* Winner Messages */}
            <div className="border rounded-lg">
              <ChatContainer
                messages={winnerMessages}
                className="h-[300px] overflow-auto"
                emptyState={
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Nenhuma mensagem do vencedor ainda
                  </p>
                }
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onRedraw} disabled={isRedrawing}>
            {isRedrawing ? (
              <XIcon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XIcon className="w-4 h-4 mr-2" />
            )}
            {isRedrawing ? "Sorteando..." : "Refazer Sorteio"}
          </Button>
          <Button onClick={onConfirm} disabled={isRedrawing}>
            <CheckIcon className="w-4 h-4 mr-2" />
            Confirmar Vencedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
