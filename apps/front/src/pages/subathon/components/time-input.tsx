import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useEffect, useId, useState } from "react";
import { hmsToMs, msToHms } from "../utils";

interface TimeInputProps {
  id?: string;
  valueMs: number;
  onChangeMs: (ms: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorMessage?: string;
}

export function TimeInput({
  id,
  valueMs,
  onChangeMs,
  disabled = false,
  invalid = false,
  errorMessage,
}: TimeInputProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const segments = msToHms(valueMs);
  const [hours, setHours] = useState(String(segments.hours));
  const [minutes, setMinutes] = useState(
    String(segments.minutes).padStart(2, "0"),
  );
  const [seconds, setSeconds] = useState(
    String(segments.seconds).padStart(2, "0"),
  );

  useEffect(() => {
    const next = msToHms(valueMs);
    setHours(String(next.hours));
    setMinutes(String(next.minutes).padStart(2, "0"));
    setSeconds(String(next.seconds).padStart(2, "0"));
  }, [valueMs]);

  const emitChange = (
    nextHours: string,
    nextMinutes: string,
    nextSeconds: string,
  ) => {
    const parsed = hmsToMs({
      hours: Number(nextHours),
      minutes: Number(nextMinutes),
      seconds: Number(nextSeconds),
    });

    if (parsed !== null) {
      onChangeMs(parsed);
    }
  };

  const normalizeSegment = (
    value: string,
    max: number,
    allowLargeHours = false,
  ) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return "0";
    }

    if (allowLargeHours) {
      return String(Math.floor(parsed));
    }

    return String(Math.min(max, Math.floor(parsed))).padStart(2, "0");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${inputId}-hours`} className="text-xs">
            {t("SUBATHON_TIME_HOURS")}
          </Label>
          <Input
            id={`${inputId}-hours`}
            type="number"
            min={0}
            value={hours}
            disabled={disabled}
            aria-invalid={invalid}
            className="w-20 font-mono tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setHours(next);
              emitChange(next, minutes, seconds);
            }}
            onBlur={() => {
              const normalized = normalizeSegment(
                hours,
                Number.MAX_SAFE_INTEGER,
                true,
              );
              setHours(normalized);
              emitChange(normalized, minutes, seconds);
            }}
          />
        </div>
        <span className="mt-5 font-mono text-lg">:</span>
        <div className="grid gap-1">
          <Label htmlFor={`${inputId}-minutes`} className="text-xs">
            {t("SUBATHON_TIME_MINUTES")}
          </Label>
          <Input
            id={`${inputId}-minutes`}
            type="number"
            min={0}
            max={59}
            value={minutes}
            disabled={disabled}
            aria-invalid={invalid}
            className="w-20 font-mono tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setMinutes(next);
              emitChange(hours, next, seconds);
            }}
            onBlur={() => {
              const normalized = normalizeSegment(minutes, 59);
              setMinutes(normalized);
              emitChange(hours, normalized, seconds);
            }}
          />
        </div>
        <span className="mt-5 font-mono text-lg">:</span>
        <div className="grid gap-1">
          <Label htmlFor={`${inputId}-seconds`} className="text-xs">
            {t("SUBATHON_TIME_SECONDS")}
          </Label>
          <Input
            id={`${inputId}-seconds`}
            type="number"
            min={0}
            max={59}
            value={seconds}
            disabled={disabled}
            aria-invalid={invalid}
            className="w-20 font-mono tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setSeconds(next);
              emitChange(hours, minutes, next);
            }}
            onBlur={() => {
              const normalized = normalizeSegment(seconds, 59);
              setSeconds(normalized);
              emitChange(hours, minutes, normalized);
            }}
          />
        </div>
      </div>
      {invalid && errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
