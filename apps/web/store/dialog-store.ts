import {create} from "zustand"



type dialogType = "signIn" | "createRoom" | "profile" | null;


interface DialogStore {
    openDialog : dialogType
    setOpenDialog : (dialog:dialogType | null)=>void
}

export const useDialogStore = create<DialogStore>((set)=>({
    openDialog: null,
    setOpenDialog: (dialog)=>set({openDialog:dialog})

}))