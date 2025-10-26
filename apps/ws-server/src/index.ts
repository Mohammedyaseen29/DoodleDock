import { WebSocket, WebSocketServer } from "ws";
import { db } from "@repo/db/client";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/common-config/config";
import { IncomingMessage } from "http";
import {   URL } from "url";
import { createServer } from "http";


interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  roomId?: string;
  userEmail?: string;
  userName?: string;
  isAlive?: boolean;
}

interface CanvasRoom {
  clients: Array<{
    ws: ExtendedWebSocket;
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

// Create default public room
async function ensureDefaultRoom() {
  try {
    const defaultRoom = await db.room.findUnique({
      where: { name: "public-canvas" },
    });

    if (!defaultRoom) {
      // Find or create a system user for the default room
      let systemUser = await db.user.findFirst({
        where: { email: "system@doodledock.com" },
      });

      if (!systemUser) {
        systemUser = await db.user.create({
          data: {
            email: "system@doodledock.com",
            name: "System",
          },
        });
      }

      await db.room.create({
        data: {
          name: "public-canvas",
          userId: systemUser.id,
        },
      });

      console.log("Default public-canvas room created");
    }
  } catch (error) {
    console.error("Error ensuring default room:", error);
  }
}
const server = createServer();
const wss = new WebSocketServer({noServer:true});

server.on("upgrade", async (req, socket, head) => { 
  const token = new URL(req.url!,"http://localhost").searchParams.get("token");
  if (!token) { 
    socket.destroy();
    return;
  }
  try {
    const decoded = jwt.verify(token,JWT_SECRET) as { userId: string; userEmail: string };;
    const user = await db.user.findUnique({ where: { id: decoded.userId } });
    if (!user) { 
      socket.destroy;
      return;
    }
   
    (req as any).userId = user.id;
    (req as any).userEmail = user.email;
    
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    })
    
    
  } catch(error) {
    console.error("Error verifying token:", error);
    socket.destroy();
  }
})

// Heartbeat to detect broken connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtendedWebSocket;

    if (extWs.isAlive === false) {
      console.log(
        `💔 Terminating inactive connection for user: ${extWs.userEmail}`,
      );
      return extWs.terminate();
    }

    extWs.isAlive = false;
    extWs.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeatInterval);
});

