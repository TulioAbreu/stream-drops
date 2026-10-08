import { InventoryPanel } from "@/components/shell/inventory-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyLocalDatabaseChanged } from "@/database/local-database-summary";
import { useExclusionListDb, type ExclusionListItem } from "@/database/ExclusionListItem";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import type { TwitchUser } from "@/service/twitch/types";
import { BanIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface ExclusionListForm {
  twitchUsername: string;
}

export function SettingsExclusionList() {
  const { t } = useTranslation();

  const { getExclusions, addExclusion, deleteExclusionByUsername } = useExclusionListDb();

  const [exclusions, setExclusions] = useState<ExclusionListItem[]>([]);
  const [isSearchingUser, startSearchUserTransition] = useTransition();
  const [isAddingUser, startAddUserTransition] = useTransition();
  const { getUserByLogin } = useTwitchApi();
  const [foundUsers, setFoundUsers] = useState<TwitchUser[] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const form = useForm<ExclusionListForm>({
    defaultValues: {
      twitchUsername: "",
    },
  });

  const handleClickSearchUser = (data: ExclusionListForm) => {
    startSearchUserTransition(async () => {
      const user = await getUserByLogin(data.twitchUsername);
      if (user.isErr()) {
        console.error("Erro ao buscar usuário:", user.error);
        setFoundUsers(null);
        return;
      }
      setFoundUsers(user.value.data);
    });
  };

  const handleAddUserToExclusionList = (user: TwitchUser) => {
    startAddUserTransition(async () => {
      const exclusionItem: ExclusionListItem = {
        twitchUserId: user.id,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        updatedAt: new Date().toISOString(),
        username: user.login,
      };

      const currentExclusions = await getExclusions();
      const isAlreadyExcluded = currentExclusions.some((exclusion) => exclusion.username === user.login);

      if (isAlreadyExcluded) {
        toast.error(t("SETTINGS_EXCLUSION_LIST_ALREADY_EXISTS", { username: user.login }));
        return;
      }

      await addExclusion(exclusionItem);
      await fetchExclusions();
      notifyLocalDatabaseChanged();

      toast.success(t("SETTINGS_EXCLUSION_LIST_ADD_SUCCESS", { username: user.login }));
      form.reset();
      setFoundUsers(null);
      setIsDialogOpen(false);
    });
  };

  const getExclusionsRef = useRef(getExclusions);
  getExclusionsRef.current = getExclusions;

  const fetchExclusions = useCallback(async () => {
    const exclusions = await getExclusionsRef.current();
    setExclusions(exclusions);
  }, []);

  const handleRemoveExclusion = async (exclusion: ExclusionListItem) => {
    try {
      await deleteExclusionByUsername(exclusion.username);
      await fetchExclusions();
      notifyLocalDatabaseChanged();
      toast.success(`Usuário ${exclusion.displayName} removido da lista de exclusão.`);
    } catch (error) {
      console.error("Erro ao remover usuário da lista de exclusão:", error);
      toast.error(`Erro ao remover usuário ${exclusion.displayName} da lista de exclusão.`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchExclusions().then(() => {
      if (!cancelled) notifyLocalDatabaseChanged();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchExclusions]);

  return (
    <InventoryPanel
      title={t("SETTINGS_EXCLUSION_LIST_TITLE")}
      meta={String(exclusions.length)}
      actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4" />
                {t("SETTINGS_EXCLUSION_LIST_ADD_BUTTON")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("SETTINGS_EXCLUSION_LIST_ADD_DIALOG_TITLE")}</DialogTitle>
                <DialogDescription>
                  {t("SETTINGS_EXCLUSION_LIST_ADD_DIALOG_DESCRIPTION")}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleClickSearchUser)} className="flex flex-row gap-4">
                  <FormField
                    control={form.control}
                    name="twitchUsername"
                    rules={{ required: t("SETTINGS_EXCLUSION_LIST_REQUIRED") }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder={t("SETTINGS_EXCLUSION_LIST_PLACEHOLDER")}
                        className="w-full max-w-md"
                      />
                    )}
                  />
                  <Button type="submit" disabled={isSearchingUser} loading={isSearchingUser} className="flex gap-2 min-w-[142px]">
                    <SearchIcon className="h-4 w-4" />
                    {t("SETTINGS_EXCLUSION_LIST_SEARCH_BUTTON")}
                  </Button>
                </form>
              </Form>
              {foundUsers && foundUsers.length > 0 && foundUsers.map((user) => (
                <Card>
                  <CardContent className="flex items-center gap-4 justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.profile_image_url} alt={user.display_name} />
                        <AvatarFallback>{user.display_name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold">{user.display_name}</p>
                      </div>
                    </div>
                    <Button type="submit" loading={isAddingUser} disabled={isAddingUser} variant="destructive" onClick={() => handleAddUserToExclusionList(user)} className="flex gap-2 min-w-[164px]">
                      <BanIcon className="h-4 w-4" />
                      {t("SETTINGS_EXCLUSION_LIST_ADD_BUTTON")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {foundUsers && foundUsers.length === 0 && (
                <Card>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t("SETTINGS_EXCLUSION_LIST_NO_USERS_FOUND")}
                    </p>
                  </CardContent>
                </Card>
              )}
            </DialogContent>
          </Dialog>
      }
      bodyClassName="px-0 pt-0"
    >
      <p className="px-4 pt-3 text-[13px] text-muted-foreground">
        {t("SETTINGS_EXCLUSION_LIST_DESCRIPTION")}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10.5px] tracking-[0.12em] uppercase">
              {t("SETTINGS_EXCLUSION_LIST_HEADER_NAME")}
            </TableHead>
            <TableHead className="text-right">
              <span className="sr-only">
                {t("SETTINGS_EXCLUSION_LIST_HEADER_ACTIONS")}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exclusions.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center">
                {t("SETTINGS_EXCLUSION_LIST_EMPTY")}
              </TableCell>
            </TableRow>
          )}
          {exclusions.map((exclusion) => (
            <TableRow key={exclusion.twitchUserId}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage src={exclusion.profileImageUrl} alt={exclusion.displayName} />
                    <AvatarFallback>{exclusion.displayName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{exclusion.displayName}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveExclusion(exclusion)}
                  aria-label={t("SETTINGS_EXCLUSION_LIST_REMOVE_TOOLTIP", {
                    username: exclusion.username,
                  })}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                  {t("SETTINGS_EXCLUSION_LIST_REMOVE")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InventoryPanel>
  );
}
