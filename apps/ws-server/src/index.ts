import {WebSocket,WebSocketServer} from "ws"
import {db} from "@repo/db/client"


const rooms:any = {};

const wss = new WebSocketServer({port:8080});

wss.on('connection',(ws:any)=>{
    ws.on("message",async(message:any)=>{
        const data = JSON.parse(message);
        if(data.type === "join"){
            const {userId,roomName} = data;
            const room = await db.room.findUnique({
                where:{
                    name:roomName
                }
            })
            if(room){
                if(!rooms[room.id]){
                    rooms[room.id] = [];
                }
                rooms[room.id].push({ws,userId});
                ws.userId = userId;
                ws.roomId = room.id;
                ws.send(JSON.stringify({type:"joined",roomId:room.id}));
            }
            else{
                ws.send(JSON.stringify({type:"error",message:"Room not found"}))
            }
        }
        if(data.type === "message"){
            const {message} = data;
            try {
                const savedMessage = await db.chat.create({
                    data:{
                        message,
                        userId:ws.userId,
                        roomId:ws.roomId
                    }
                })
                const broadCastMessage = {
                    type:"message",
                    message:savedMessage.message,
                    userId:ws.userId,
                    createdAt:savedMessage.createdAt
                }
                rooms[ws.roomId].forEach((client:any)=>{
                    if(client.ws.readyState === WebSocket.OPEN){
                        client.ws.send(JSON.stringify(broadCastMessage))
                    }
                })
            } catch (error) {
                console.log(error)
            }
        }
    })
    ws.on("close",()=>{
        if(ws.roomId && rooms[ws.roomId]){
            rooms[ws.roomId] = rooms[ws.roomId].filter((client:any)=> client.ws != ws);
            console.log(`User ${ws.userId} left room ${ws.roomId}`);
        }
    })
    
})