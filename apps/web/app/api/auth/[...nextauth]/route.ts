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
    secret: process.env.NEXTAUTH_SECRET,
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
        async jwt({ token, user, account, trigger }) {
            // Initial sign in
            if (account && user) {
                token.userId = user.id;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (token.accessTokenExpires as number)) {
                return token;
            }

            // Access token has expired, try to update it
            return refreshAccessToken(token);
        },
        async session({ session, token }) {
            if (token.userId) {
                session.user.id = token.userId as string;
                session.error = token.error as string | undefined;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    events: {
        async signOut({ token }) {
            // Cleanup on sign out
            console.log('User signed out:', token.email);
        }
    }
}

async function refreshAccessToken(token: any) {
    try {
        const url =
            "https://oauth2.googleapis.com/token?" +
            new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            });

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
            throw refreshedTokens;
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
        };
    } catch (error) {
        console.error('Error refreshing access token:', error);

        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST, authOptions }