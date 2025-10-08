"use client"

import { MenuItem,MenuContainer } from "@/components/Fluid-menu"
import { Menu as MenuIcon, X, Home,Settings, Zap, LogIn, LogOut } from "lucide-react"
import { useDialogStore } from "@/store/dialog-store";
import { useSession } from "next-auth/react";




// A fluid circular menu that elegantly expands to reveal navigation items with smooth icon transitions
export function DoodleMenu() {

    const {data} = useSession();
    const setOpenDialog = useDialogStore((state) => state.setOpenDialog);
    return (
        <div className="flex flex-col items-center gap-8 p-8">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/10 to-transparent dark:from-gray-100/10 blur-3xl -z-10 rounded-full" />
                <MenuContainer>
                    <MenuItem
                        icon={
                            <div className="relative w-6 h-6">
                                <div className="absolute inset-0 transition-all duration-300 ease-in-out origin-center opacity-100 scale-100 rotate-0 [div[data-expanded=true]_&]:opacity-0 [div[data-expanded=true]_&]:scale-0 [div[data-expanded=true]_&]:rotate-180">
                                    <MenuIcon size={24} strokeWidth={1.5} />
                                </div>
                                <div className="absolute inset-0 transition-all duration-300 ease-in-out origin-center opacity-0 scale-0 -rotate-180 [div[data-expanded=true]_&]:opacity-100 [div[data-expanded=true]_&]:scale-100 [div[data-expanded=true]_&]:rotate-0">
                                    <X size={24} strokeWidth={1.5} />
                                </div>
                            </div>
                        }
                    />
                    <MenuItem icon={<Home size={24} strokeWidth={1.5} />} />
                    <MenuItem icon={<Zap size={24} strokeWidth={1.5} onClick={()=>setOpenDialog("createRoom")}/>} />
                    {data ? <MenuItem icon={<LogOut size={24} strokeWidth={1.5} onClick={()=>setOpenDialog("signOut")} />} /> : <MenuItem icon={<LogIn size={24} strokeWidth={1.5} onClick={() => setOpenDialog("signIn")} />} />}
                    <MenuItem icon={<Settings size={24} strokeWidth={1.5} />} />
                </MenuContainer>
            </div>
        </div>
    )
}  