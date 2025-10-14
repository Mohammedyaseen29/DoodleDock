"use client"
import React from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from './ui/button'
import { ChevronDown } from 'lucide-react'



interface RoomDropDown{
    action:string;
    setAction: React.Dispatch<React.SetStateAction<string>>;
}

export default function RoomDropDown({action,setAction}:RoomDropDown) {
    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className='flex justify-center items-center'>
                        <Button variant={'outline'}>👀 What do you want to do? 
                        <ChevronDown className='w-5 h-5'/>
                        </Button>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>⚙️ Choose an action</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className='cursor-pointer' onClick={()=>setAction("createRoom")}>✏️ Create a new room</DropdownMenuItem>
                    <DropdownMenuItem className='cursor-pointer' onClick={() => setAction("joinRoom")}>📍 Join an existing room</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
