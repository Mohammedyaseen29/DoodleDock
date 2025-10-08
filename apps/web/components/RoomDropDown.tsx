import React from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function RoomDropDown() {
    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <button className="bg-white/10 backdrop-blur-md text-black px-4 py-2 rounded-lg ring-1 ring-inset ring-white/20 shadow-lg transition duration-300 hover:bg-white/20">👀 What do you want to do?</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>⚙️ Choose an action</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>👾 Create a new room</DropdownMenuItem>
                    <DropdownMenuItem>📍 Join an existing room</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
