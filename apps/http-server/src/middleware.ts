import { Request,Response,NextFunction } from "express";
import {JWT_SECRET} from "@repo/common-config/config";
import jwt from "jsonwebtoken";

export function auth(req:Request, res:Response, next:NextFunction) {
    try {
        const token = req.headers.authorization;
        if(!token){
            res.status(401).json({message:"Token not found"});
            return;
        }
        const decodeData = jwt.verify(token, JWT_SECRET) as {userId : string};
        req.userId  = decodeData.userId;
        next();

    } catch (error) {
        console.log(error);
        res.status(400).json({message:"Please sign in again"});
    }
}