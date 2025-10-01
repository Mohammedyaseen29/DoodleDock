import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '@repo/common-config/config'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Generate JWT token for WebSocket authentication
        const token = jwt.sign(
            {
                userId: session.user.id,
                userEmail: session.user.email
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        )

        return NextResponse.json({ token })
    } catch (error) {
        console.error('Error generating WebSocket token:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}