import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { db } from '@repo/db/client'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { roomName } = await req.json()

        if (!roomName?.trim()) {
            return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
        }

        // Check if user exists (should exist due to auth)
        const user = await db.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const room = await db.room.create({
            data: {
                name: roomName.trim(),
                userId: session.user.id
            }
        })

        return NextResponse.json(room, { status: 201 })
    } catch (error: any) {
        console.error('Room creation error:', error)

        // Handle unique constraint violation (room name already exists)
        if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
            return NextResponse.json({ error: 'Room name already exists' }, { status: 409 })
        }

        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}