import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db/client'

export async function GET(
    req: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        const roomName = params.name

        if (!roomName?.trim()) {
            return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
        }

        const room = await db.room.findUnique({
            where: { name: roomName.trim() },
            include: {
                user: {
                    select: { id: true, email: true, name: true, image: true }
                }
            }
        })

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }

        return NextResponse.json(room)
    } catch (error) {
        console.error('Room fetch error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}