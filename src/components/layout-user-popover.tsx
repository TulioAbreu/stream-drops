import { useTwitchApi } from "@/hooks/use-twitch-api";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";
import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DialogClose } from "@radix-ui/react-dialog";
import { Button } from "./ui/button";

export function LayoutUserPopover() {
    const { userData } = useTwitchApi();

    const onClickConfirmLogout = () => {

    };

    if (!userData) {
        return null;
    }

    return (
        <div>
            <Popover>
                <PopoverTrigger>
                    <Avatar>
                        <AvatarImage src={userData.profileImageUrl} alt={userData.displayName} />
                        <AvatarFallback>{userData.displayName.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                </PopoverTrigger>
                <PopoverContent>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-row items-center gap-3 p-2">
                            <Avatar>
                                <AvatarImage src={userData.profileImageUrl} alt={userData.displayName} />
                                <AvatarFallback>{userData.displayName.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <p>{userData.displayName}</p>
                        </div>
                        <Separator />
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className="flex flex-row gap-2 cursor-pointer p-2 hover:bg-gray-700 rounded-md items-center">
                                    <LogOutIcon className="w-4 h-4" />
                                    <p className="text-sm">Sair</p>
                                </div>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Você tem certeza?</DialogTitle>
                                    <DialogDescription>
                                        Sair irá desconectar sua conta e <b>todo seu histórico de sorteios será perdido</b>.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancelar</Button>
                                    </DialogClose>
                                    <Button variant="destructive" onClick={onClickConfirmLogout}>
                                        Apagar histórico e sair
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}