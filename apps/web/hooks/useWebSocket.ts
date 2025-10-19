import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UseWebSocketProps {
    onMessage?: (data: any) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
}

export function useWebSocket({ onMessage, onConnected, onDisconnected }: UseWebSocketProps = {}) {
    const { data: session } = useSession();
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [currentRoom, setCurrentRoom] = useState<string | null>(null);
    //@ts-ignore
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(async () => {
        if (!session?.user?.id || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            // Get WebSocket token
            const response = await fetch('/api/ws-token', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to get WebSocket token');
            }

            const { token } = await response.json();

            // Connect to WebSocket server
            const ws = new WebSocket(`ws://localhost:8080?token=${token}`);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;
                onConnected?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message:', data.type);
                    onMessage?.(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                wsRef.current = null;
                onDisconnected?.();

                // Attempt reconnection
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
        }
    }, [session, onMessage, onConnected, onDisconnected]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setCurrentRoom(null);
    }, []);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected');
        return false;
    }, []);

    const joinRoom = useCallback((roomName: string) => {
        if (send({ type: 'join', roomName })) {
            setCurrentRoom(roomName);
            return true;
        }
        return false;
    }, [send]);

    const sendMessage = useCallback((message: string) => {
        return send({ type: 'message', message });
    }, [send]);

    const sendCanvasDraw = useCallback((shape: any, isComplete: boolean) => {
        return send({ type: 'canvas-draw', shape, isComplete });
    }, [send]);

    const sendCanvasClear = useCallback(() => {
        return send({ type: 'canvas-clear' });
    }, [send]);

    const sendCanvasDelete = useCallback((shapeIndices: number[]) => {
        return send({ type: 'canvas-delete', shapeIndices });
    }, [send]);

    const sendCanvasUndo = useCallback((shapes: any[]) => {
        return send({ type: 'canvas-undo', shapes });
    }, [send]);

    const sendCanvasRedo = useCallback((shapes: any[]) => {
        return send({ type: 'canvas-redo', shapes });
    }, [send]);

    const sendCursorMove = useCallback((x: number, y: number) => {
        return send({ type: 'cursor-move', x, y });
    }, [send]);

    useEffect(() => {
        if (session?.user?.id) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [session, connect, disconnect]);

    return {
        isConnected,
        currentRoom,
        connect,
        disconnect,
        joinRoom,
        sendMessage,
        sendCanvasDraw,
        sendCanvasClear,
        sendCanvasDelete,
        sendCanvasUndo,
        sendCanvasRedo,
        sendCursorMove,
    };
}