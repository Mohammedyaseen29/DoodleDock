"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDialogStore } from "@/store/dialog-store"
import logo from "@/public/DoodleDock.png"
import Image from "next/image"
import google from "@/public/google-icon-logo-svgrepo-com.svg";
import { Button } from "../ui/button"
import { signIn } from "next-auth/react"

export function SignInDialog() {
    const { openDialog, setOpenDialog } = useDialogStore()

    return (
        <Dialog
            open={openDialog === "signIn"}         
            onOpenChange={(open) => {               
                if (!open) setOpenDialog(null)        
            }}
        >
            <DialogContent className="bg-white text-black pt-0 overflow-hidden">
                <DialogHeader>
                    <div className="flex justify-center">
                        <Image src={logo} alt="logo.png" className="w-48"/>
                    </div>
                    <DialogTitle className="text-center text-2xl -mt-10 font-semibold">Your blank canvas is waiting 🖌️</DialogTitle>
                    <DialogDescription className="text-center mt-0.5">Doodle, plan, or brainstorm - it all starts with one click.
                        Sign in to start creating magic!</DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <button className="bg-blue-600 text-white rounded-full w-full py-2 px-4 cursor-pointer" onClick={()=>signIn("google",{callbackUrl:"/"})}>
                        <div className="flex items-center justify-center gap-2.5">
                            <Image src={google} alt="google.svg" className="w-5 h-5"/>
                            <p className="font-semi-bold">Sign in with Google</p>
                        </div>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
