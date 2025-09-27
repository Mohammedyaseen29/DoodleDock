import { WebSocket, WebSocketServer } from "ws"
import { db } from "@repo/db/client"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from '@repo/common-config/config'
import { IncomingMessage } from 'http'
import { parse } from 'url'

interface CanvasRoom {
    clients: Array<{
        ws: WebSocket & { userId?: string; roomId?: string; userEmail?: string };
        userId: string;
        userEmail: string;
        cursor?: { x: number; y: number };
    }>;
    shapes: any[]; 
    lastUpdate: number;
}

const rooms: Record<string, CanvasRoom> = {};

const THROTTLE_INTERVAL = 33;
const pendingBroadcasts: Record<string, any> = {};

const wss = new WebSocketServer({
    port: 8080,
    verifyClient: async (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
        try {
            const url = parse(info.req.url || '', true);
            const token = url.query.token as string;

            if (!token) {
                console.log('WebSocket connection rejected: No token provided');
                return false;
            }

        
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; userEmail: string };

            
            const user = await db.user.findUnique({
                where: { id: decoded.userId }
            });

            if (!user) {
                console.log('WebSocket connection rejected: User not found');
                return false;
            }

            
            (info.req as any).userId = user.id;
            (info.req as any).userEmail = user.email;

            return true;
        } catch (error) {
            console.log('WebSocket connection rejected: Invalid token', error);
            return false;
        }
    }
});

