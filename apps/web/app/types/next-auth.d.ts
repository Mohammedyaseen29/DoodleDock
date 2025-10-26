import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            name?: string | null
            email?: string | null
            image?: string | null
        }
        error?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        userId?: string
        accessToken?: string
        refreshToken?: string
        accessTokenExpires?: number
        error?: string
    }
}