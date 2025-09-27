import express from 'express';
import { db } from "@repo/db/client";
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/common-config/config';

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post("/register", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        const existingUser = await db.user.findFirst({
            where: { email }
        });

        if (existingUser) {
            res.status(200).json({ userId: existingUser.id });
            return;
        }

        const user = await db.user.create({
            data: { email }
        });

        res.status(201).json({ userId: user.id }); // 201 for created
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/ws-token", async (req, res) => {
    try {
        const { userId, userEmail } = req.body;

        if (!userId || !userEmail) {
            res.status(400).json({ error: "userId and userEmail are required" });
            return;
        }

        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        // Generate JWT token for WebSocket authentication
        const token = jwt.sign(
            {
                userId: user.id,
                userEmail: user.email
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error('Error generating WebSocket token:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/room", async (req, res) => {
    try {
        const { roomName, userId } = req.body;

        if (!userId) {
            res.status(400).json({ error: "userId is required" });
            return;
        }

        if (!roomName || roomName.trim().length === 0) {
            res.status(400).json({ error: "roomName is required" });
            return;
        }

        // Check if user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const room = await db.room.create({
            data: {
                name: roomName.trim(),
                userId
            }
        });

        res.status(201).json(room); // 201 for created
    } catch (error) {
        console.error('Room creation error:', error);

        // Handle unique constraint violation (room name already exists)

        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/room/:name", async (req, res) => {
    try {
        const { name } = req.params;

        if (!name || name.trim().length === 0) {
            res.status(400).json({ error: "Room name is required" });
            return;
        }

        const room = await db.room.findUnique({
            where: { name: name.trim() },
            include: {
                user: {
                    select: { id: true, email: true }
                }
            }
        });

        if (!room) {
            res.status(404).json({ error: "Room not found" });
            return;
        }

        res.status(200).json(room);
    } catch (error) {
        console.error('Room fetch error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/room/:roomId/messages", async (req, res) => {
    try {
        const { roomId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        if (!roomId) {
            res.status(400).json({ error: "roomId is required" });
            return;
        }

        // Verify room exists
        const room = await db.room.findUnique({
            where: { id: roomId }
        });

        if (!room) {
            res.status(404).json({ error: "Room not found" });
            return;
        }

        const messages = await db.chat.findMany({
            where: { roomId },
            take: Math.min(parseInt(limit as string), 100), // Limit max to 100
            skip: parseInt(offset as string),
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, email: true }
                }
            }
        });

        res.status(200).json(messages);
    } catch (error) {
        console.error('Messages fetch error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(3001, () => {
    console.log('Server is running on port 3001');
});