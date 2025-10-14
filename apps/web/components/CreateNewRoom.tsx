import React from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import {z} from "zod";
import {zodResolver} from "@hookform/resolvers/zod"
import { useForm } from 'react-hook-form';

export default function CreateNewRoom() {

    const roomCreateSchema = z.object({
        room: z.string().nonempty({ message: "room name is required" }).min(3,"room name must be atleast 3 character")
    })

    type createField = z.infer<typeof roomCreateSchema>;
    const {register,formState:{errors,isSubmitting},reset,handleSubmit} = useForm<createField>({resolver:zodResolver(roomCreateSchema)});

    const onSubmit = ()=>{};

    return (
        <form>
            <div className='flex items-center'>
                <Input placeholder='Create Room Name' {...register("room")} />
                {errors.room && <p className="text-rose-500 text-sm mt-1">{errors.room.message}</p>}
                <Button className='bg-blue-500 text-white rounded ml-2 hover:bg-blue-600 cursor-pointer'>
                    Create
                </Button>
            </div>
        </form>
    )
}
