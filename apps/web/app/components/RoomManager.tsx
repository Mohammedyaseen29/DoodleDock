"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"

interface RoomManagerProps {
    currentRoom: string | null
    setCurrentRoom: (room: string | null) => void
    setIsInRoom: (inRoom: boolean) => void
}

export default function RoomManager({
    currentRoom,
    setCurrentRoom,
    setIsInRoom
}: RoomManagerProps) {
    const { data: session } = useSession()
    const [roomName, setRoomName] = useState("")
    const [joinRoomName, setJoinRoomName] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const createRoom = async () => {
        if (!roomName.trim() || !session?.user?.id) return

        setLoading(true)
        setError("")

        try {
            const response = await fetch('/api/room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomName: roomName.trim()
                })
            })

            const data = await response.json()

            if (response.ok) {
                setCurrentRoom(data.name)
                setIsInRoom(true)
                setRoomName("")
            } else {
                setError(data.error || 'Failed to create room')
            }
        } catch (err) {
            setError('Network error occurred')
        } finally {
            setLoading(false)
        }
    }

    const joinRoom = async () => {
        if (!joinRoomName.trim()) return

        setLoading(true)
        setError("")

        try {
            const response = await fetch(`/api/room/name/${joinRoomName.trim()}`)

            if (response.ok) {
                const room = await response.json()
                setCurrentRoom(room.name)
                setIsInRoom(true)
                setJoinRoomName("")
            } else {
                const data = await response.json()
                setError(data.error || 'Room not found')
            }
        } catch (err) {
            setError('Network error occurred')
        } finally {
            setLoading(false)
        }
    }

    const leaveRoom = () => {
        setCurrentRoom(null)
        setIsInRoom(false)
        setError("")
    }

    if (currentRoom) {
        return (
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">
                            Current Room: {currentRoom}
                        </h3>
                        <p className="text-sm text-gray-600">
                            You are connected to this collaborative room
                        </p>
                    </div>
                    <button
                        onClick={leaveRoom}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                        Leave Room
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Room Management</h2>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* Create Room */}
                <div className="space-y-3">
                    <h3 className="text-md font-medium text-gray-700">Create New Room</h3>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="Enter room name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                        />
                        <button
                            onClick={createRoom}
                            disabled={loading || !roomName.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </div>

                {/* Join Room */}
                <div className="space-y-3">
                    <h3 className="text-md font-medium text-gray-700">Join Existing Room</h3>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={joinRoomName}
                            onChange={(e) => setJoinRoomName(e.target.value)}
                            placeholder="Enter room name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                        />
                        <button
                            onClick={joinRoom}
                            disabled={loading || !joinRoomName.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Joining...' : 'Join'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
                <p><strong>Local Mode:</strong> When not in a room, your drawings are saved locally in your browser.</p>
                <p><strong>Room Mode:</strong> When in a room, you can collaborate with others in real-time.</p>
            </div>
        </div>
    )
}