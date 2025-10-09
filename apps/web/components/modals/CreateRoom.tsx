"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDialogStore } from "@/store/dialog-store"
import logo from "@/public/DoodleDock.png"
import Image from "next/image"
import RoomDropDown from "../RoomDropDown"
import { useState } from "react"

export function CreateRoom() {
    const { openDialog, setOpenDialog } = useDialogStore();
    const [createRoom,setCreateRoom] = useState("");


    return (
        <Dialog
            open={openDialog === "createRoom"}         
            onOpenChange={(open) => {               
                if (!open) setOpenDialog(null)        
            }}
        >
            <DialogContent className="bg-white text-black pt-0 overflow-hidden">
                <DialogHeader>
                    <div className="flex justify-center">
                        <Image src={logo} alt="logo.png" className="w-48"/>
                    </div>
                    <DialogTitle className="text-center text-2xl -mt-10 font-semibold">Jump into a room 🚀</DialogTitle>
                    <DialogDescription className="text-center mt-0.5">Start fresh with a new room or join your friends where the doodles are already happening!</DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <RoomDropDown/>
                </div>
            </DialogContent>
        </Dialog>
    )
}
