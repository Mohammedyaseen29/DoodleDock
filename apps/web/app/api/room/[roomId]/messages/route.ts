import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@repo/db/client'

export async function GET(
    req: NextRequest,
    { params }: { params: { roomId: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { roomId } = params
        const { searchParams } = new URL(req.url)
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100
        const offset = parseInt(searchParams.get('offset') || '0')

        if (!roomId) {
            return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
        }

        // Verify room exists
        const room = await db.room.findUnique({
            where: { id: roomId }
        })

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }

        const messages = await db.chat.findMany({
            where: { roomId },
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, email: true, name: true, image: true }
                }
            }
        })

        return NextResponse.json(messages)
    } catch (error) {
        console.error('Messages fetch error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}