wss.on("connection", (ws: ExtendedWebSocket, req: IncomingMessage) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).userEmail;


  ws.userId = userId;
  ws.userEmail = userEmail;
  ws.isAlive = true;
  console.log(`checking email : ${userEmail}`)
  console.log(`✅ Authenticated user connected: ${userEmail} (${userId})`);

  // Handle pong responses
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", async (message: any) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Message received: ${data.type} from ${ws.userEmail}`);

      if (data.type === "join") {
        const { roomName } = data;

        if (!roomName) {
          ws.send(  
            JSON.stringify({ type: "error", message: "Room name is required" }),
          );
          return;
        }

        // Find or create room
        let room = await db.room.findUnique({
          where: { name: roomName },
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        });

        // If room doesn't exist, create it
        if (!room) {
          try {
            room = await db.room.create({
              data: {
                name: roomName,
                userId: ws.userId!,
              },
              include: {
                user: {
                  select: { id: true, email: true, name: true },
                },
              },
            });
            console.log(`🆕 Room created: ${roomName} by ${ws.userEmail}`);
          } catch (error: any) {
            if (error?.code === "P2002") {
              // Room was created by another process, fetch it
              room = await db.room.findUnique({
                where: { name: roomName },
                include: {
                  user: {
                    select: { id: true, email: true, name: true },
                  },
                },
              });
            } else {
              throw error;
            }
          }
        }

        if (room) {
          // Remove user from previous room if exists
          if (ws.roomId && rooms[ws.roomId]) {
            //@ts-ignore
            rooms[ws.roomId].clients = rooms[ws.roomId].clients.filter(
              (client) => client.ws !== ws,
            );

            broadcastToRoom(ws.roomId, {
              type: "user-left",
              userId: ws.userId,
              userEmail: ws.userEmail,
              //@ts-ignore
              userCount: rooms[ws.roomId].clients.length,
            });
            //@ts-ignore
            if (rooms[ws.roomId].clients.length === 0) {
              delete rooms[ws.roomId];
            }
          }

          // Initialize room in memory if doesn't exist
          if (!rooms[room.id]) {
            rooms[room.id] = {
              clients: [],
              shapes: [],
              lastUpdate: Date.now(),
            };
          }

          // Remove existing connection for this user in the room
          //@ts-ignore
          const existingClient = rooms[room.id].clients.find(
            (client) => client.userId === ws.userId,
          );

          if (existingClient) {
            console.log(`♻️ Replacing existing connection for ${ws.userEmail}`);
            existingClient.ws.close();
            //@ts-ignore
            rooms[room.id].clients = rooms[room.id].clients.filter(
              (client) => client.userId !== ws.userId,
            );
          }

          // Add client to room
          //@ts-ignore
          rooms[room.id].clients.push({
            ws,
            userId: ws.userId!,
            userEmail: ws.userEmail!,
          });

          ws.roomId = room.id;

          // Send current canvas state to new user
          ws.send(
            JSON.stringify({
              type: "canvas-state",
              //@ts-ignore
              shapes: rooms[room.id].shapes,
              roomId: room.id,
            }),
          );

          // Notify others in the room
          broadcastToRoom(
            room.id,
            {
              type: "user-joined",
              userId: ws.userId,
              userEmail: ws.userEmail,
              //@ts-ignore
              userCount: rooms[room.id].clients.length,
            },
            ws,
          );

          // Confirm join to the user
          ws.send(
            JSON.stringify({
              type: "joined",
              roomId: room.id,
              //@ts-ignore
              userCount: rooms[room.id].clients.length,
              roomName: room.name,
              roomOwner: room.user.email || room.user.name,
            }),
          );
          
          console.log(
            //@ts-ignore
            `👥 User ${ws.userEmail} joined room ${room.name} (${rooms[room.id].clients.length} users)`,
          );
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
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
              roomId: ws.roomId,
            },
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          });

          const broadCastMessage = {
            type: "message",
            message: savedMessage.message,
            userId: ws.userId,
            userEmail: ws.userEmail,
            createdAt: savedMessage.createdAt,
            user: savedMessage.user,
          };

          broadcastToRoom(ws.roomId, broadCastMessage);
        } catch (error) {
          console.error("❌ Error saving message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to save message",
            }),
          );
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

          throttledBroadcast(
            ws.roomId,
            {
              type: "canvas-draw",
              shape: shape,
              userId: ws.userId,
              userEmail: ws.userEmail,
              isComplete: isComplete,
              timestamp: Date.now(),
            },
            ws,
          );
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
          broadcastToRoom(
            ws.roomId,
            {
              type: "canvas-clear",
              userId: ws.userId,
              userEmail: ws.userEmail,
              timestamp: Date.now(),
            },
            ws,
          );
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
            (_, index) => !shapeIndices.includes(index),
          );

          broadcastToRoom(
            ws.roomId,
            {
              type: "canvas-delete",
              shapeIndices: shapeIndices,
              userId: ws.userId,
              userEmail: ws.userEmail,
              timestamp: Date.now(),
            },
            ws,
          );
        }
      }

      if (data.type === "cursor-move") {
        if (!ws.roomId) return;

        const { x, y } = data;
        if (rooms[ws.roomId]) {
          //@ts-ignore
          const client = rooms[ws.roomId].clients.find((c) => c.ws === ws);
          if (client) {
            client.cursor = { x, y };
          }

          throttledBroadcast(
            ws.roomId,
            {
              type: "cursor-move",
              x,
              y,
              userId: ws.userId,
              userEmail: ws.userEmail,
              userName: ws.userEmail?.split("@")[0],
              timestamp: Date.now(),
            },
            ws,
            16,
          );
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
          broadcastToRoom(
            ws.roomId,
            {
              type: data.type,
              shapes: shapes,
              userId: ws.userId,
              userEmail: ws.userEmail,
              timestamp: Date.now(),
            },
            ws,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error processing message:", error);
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" }),
      );
    }
  });

  ws.on("close", () => {
    console.log(`👋 User disconnected: ${ws.userEmail}`);

    if (ws.roomId && rooms[ws.roomId]) {
      //@ts-ignore
      rooms[ws.roomId].clients = rooms[ws.roomId].clients.filter(
        (client) => client.ws !== ws,
      );

      broadcastToRoom(ws.roomId, {
        type: "user-left",
        userId: ws.userId,
        userEmail: ws.userEmail,
        //@ts-ignore
        userCount: rooms[ws.roomId].clients.length,
      });
    
      console.log(
        //@ts-ignore
        `📊 Room ${ws.roomId} now has ${rooms[ws.roomId].clients.length} users`,
      );
      //@ts-ignore
      if (rooms[ws.roomId].clients.length === 0) {
        delete rooms[ws.roomId];
        console.log(`🗑️ Room ${ws.roomId} deleted - no clients remaining`);
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`❌ WebSocket error for user ${ws.userEmail}:`, error);
  });

  // Send authentication confirmation
  ws.send(
    JSON.stringify({
      type: "authenticated",
      userId: ws.userId,
      userEmail: ws.userEmail,
    }),
  );
});

function broadcastToRoom(roomId: string, message: any, sender?: WebSocket) {
  if (!rooms[roomId]) return;

  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  rooms[roomId].clients.forEach((client) => {
    if (client.ws !== sender && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error("❌ Error broadcasting message:", error);
      }
    }
  });

  if (sentCount > 0) {
    console.log(
      `📤 Broadcast ${message.type} to ${sentCount} clients in room ${roomId}`,
    );
  }
}

function throttledBroadcast(
  roomId: string,
  message: any,
  sender?: WebSocket,
  interval: number = THROTTLE_INTERVAL,
) {
  const key = `${roomId}-${message.type}-${sender ? (sender as ExtendedWebSocket).userId : "all"}`;

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

// Initialize server
server.listen(8080);
console.log("🚀 WebSocket server starting on ws://localhost:8080");

ensureDefaultRoom()
  .then(() => {
    console.log("✅ WebSocket server ready");
  })
  .catch((error) => {
    console.error("❌ Error initializing server:", error);
  });

