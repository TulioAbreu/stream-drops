import { BrandLogo } from "@/components/brand-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import {
  isTwitchStubMode,
  openTwitchLoginPopup,
  STUB_ACCESS_TOKEN,
} from "@/lib/twitch-oauth";
import { useLoginStore } from "@/storage/login";
import { CheckIcon, HardDrive, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const STAGE_BEAM =
  "conic-gradient(from 180deg at 50% 110%, transparent 160deg, color-mix(in srgb, var(--sd-rarity-legendary) 28%, transparent) 172deg, color-mix(in srgb, var(--sd-rarity-legendary) 55%, transparent) 180deg, color-mix(in srgb, var(--sd-rarity-legendary) 28%, transparent) 188deg, transparent 200deg)";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTwitchAccessToken, twitchAccessToken, setSessionExpired } =
    useLoginStore();
  const { userData } = useTwitchApi();
  const [isLoadingTwitch, setIsLoadingTwitch] = useState<boolean>(false);
  const stubMode = isTwitchStubMode();

  const handleLoginTwitch = async () => {
    setIsLoadingTwitch(true);
    if (stubMode) {
      setSessionExpired(false);
      setTwitchAccessToken(null);
      setTimeout(() => {
        setTwitchAccessToken(STUB_ACCESS_TOKEN);
      }, 0);
      return;
    }
    openTwitchLoginPopup();
  };

  useEffect(() => {
    if (userData) {
      setIsLoadingTwitch(false);
    }
  }, [userData]);

  useEffect(() => {
    if (!twitchAccessToken) {
      return;
    }
    setTimeout(() => {
      navigate("/dashboard");
    }, 1000);
    }, [navigate, twitchAccessToken]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "twitch-auth" && event.data.accessToken) {
        setTwitchAccessToken(event.data.accessToken);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setTwitchAccessToken]);

  const stageLines = t("LOGIN_STAGE_TITLE").split("\n");

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="relative flex min-h-[520px] flex-col justify-between overflow-hidden bg-card px-8 py-12 sm:px-14 lg:min-h-svh lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: STAGE_BEAM }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 58%)",
          }}
        />
        <BrandLogo variant="horizontal" className="relative h-9 w-auto" />
        <div className="relative max-w-[620px]">
          <h1 className="font-display text-5xl leading-none font-extrabold tracking-tight sm:text-6xl lg:text-[76px]">
            {stageLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-[520px] text-base text-muted-foreground sm:text-[19px]">
            {t("LOGIN_STAGE_SUBTITLE")}
          </p>
        </div>
        <img
          src="/brand/bauzinho-acenando.svg"
          alt=""
          className="relative mx-auto h-36 w-auto sm:h-44"
        />
      </section>

      <section className="flex flex-col justify-center bg-background px-6 py-14 sm:px-12 lg:px-24">
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
          <p className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
            {t("LOGIN_EYEBROW")}
          </p>
          <h2 className="font-display text-[34px] leading-[1.1] font-extrabold">
            {t("LOGIN_HEADING")}
          </h2>

          {userData ? (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <Avatar>
                <AvatarImage
                  src={userData.profileImageUrl}
                  alt={userData.displayName}
                />
                <AvatarFallback>
                  {userData.displayName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p>Twitch</p>
                <p className="font-bold">{userData.login}</p>
              </div>
            </div>
          ) : isLoadingTwitch ? (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <Skeleton className="size-10 rounded-full" />
              <div>
                <p>Twitch</p>
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
          ) : (
            <Button
              className="h-[60px] w-full rounded-2xl text-lg"
              onClick={handleLoginTwitch}
            >
              <Link2 className="size-5" />
              {stubMode
                ? t("LOGIN_BUTTON_TWITCH_STUB")
                : t("LOGIN_BUTTON_TWITCH")}
            </Button>
          )}

          {twitchAccessToken ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <CheckIcon className="size-5 text-[var(--sd-success)]" />
              <p>{t("LOGIN_FINISHING")}</p>
            </div>
          ) : null}

          <div className="mt-2 flex gap-3 rounded-[var(--sd-radius-lg)] border border-[color-mix(in_srgb,var(--sd-local)_25%,transparent)] bg-[var(--sd-local-soft)] p-3.5 text-sm">
            <HardDrive className="mt-0.5 size-5 shrink-0 text-[var(--sd-local)]" />
            <div>
              <p className="font-semibold">{t("LOGIN_LOCAL_TITLE")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("LOGIN_LOCAL_DESCRIPTION")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
