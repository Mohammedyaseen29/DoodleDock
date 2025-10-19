"use client"

import React, { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useDialogStore } from '@/store/dialog-store';

export default function CreateNewRoom() {
    const router = useRouter();
    const setOpenDialog = useDialogStore((state) => state.setOpenDialog);
    const [error, setError] = useState<string>('');

    const roomCreateSchema = z.object({
        room: z.string()
            .nonempty({ message: "Room name is required" })
            .min(3, "Room name must be at least 3 characters")
            .max(50, "Room name must be less than 50 characters")
            .regex(/^[a-zA-Z0-9-_]+$/, "Room name can only contain letters, numbers, hyphens and underscores")
    })

    type CreateField = z.infer<typeof roomCreateSchema>;
    const { register, formState: { errors, isSubmitting }, reset, handleSubmit } = useForm<CreateField>({
        resolver: zodResolver(roomCreateSchema)
    });

    const onSubmit = async (data: CreateField) => {
        try {
            setError('');
            
            const response = await fetch('/api/room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomName: data.room }),
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    setError('Room name already exists. Please choose a different name.');
                } else if (response.status === 401) {
                    setError('You must be signed in to create a room.');
                } else {
                    setError(result.error || 'Failed to create room');
                }
                return;
            }

            // Room created successfully
            reset();
            setOpenDialog(null);
            router.push(`/?room=${encodeURIComponent(data.room)}`);
        } catch (error) {
            console.error('Error creating room:', error);
            setError('An unexpected error occurred. Please try again.');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                    <Input 
                        placeholder='Create Room Name' 
                        {...register("room")}
                        disabled={isSubmitting}
                    />
                    <Button 
                        type="submit"
                        className='bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer'
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </div>
                {errors.room && (
                    <p className="text-rose-500 text-sm">{errors.room.message}</p>
                )}
                {error && (
                    <p className="text-rose-500 text-sm">{error}</p>
                )}
            </div>
        </form>
    )
}