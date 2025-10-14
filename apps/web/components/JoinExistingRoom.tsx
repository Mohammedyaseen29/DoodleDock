import React from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import z from 'zod';

export default function JoinExistingRoom() {
    const joinRoomSchema = z.object({
            room: z.string().nonempty({ message: "room name is required" })
        })
    
        type joinField = z.infer<typeof joinRoomSchema>;
        const {register,formState:{errors,isSubmitting},reset,handleSubmit} = useForm<joinField>({resolver:zodResolver(joinRoomSchema)});
    return (
            <form className=''>
                <div className='flex items-center'>
                    <Input placeholder='Enter the room name to connect..' {...register("room")}/>
                    {errors.room && <p className="text-rose-500 text-sm mt-1">{errors.room.message}</p>}
                    <Button className='bg-blue-500 text-white rounded ml-2 hover:bg-blue-600 cursor-pointer'>
                        Join
                    </Button>
                </div>
            </form >
    )
}
