import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UseWebSocketProps {
    onMessage?: (data: any) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
}

export function useWebSocket({ onMessage, onConnected, onDisconnected }: UseWebSocketProps = {}) {
    const { data: session, status } = useSession();
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [currentRoom, setCurrentRoom] = useState<string | null>(null);
    //@ts-ignore
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false);
    const tokenRef = useRef<string | null>(null);

    const connect = useCallback(async () => {
        // Prevent multiple simultaneous connection attempts
        if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        // Check if session is authenticated
        if (status !== 'authenticated' || !session?.user?.id) {
            console.log('Session not authenticated, skipping WebSocket connection');
            return;
        }

        isConnectingRef.current = true;

        try {
            // Get WebSocket token only if we don't have one or it's expired
            if (!tokenRef.current) {
                const response = await fetch('/api/ws-token', {
                    method: 'POST',
                });

                if (!response.ok) {
                    throw new Error('Failed to get WebSocket token');
                }

                const { token } = await response.json();
                tokenRef.current = token;
            }

            // Connect to WebSocket server
            const ws = new WebSocket(`ws://localhost:8080?token=${tokenRef.current}`);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;
                isConnectingRef.current = false;
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
                isConnectingRef.current = false;
            };

            ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                setIsConnected(false);
                wsRef.current = null;
                isConnectingRef.current = false;
                onDisconnected?.();

                // Clear token on close to get a fresh one on reconnect
                if (event.code === 1006 || event.code === 1008) {
                    tokenRef.current = null;
                }

                // Attempt reconnection
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                } else {
                    console.log('Max reconnection attempts reached');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            isConnectingRef.current = false;
            tokenRef.current = null; // Clear token on error
        }
    }, [session, status, onMessage, onConnected, onDisconnected]);

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
        isConnectingRef.current = false;
        tokenRef.current = null;
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
        if (status === 'authenticated' && session?.user?.id) {
            connect();
        } else if (status === 'unauthenticated') {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [status, session?.user?.id]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

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