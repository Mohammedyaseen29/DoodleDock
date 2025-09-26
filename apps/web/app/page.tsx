"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import CanvasBoard from "../app/components/DoodleDock"
import SignInButton from "../app/components/SignInButton"
import RoomManager from "../app/components/RoomManager"

export default function Home() {
  const { data: session, status } = useSession()
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const [isInRoom, setIsInRoom] = useState(false)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-bold text-gray-900">Collaborative Canvas</h1>
              <SignInButton />
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Draw Together in Real-Time
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Create, collaborate, and share your ideas on a digital canvas.
              Sign in to start drawing and invite others to join your room.
            </p>
            <div className="mt-8">
              <SignInButton />
            </div>
          </div>

          {/* Demo Canvas */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-center mb-8">Try the Canvas (Local Mode)</h3>
            <CanvasBoard isInRoom={false} />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">Collaborative Canvas</h1>
              {currentRoom && (
                <span className="text-sm text-gray-600">
                  Room: <span className="font-medium">{currentRoom}</span>
                </span>
              )}
            </div>
            <SignInButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <RoomManager
            currentRoom={currentRoom}
            setCurrentRoom={setCurrentRoom}
            setIsInRoom={setIsInRoom}
          />
        </div>

        <CanvasBoard
          roomId={currentRoom || undefined}
          isInRoom={isInRoom}
        />
      </main>
    </div>
  )
}
