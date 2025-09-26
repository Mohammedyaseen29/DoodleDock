"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function SignInButton() {
    const { data: session, status } = useSession()

    if (status === "loading") {
        return <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>
    }

    if (session) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {session.user?.image && (
                        <img
                            src={session.user.image}
                            alt="Profile"
                            className="w-8 h-8 rounded-full"
                        />
                    )}
                    <span className="text-sm text-gray-700">
                        {session.user?.name || session.user?.email}
                    </span>
                </div>
                <button
                    onClick={() => signOut()}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                    Sign Out
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => signIn("google")}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            Sign in with Google
        </button>
    )
}