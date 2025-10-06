"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDialogStore } from "@/store/dialog-store"

export function SignInDialog() {
    const { openDialog, setOpenDialog } = useDialogStore()

    return (
        <Dialog
            open={openDialog === "signIn"}         
            onOpenChange={(open) => {               
                if (!open) setOpenDialog(null)        
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sign In</DialogTitle>
                </DialogHeader>
                <div className="mt-4 flex flex-col gap-3">
                    
                    <input
                        type="email"
                        placeholder="Email"
                        className="border p-2 rounded"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="border p-2 rounded"
                    />
                    <button
                        className="bg-blue-500 text-white p-2 rounded mt-2"
                        onClick={() => alert("Signing in...")}
                    >
                        Sign In
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
