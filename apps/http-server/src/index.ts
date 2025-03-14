import express from 'express';
import {db} from "@repo/db/client";
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/common-config/config';
import { auth } from './middleware';

const app = express();
app.use(express.json());
app.use(cors());

app.post("/register", async (req, res) => {
    try {
        const { email } = req.body;
        // const hashedPassword = await bcrypt.hash(password, 10);
        const existingUser = await db.user.findFirst({
            where:{
                email
            }
        })
        if(existingUser){
            res.status(200).json({ userId: existingUser.id });
            return;
        }
    
        const user = await db.user.create({
            data: {
                email,
            }
        })
        res.status(200).json({userId:user.id});
    } catch (error) {
        console.log(error);
        res.status(400).send("User already exists");
    }
})
// app.post("/login", async (req, res) => {
//     try {
//         const {email,password} = req.body;
//         const user = await db.user.findUnique({
//             where: {
//                 email
//             }
//         });
//         if(!user){
//             res.status(400).send("User not found");
//             return;
//         }
//         const correctPassword = await bcrypt.compare(password, user.password);
//         if(!correctPassword){
//             res.status(400).send("Invalid password");
//             return;
//         }
//         const token = jwt.sign({userId:user.id},JWT_SECRET);
//         res.status(200).json({token});
//     } catch (error) {
//         console.log(error);
//         res.status(500).send("Internal Server Error");
//     }
// });

// app.use(auth)


app.post("/room", async (req, res) => {
    try {
        const {roomName,userId} = req.body;
        if(userId === undefined){
            res.status(400).send("Invalid user");
            return;
        }
        const room = await db.room.create({
            data: {
                name:roomName,
                userId
            }
        })
        res.status(200).json(room);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error"); 
    }
});

app.get("/room/:name", async (req, res) => {
    try {
        const {name} = req.params;
        const room = await db.room.findUnique({
            where:{
                name
            }
        });
        if(!room){
            res.status(400).send("Room not found");
            return;
        }
        res.status(200).json(room);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error"); 
    }
});

app.get("/room/:roomId/messages", async (req, res) => {
    try {
        const {roomId} = req.params;
        const messages = await db.chat.findMany({
            where:{
                roomId
            },
            take: 10,
            orderBy:{
                createdAt:"desc"
            },
            include:{
                user:true
            }
        })
        res.status(200).json(messages);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
})




app.listen(3001, () => {
    console.log('Server is running on port 3001');
});