wss.on('connection', (ws: WebSocket & { userId?: string; roomId?: string; userEmail?: string }, req: IncomingMessage) => {
    const userId = (req as any).userId;
    const userEmail = (req as any).userEmail;

    ws.userId = userId;
    ws.userEmail = userEmail;

    console.log(`Authenticated user connected: ${userEmail} (${userId})`);

    ws.on("message", async (message: any) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.type, 'from user:', ws.userEmail);

            if (data.type === "join") {
                const { roomName } = data;

                if (!roomName) {
                    ws.send(JSON.stringify({ type: "error", message: "Room name is required" }));
                    return;
                }

                const room = await db.room.findUnique({
                    where: { name: roomName },
                    include: {
                        user: {
                            select: { id: true, email: true }
                        }
                    }
                });

                if (room) {
                    if (!rooms[room.id]) {
                        rooms[room.id] = {
                            clients: [],
                            shapes: [],
                            lastUpdate: Date.now()
                        };
                    }

                    //@ts-ignore
                    const existingClient = rooms[room.id].clients.find(client => client.userId === ws.userId);
                    if (existingClient) {
                        // Close the old connection
                        existingClient.ws.close();
                        //@ts-ignore
                        rooms[room.id].clients = rooms[room.id].clients.filter(client => client.userId !== ws.userId);
                    }

                    //@ts-ignore
                    rooms[room.id].clients.push({
                        ws,
                        userId: ws.userId!,
                        userEmail: ws.userEmail!
                    });
                    ws.roomId = room.id;
                    ws.send(JSON.stringify({
                        type: "canvas-state",
                        //@ts-ignore
                        shapes: rooms[room.id].shapes,
                        roomId: room.id
                    }));
                    broadcastToRoom(room.id, {
                        type: "user-joined",
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        //@ts-ignore
                        userCount: rooms[room.id].clients.length
                    }, ws);

                    ws.send(JSON.stringify({
                        type: "joined",
                        roomId: room.id,
                        //@ts-ignore
                        userCount: rooms[room.id].clients.length,
                        roomName: room.name,
                        roomOwner: room.user.email
                    }));

                    console.log(`User ${ws.userEmail} joined room ${room.name}`);
                }
                else {
                    ws.send(JSON.stringify({ type: "error", message: "Room not found" }))
                }
            }

            if (data.type === "message") {
                const { message } = data;

                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
                    return;
                }

                try {
                    const savedMessage = await db.chat.create({
                        data: {
                            message,
                            userId: ws.userId!,
                            roomId: ws.roomId
                        },
                        include: {
                            user: {
                                select: { id: true, email: true }
                            }
                        }
                    });

                    const broadCastMessage = {
                        type: "message",
                        message: savedMessage.message,
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        createdAt: savedMessage.createdAt,
                        user: savedMessage.user
                    };

                    broadcastToRoom(ws.roomId, broadCastMessage);
                } catch (error) {
                    console.error('Error saving message:', error);
                    ws.send(JSON.stringify({ type: "error", message: "Failed to save message" }));
                }
            }
            if (data.type === "canvas-draw") {
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
                    return;
                }

                const { shape, isComplete } = data;

                if (rooms[ws.roomId]) {
                    if (isComplete) {
                        //@ts-ignore
                        rooms[ws.roomId].shapes.push(shape);
                    }

                    throttledBroadcast(ws.roomId, {
                        type: "canvas-draw",
                        shape: shape,
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        isComplete: isComplete,
                        timestamp: Date.now()
                    }, ws);
                }
            }
            if (data.type === "canvas-clear") {
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
                    return;
                }

                if (rooms[ws.roomId]) {
                    //@ts-ignore
                    rooms[ws.roomId].shapes = [];
                    broadcastToRoom(ws.roomId, {
                        type: "canvas-clear",
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        timestamp: Date.now()
                    }, ws);
                }
            }
            if (data.type === "canvas-delete") {
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
                    return;
                }

                const { shapeIndices } = data;
                if (rooms[ws.roomId]) {
                    //@ts-ignore
                    rooms[ws.roomId].shapes = rooms[ws.roomId].shapes.filter(
                        (_, index) => !shapeIndices.includes(index)
                    );

                    broadcastToRoom(ws.roomId, {
                        type: "canvas-delete",
                        shapeIndices: shapeIndices,
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        timestamp: Date.now()
                    }, ws);
                }
            }

            //@ts-ignore
            if (data.type === "cursor-move") {
                if (!ws.roomId) return; 

                const { x, y } = data;
                if (rooms[ws.roomId]) {
                    //@ts-ignore
                    const client = rooms[ws.roomId].clients.find(c => c.ws === ws);
                    if (client) {
                        client.cursor = { x, y };
                    }
                    throttledBroadcast(ws.roomId, {
                        type: "cursor-move",
                        x, y,
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        timestamp: Date.now()
                    }, ws, 16);
                }
            }

            
            if (data.type === "canvas-undo" || data.type === "canvas-redo") {
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
                    return;
                }

                const { shapes } = data;
                if (rooms[ws.roomId]) {
                    //@ts-ignore
                    rooms[ws.roomId].shapes = shapes;
                    broadcastToRoom(ws.roomId, {
                        type: data.type,
                        shapes: shapes,
                        userId: ws.userId,
                        userEmail: ws.userEmail,
                        timestamp: Date.now()
                    }, ws);
                }
            }

        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
    })

    ws.on("close", () => {
        if (ws.roomId && rooms[ws.roomId]) {
            //@ts-ignore
            rooms[ws.roomId].clients = rooms[ws.roomId].clients.filter(client => client.ws !== ws);

            
            broadcastToRoom(ws.roomId, {
                type: "user-left",
                userId: ws.userId,
                userEmail: ws.userEmail,
                //@ts-ignore
                userCount: rooms[ws.roomId].clients.length
            });

            console.log(`User ${ws.userEmail} left room ${ws.roomId}`);

            //@ts-ignore
            if (rooms[ws.roomId].clients.length === 0) {
                delete rooms[ws.roomId];
                console.log(`Room ${ws.roomId} deleted - no clients remaining`);
            }
        }
    })

    ws.on("error", (error) => {
        console.error('WebSocket error for user', ws.userEmail, ':', error);
    });

    
    ws.send(JSON.stringify({
        type: "authenticated",
        userId: ws.userId,
        userEmail: ws.userEmail
    }));
});


function broadcastToRoom(roomId: string, message: any, sender?: WebSocket) {
    if (!rooms[roomId]) return;

    const messageStr = JSON.stringify(message);
    rooms[roomId].clients.forEach(client => {
        if (client.ws !== sender && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(messageStr);
            } catch (error) {
                console.error('Error broadcasting message:', error);
            }
        }
    });
}

function throttledBroadcast(roomId: string, message: any, sender?: WebSocket, interval: number = THROTTLE_INTERVAL) {
    const key = `${roomId}-${message.type}`;

    if (pendingBroadcasts[key]) {
        pendingBroadcasts[key] = message;
        return;
    }

    pendingBroadcasts[key] = message;

    setTimeout(() => {
        const latestMessage = pendingBroadcasts[key];
        delete pendingBroadcasts[key];

        if (latestMessage) {
            broadcastToRoom(roomId, latestMessage, sender);
        }
    }, interval);
}

