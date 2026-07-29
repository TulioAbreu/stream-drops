import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { TimeInput } from "../components/time-input";
import { useSubathon } from "../hooks/use-subathon";
import { DEFAULT_CONVERSION_RULES, hmsToMs, msToHms } from "../utils";

const DEFAULT_INITIAL_MS = 3_600_000;

export function SubathonCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    connected,
    createSession,
    lastCreatedSessionId,
    clearLastCreatedSessionId,
    errorNonce,
  } = useSubathon();
  const [sessionName, setSessionName] = useState(
    () => t("SUBATHON_DEFAULT_SESSION_NAME"),
  );
  const [initialMs, setInitialMs] = useState(DEFAULT_INITIAL_MS);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitting || !lastCreatedSessionId) {
      return;
    }

    const createdId = lastCreatedSessionId;
    clearLastCreatedSessionId();
    setSubmitting(false);
    navigate(`/dashboard/subathon/${createdId}`, { replace: true });
  }, [
    submitting,
    lastCreatedSessionId,
    clearLastCreatedSessionId,
    navigate,
  ]);

  useEffect(() => {
    if (errorNonce === 0 || !submitting) {
      return;
    }

    setSubmitting(false);
  }, [errorNonce, submitting]);

  useEffect(() => {
    if (!submitting) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSubmitting(false);
      toast.error(t("SUBATHON_CREATE_TIMEOUT"));
    }, 10_000);

    return () => window.clearTimeout(timeout);
  }, [submitting, t]);

  const handleCreate = () => {
    const trimmedName = sessionName.trim();
    const timeValid = hmsToMs(msToHms(initialMs)) !== null;

    if (!trimmedName) {
      setNameError(t("SUBATHON_CREATE_NAME_REQUIRED"));
      return;
    }

    setNameError(null);

    if (!timeValid) {
      setTimeError(t("SUBATHON_TIME_INVALID"));
      return;
    }

    setTimeError(null);

    if (!connected) {
      toast.error(t("SUBATHON_ERROR_DISCONNECTED"));
      return;
    }

    setSubmitting(true);
    const sent = createSession(
      trimmedName,
      initialMs,
      DEFAULT_CONVERSION_RULES,
      true,
    );

    if (!sent) {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("SUBATHON_CREATE_TITLE")}
        </h1>
        <p className="text-muted-foreground">
          {t("SUBATHON_CREATE_DESCRIPTION")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("SUBATHON_CREATE_SESSION")}</CardTitle>
          <CardDescription>{t("SUBATHON_CREATE_HINT")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="session-name">{t("SUBATHON_SESSION_NAME")}</Label>
            <Input
              id="session-name"
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              disabled={!connected || submitting}
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? (
              <p className="text-sm text-destructive">{nameError}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>{t("SUBATHON_INITIAL_TIME")}</Label>
            <TimeInput
              valueMs={initialMs}
              onChangeMs={setInitialMs}
              disabled={!connected || submitting}
              invalid={Boolean(timeError)}
              errorMessage={timeError ?? undefined}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/subathon")}
            >
              {t("SUBATHON_CANCEL")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!connected || submitting}
            >
              {t("SUBATHON_CREATE_SESSION")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
