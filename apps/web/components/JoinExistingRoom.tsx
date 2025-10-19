"use client"

import React, { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useDialogStore } from '@/store/dialog-store';

export default function JoinExistingRoom() {
    const router = useRouter();
    const setOpenDialog = useDialogStore((state) => state.setOpenDialog);
    const [error, setError] = useState<string>('');

    const joinRoomSchema = z.object({
        room: z.string()
            .nonempty({ message: "Room name is required" })
            .min(3, "Room name must be at least 3 characters")
    })

    type JoinField = z.infer<typeof joinRoomSchema>;
    const { register, formState: { errors, isSubmitting }, reset, handleSubmit } = useForm<JoinField>({
        resolver: zodResolver(joinRoomSchema)
    });

    const onSubmit = async (data: JoinField) => {
        try {
            setError('');

            // Check if room exists
            const response = await fetch(`/api/room/name/${encodeURIComponent(data.room)}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Room not found. Please check the room name.');
                } else {
                    setError('Failed to join room. Please try again.');
                }
                return;
            }

            const room = await response.json();

            // Room exists, navigate to it
            reset();
            setOpenDialog(null);
            router.push(`/?room=${encodeURIComponent(data.room)}`);
        } catch (error) {
            console.error('Error joining room:', error);
            setError('An unexpected error occurred. Please try again.');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                    <Input 
                        placeholder='Enter the room name to connect..' 
                        {...register("room")}
                        disabled={isSubmitting}
                    />
                    <Button 
                        type="submit"
                        className='bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer'
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Joining...' : 'Join'}
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