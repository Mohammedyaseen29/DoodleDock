"use client"


import axios from "axios";
import { useEffect, useState } from "react"

export default function Chat() {
    const [roomId,setRoomId] = useState("");
    const [message,setMessage] = useState("");
    const [messages,setMessages] = useState<any>([]);
    const [userId,setuserId] = useState("");
    const [roomName,setroomName] = useState("");
    const [email,setEmail] = useState("");
    const [ws,setws] = useState<null | WebSocket>();

    useEffect(()=>{
        const socket = new WebSocket("http://localhost:8080");
        setws(socket);
        socket.onopen = ()=>console.log("connected to the ws");
        socket.onmessage = (event)=>{
            const data = JSON.parse(event.data);
            if(data.type === "message"){
                setMessages((prev:any)=>[...prev,data])
            }
            else if(data.type === "joined"){
                setRoomId(data.roomId);
                fetchMessages(data.roomId);
            }
            else if(data.type === "error"){
                alert(data.message)
            }
        }
        
        socket.onclose = ()=>console.log("socket is disconnected")

        return ()=> socket.close();
    },[])
    const fetchMessages = async(roomId:string)=>{
        const response = await axios.get(`http://localhost:3001/room/${roomId}/messages`)
        setMessages(response.data)
    }
    const registerUser = async ()=>{
        const response = await axios.post('http://localhost:3001/register',{email})
        setuserId(response.data.userId)
    }
    
    const createRoom = async ()=>{
        const response = await axios.post('http://localhost:3001/room',{roomName,userId});
        const room = response.data;
        console.log(room);
        if(room.id){
            alert(`Room ${room.name} created`)
        }
        else{
            alert('room creation failed')
        }

    }
    const joinRoom = ()=>{
        if(ws && userId && roomName){
            ws.send(JSON.stringify({type:"join",roomName,userId}))
        }
    }
    const sendMessage = ()=>{
        if(ws && message){
            ws.send(JSON.stringify({type:"message",message}));
            setMessage('')
        }
    }
    
    
    return (
        <div style={{padding:'20px'}}>
            {!userId ? (
                <div>
                    <h2>Register</h2>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email"
                    />
                    <button onClick={registerUser}>Register</button>
                </div>
            ) : !roomId ? (
                <div>
                    <h2>Chat Room</h2>
                    <input
                        value={roomName}
                        onChange={(e) => setroomName(e.target.value)}
                        placeholder="Enter Room Name"
                    />
                    <button onClick={createRoom}>Create Room</button>
                    <button onClick={joinRoom}>Join Room</button>
                </div>
            ) : (
                <div>
                    <h2>Room: {roomName}</h2>
                    <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                        {messages.map((msg:any, index:any) => (
                            <p key={index} style={{color:"white"}}>
                                User:{msg.user.email} {msg.message}{' '}
                                <small>({new Date(msg.createdAt).toLocaleTimeString()})</small>
                            </p>
                        ))}
                    </div>
                    <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message"
                    />
                    <button onClick={sendMessage}>Send</button>
                </div>
            )}
        </div>
    )
}
