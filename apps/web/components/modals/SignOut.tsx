"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDialogStore } from "@/store/dialog-store"
import logo from "@/public/DoodleDock.png"
import Image from "next/image"
import { signOut } from "next-auth/react"

export function SignOutDialog() {
    const { openDialog, setOpenDialog } = useDialogStore()

    return (
        <Dialog
            open={openDialog === "signOut"}         
            onOpenChange={(open) => {               
                if (!open) setOpenDialog(null)        
            }}
        >
            <DialogContent className="bg-white text-black pt-0 overflow-hidden">
                <DialogHeader>
                    <div className="flex justify-center">
                        <Image src={logo} alt="logo.png" className="w-48"/>
                    </div>
                    <DialogTitle className="text-center text-2xl -mt-10 font-semibold">Leaving the canvas? 🎨</DialogTitle>
                    <DialogDescription className="text-center mt-0.5">Your doodles are saved! You can jump back in whenever inspiration strikes.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex justify-between">
                    <button className="bg-blue-600 text-white rounded py-2 px-4 cursor-pointer">Cancel</button>
                    <button className="bg-rose-500 text-white rounded py-2 px-4 cursor-pointer" onClick={() => signOut()}>
                        Sign out
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
