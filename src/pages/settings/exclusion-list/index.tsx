import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useExclusionListDb, type ExclusionListItem } from "@/database/ExclusionListItem";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import type { TwitchUser } from "@/service/twitch/types";
import { BanIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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

            toast.success(t("SETTINGS_EXCLUSION_LIST_ADD_SUCCESS", { username: user.login }));
            form.reset();
            setFoundUsers(null);
            setIsDialogOpen(false);
        });
    };

    const fetchExclusions = async () => {
        const exclusions = await getExclusions();
        setExclusions(exclusions);
    };

    const handleRemoveExclusion = async (exclusion: ExclusionListItem) => {
        await deleteExclusionByUsername(exclusion.username);
        await fetchExclusions();
    };

    useEffect(() => {
        fetchExclusions();
    }, [getExclusions, fetchExclusions]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold">
                        {t("SETTINGS_EXCLUSION_LIST_TITLE")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t("SETTINGS_EXCLUSION_LIST_DESCRIPTION")}
                    </p>
                </div>
            </div>
            <div className="flex flex-row justify-end">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
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
                                            <p className="font-bold">{user.login}</p>
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
            </div>
            <Table className="w-full mt-4">
                <TableHeader>
                    <TableRow>
                        <TableHead>{t("SETTINGS_EXCLUSION_LIST_HEADER_NAME")}</TableHead>
                        <TableHead>{t("SETTINGS_EXCLUSION_LIST_HEADER_ACTIONS")}</TableHead>
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
                                    <Avatar>
                                        <AvatarImage src={exclusion.profileImageUrl} alt={exclusion.displayName} />
                                        <AvatarFallback>{exclusion.displayName.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span>{exclusion.username}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveExclusion(exclusion)}>
                                                <Trash2Icon className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t("SETTINGS_EXCLUSION_LIST_REMOVE_TOOLTIP", { username: exclusion.username })}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
