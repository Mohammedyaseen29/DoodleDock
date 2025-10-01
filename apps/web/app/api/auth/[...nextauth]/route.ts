import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { NextAuthOptions } from "next-auth"
import { db } from "@repo/db/client"

const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })
    ],
    secret:process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "google") {
                try {
                    // Check if user exists
                    const existingUser = await db.user.findFirst({
                        where: { email: user.email! }
                    });

                    if (!existingUser) {
                        // Create new user
                        const newUser = await db.user.create({
                            data: {
                                email: user.email!,
                                name: user.name,
                                image: user.image
                            }
                        });
                        user.id = newUser.id;
                    } else {
                        // Update existing user info if needed
                        await db.user.update({
                            where: { id: existingUser.id },
                            data: {
                                name: user.name,
                                image: user.image
                            }
                        });
                        user.id = existingUser.id;
                    }

                    return true;
                } catch (error) {
                    console.error('Error during sign in:', error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, account }) {
            if (account && user) {
                token.userId = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.userId) {
                session.user.id = token.userId as string;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: '/auth/signin',
    },
}   

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST, authOptions }