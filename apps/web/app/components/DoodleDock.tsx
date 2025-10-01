"use client"

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// =====================
// TYPES
// =====================
type Point = { x: number; y: number };

type RectShape = { type: "rect"; x: number; y: number; w: number; h: number };
type CircleShape = { type: "circle"; x: number; y: number; r: number };
type LineShape = {
    type: "line" | "arrow";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
type PenShape = { type: "pen"; points: Point[] };
type EraserShape = { type: "eraser"; x: number; y: number };

export type Shape =
    | RectShape
    | CircleShape
    | LineShape
    | PenShape
    | EraserShape;

type SelectionBox = { x: number; y: number; w: number; h: number };
type SelectShape = SelectionBox & { type: "select" };

type Tool = Shape["type"] | "select";

interface User {
    userId: string;
    userEmail: string;
    cursor?: { x: number; y: number };
}

interface CanvasProps {
    roomId?: string;
    isInRoom?: boolean;
}

// =====================
// COMPONENT
// =====================
export default function CanvasBoard({ roomId, isInRoom = false }: CanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const { data: session } = useSession();

    const [tool, setTool] = useState<Tool>("rect");
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [drawing, setDrawing] = useState<Shape | SelectShape | null>(null);
    const [selectedShapes, setSelectedShapes] = useState<number[]>([]);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [undoStack, setUndoStack] = useState<Shape[][]>([]);
    const [redoStack, setRedoStack] = useState<Shape[][]>([]);
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

    // Local storage key
    const LOCAL_STORAGE_KEY = 'canvas_shapes';

    // =====================
    // LOCAL STORAGE FUNCTIONS
    // =====================
    const saveShapesToLocal = useCallback((shapesToSave: Shape[]) => {
        if (!isInRoom) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(shapesToSave));
            } catch (error) {
                console.error('Error saving shapes to localStorage:', error);
            }
        }
    }, [isInRoom]);

    const loadShapesFromLocal = useCallback(() => {
        if (!isInRoom) {
            try {
                const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (saved) {
                    const parsedShapes = JSON.parse(saved);
                    setShapes(parsedShapes);
                    return parsedShapes;
                }
            } catch (error) {
                console.error('Error loading shapes from localStorage:', error);
            }
        }
        return [];
    }, [isInRoom]);

    // =====================
    // WEBSOCKET CONNECTION
    // =====================
    const connectWebSocket = useCallback(async () => {
        if (!session?.user?.id || !isInRoom || !roomId) return;

        setConnectionStatus('connecting');

        try {
            // Generate JWT token for WebSocket authentication using our new API
            const response = await fetch('/api/ws-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get WebSocket token');
            }

            const data = await response.json();
            const token = data.token;

            const wsUrl = `ws://localhost:8080?token=${token}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setConnectionStatus('connected');

                // Join the room
                ws.send(JSON.stringify({
                    type: 'join',
                    roomName: roomId
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'canvas-state':
                            setShapes(data.shapes || []);
                            break;

                        case 'canvas-draw':
                            if (data.isComplete) {
                                setShapes(prev => [...prev, data.shape]);
                            }
                            break;

                        case 'canvas-clear':
                            setShapes([]);
                            break;

                        case 'canvas-delete':
                            setShapes(prev => prev.filter((_, index) => !data.shapeIndices.includes(index)));
                            break;

                        case 'canvas-undo':
                        case 'canvas-redo':
                            setShapes(data.shapes || []);
                            break;

                        case 'user-joined':
                        case 'user-left':
                            // Handle user presence updates
                            break;

                        case 'cursor-move':
                            setConnectedUsers(prev => {
                                const updated = prev.filter(u => u.userId !== data.userId);
                                updated.push({
                                    userId: data.userId,
                                    userEmail: data.userEmail,
                                    cursor: { x: data.x, y: data.y }
                                });
                                return updated;
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setConnectionStatus('disconnected');
                wsRef.current = null;
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnectionStatus('disconnected');
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            setConnectionStatus('disconnected');
        }
    }, [session, isInRoom, roomId]);

    // =====================
    // EFFECTS
    // =====================
    useEffect(() => {
        if (isInRoom) {
            connectWebSocket();
        } else {
            loadShapesFromLocal();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [isInRoom, connectWebSocket, loadShapesFromLocal]);

    // Save to localStorage when shapes change (only in local mode)
    useEffect(() => {
        saveShapesToLocal(shapes);
    }, [shapes, saveShapesToLocal]);

    // =====================
    // WEBSOCKET HELPERS
    // =====================
    const sendToWebSocket = useCallback((message: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    // =====================
    // DRAWING SHAPES
    // =====================
    function drawShape(
        ctx: CanvasRenderingContext2D,
        shape: Shape,
        preview = false
    ) {
        ctx.strokeStyle = preview ? "#888" : "blue";
        ctx.fillStyle = "#000";
        ctx.beginPath();

        switch (shape.type) {
            case "rect":
                ctx.rect(shape.x, shape.y, shape.w, shape.h);
                ctx.stroke();
                break;
            case "circle":
                ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case "line":
            case "arrow":
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.stroke();
                if (shape.type === "arrow") drawArrowHead(ctx, shape);
                break;
            case "pen":
                if (shape.points.length > 0 && shape.points[0]) {
                    ctx.moveTo(shape.points[0].x, shape.points[0].y);
                    shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
                    ctx.stroke();
                }
                break;
            case "eraser":
                ctx.clearRect(shape.x - 8, shape.y - 8, 16, 16);
                break;
        }
    }

    function drawArrowHead(ctx: CanvasRenderingContext2D, shape: LineShape) {
        const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
        const headlen = 10;
        ctx.beginPath();
        ctx.moveTo(shape.x2, shape.y2);
        ctx.lineTo(
            shape.x2 - headlen * Math.cos(angle - Math.PI / 6),
            shape.y2 - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(shape.x2, shape.y2);
        ctx.lineTo(
            shape.x2 - headlen * Math.cos(angle + Math.PI / 6),
            shape.y2 - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }

    // Draw user cursors
    function drawUserCursors(ctx: CanvasRenderingContext2D) {
        connectedUsers.forEach(user => {
            if (user.cursor) {
                ctx.save();
                ctx.fillStyle = "#ff0000";
                ctx.beginPath();
                ctx.arc(user.cursor.x, user.cursor.y, 3, 0, Math.PI * 2);
                ctx.fill();

                // Draw user email near cursor
                ctx.fillStyle = "#000";
                ctx.font = "12px Arial";
                ctx.fillText(user.userEmail, user.cursor.x + 10, user.cursor.y - 10);
                ctx.restore();
            }
        });
    }

    // =====================
    // RENDER CANVAS
    // =====================
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        shapes.forEach((s, i) => {
            drawShape(ctx, s);
            if (selectedShapes.includes(i)) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = "blue";
                if (s.type === "rect") ctx.strokeRect(s.x, s.y, s.w, s.h);
                else if (s.type === "circle")
                    ctx.strokeRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
                else if (s.type === "line" || s.type === "arrow")
                    ctx.strokeRect(
                        Math.min(s.x1, s.x2),
                        Math.min(s.y1, s.y2),
                        Math.abs(s.x2 - s.x1),
                        Math.abs(s.y2 - s.y1)
                    );
                ctx.setLineDash([]);
            }
        });

        if (drawing && drawing.type !== "select") drawShape(ctx, drawing, true);

        if (selectionBox) {
            const { x, y, w, h } = selectionBox;
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "blue";
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        }

        // Draw user cursors
        if (isInRoom) {
            drawUserCursors(ctx);
        }
    }, [shapes, drawing, selectedShapes, selectionBox, connectedUsers, isInRoom]);

    // =====================
    // MOUSE HANDLERS
    // =====================
    function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        if (tool === "rect") {
            setDrawing({ type: "rect", x: startX, y: startY, w: 0, h: 0 });
        } else if (tool === "circle") {
            setDrawing({ type: "circle", x: startX, y: startY, r: 0 });
        } else if (tool === "line" || tool === "arrow") {
            setDrawing({ type: tool, x1: startX, y1: startY, x2: startX, y2: startY });
        } else if (tool === "pen") {
            setDrawing({ type: "pen", points: [{ x: startX, y: startY }] });
        } else if (tool === "eraser") {
            setDrawing({ type: "eraser", x: startX, y: startY });
        } else if (tool === "select") {
            setDrawing({ type: "select", x: startX, y: startY, w: 0, h: 0 });
        }
    }

    function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

        // Send cursor position to WebSocket
        if (isInRoom && wsRef.current) {
            sendToWebSocket({
                type: "cursor-move",
                x: currX,
                y: currY
            });
        }

        if (!drawing) return;

        if (drawing.type === "rect") {
            setDrawing({ ...drawing, w: currX - drawing.x, h: currY - drawing.y });
        } else if (drawing.type === "circle") {
            const r = Math.sqrt(
                Math.pow(currX - drawing.x, 2) + Math.pow(currY - drawing.y, 2)
            );
            setDrawing({ ...drawing, r });
        } else if (drawing.type === "line" || drawing.type === "arrow") {
            setDrawing({ ...drawing, x2: currX, y2: currY });
        } else if (drawing.type === "pen") {
            setDrawing({
                ...drawing,
                points: [...drawing.points, { x: currX, y: currY }],
            });
        } else if (drawing.type === "eraser") {
            const newShape = { ...drawing, x: currX, y: currY };
            setShapes((prev) => [...prev, newShape]);

            if (isInRoom) {
                sendToWebSocket({
                    type: "canvas-draw",
                    shape: newShape,
                    isComplete: true
                });
            }
        } else if (drawing.type === "select") {
            setSelectionBox({
                x: drawing.x,
                y: drawing.y,
                w: currX - drawing.x,
                h: currY - drawing.y,
            });
        }
    }

    function handleMouseUp() {
        if (!drawing) return;

        if (["rect", "circle", "line", "arrow", "pen"].includes(drawing.type)) {
            const newShape = drawing as Shape;
            setShapes((prev) => {
                const newShapes = [...prev, newShape];
                setUndoStack([...undoStack, prev]);
                setRedoStack([]);
                return newShapes;
            });

            if (isInRoom) {
                sendToWebSocket({
                    type: "canvas-draw",
                    shape: newShape,
                    isComplete: true
                });
            }
        } else if (drawing.type === "select" && selectionBox) {
            const box = {
                x1: Math.min(selectionBox.x, selectionBox.x + selectionBox.w),
                y1: Math.min(selectionBox.y, selectionBox.y + selectionBox.h),
                x2: Math.max(selectionBox.x, selectionBox.x + selectionBox.w),
                y2: Math.max(selectionBox.y, selectionBox.y + selectionBox.h),
            };
            const selected = shapes
                .map((s, i) => {
                    if (s.type === "rect") {
                        if (
                            s.x >= box.x1 &&
                            s.y >= box.y1 &&
                            s.x + s.w <= box.x2 &&
                            s.y + s.h <= box.y2
                        )
                            return i;
                    } else if (s.type === "circle") {
                        if (
                            s.x - s.r >= box.x1 &&
                            s.y - s.r >= box.y1 &&
                            s.x + s.r <= box.x2 &&
                            s.y + s.r <= box.y2
                        )
                            return i;
                    } else if (s.type === "line" || s.type === "arrow") {
                        if (
                            Math.min(s.x1, s.x2) >= box.x1 &&
                            Math.min(s.y1, s.y2) >= box.y1 &&
                            Math.max(s.x1, s.x2) <= box.x2 &&
                            Math.max(s.y1, s.y2) <= box.y2
                        )
                            return i;
                    }
                    return null;
                })
                .filter((i): i is number => i !== null);
            setSelectedShapes(selected);
            setSelectionBox(null);
        }

        setDrawing(null);
    }

    // =====================
    // CANVAS ACTIONS
    // =====================
    const clearCanvas = () => {
        setShapes([]);
        setUndoStack([...undoStack, shapes]);
        setRedoStack([]);

        if (isInRoom) {
            sendToWebSocket({ type: "canvas-clear" });
        }
    };

    const deleteSelected = () => {
        if (selectedShapes.length === 0) return;

        setShapes((prev) => {
            const newShapes = prev.filter((_, i) => !selectedShapes.includes(i));
            setUndoStack([...undoStack, prev]);
            setRedoStack([]);
            return newShapes;
        });

        if (isInRoom) {
            sendToWebSocket({
                type: "canvas-delete",
                shapeIndices: selectedShapes
            });
        }

        setSelectedShapes([]);
    };

    // =====================
    // UNDO & REDO
    // =====================
    function handleUndo() {
        if (undoStack.length > 0) {
            const prevShapes = undoStack[undoStack.length - 1];
            setRedoStack([...redoStack, shapes]);
            setShapes(prevShapes ?? []);
            setUndoStack(undoStack.slice(0, -1));

            if (isInRoom) {
                sendToWebSocket({
                    type: "canvas-undo",
                    shapes: prevShapes ?? []
                });
            }
        }
    }

    function handleRedo() {
        if (redoStack.length > 0) {
            const nextShapes = redoStack[redoStack.length - 1];
            setUndoStack([...undoStack, shapes]);
            setShapes(nextShapes ?? []);
            setRedoStack(redoStack.slice(0, -1));

            if (isInRoom) {
                sendToWebSocket({
                    type: "canvas-redo",
                    shapes: nextShapes ?? []
                });
            }
        }
    }

    // =====================
    // KEYBOARD SHORTCUTS
    // =====================
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Backspace") {
                deleteSelected();
            } else if (e.ctrlKey && e.key === "z") {
                handleUndo();
            } else if (e.ctrlKey && e.shiftKey && e.key === "Z") {
                handleRedo();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedShapes, undoStack, redoStack]);

    // =====================
    // UI
    // =====================
    return (
        <div className="flex flex-col items-center p-4">
            {/* Status Bar */}
            {isInRoom && (
                <div className="mb-4 text-sm">
                    Status: <span className={`font-bold ${connectionStatus === 'connected' ? 'text-green-600' :
                        connectionStatus === 'connecting' ? 'text-yellow-600' :
                            'text-red-600'
                        }`}>
                        {connectionStatus.toUpperCase()}
                    </span>
                    {connectedUsers.length > 0 && (
                        <span className="ml-4">
                            Connected Users: {connectedUsers.length}
                        </span>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {["rect", "circle", "line", "arrow", "pen", "eraser", "select"].map(
                    (t) => (
                        <button
                            key={t}
                            onClick={() => setTool(t as Tool)}
                            className={`px-3 py-1 rounded capitalize ${tool === t ? "bg-blue-500 text-white" : "bg-gray-200"
                                }`}
                        >
                            {t}
                        </button>
                    )
                )}
                <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                >
                    Undo
                </button>
                <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                >
                    Redo
                </button>
                <button
                    onClick={clearCanvas}
                    className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                >
                    Clear
                </button>
                {selectedShapes.length > 0 && (
                    <button
                        onClick={deleteSelected}
                        className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600"
                    >
                        Delete Selected ({selectedShapes.length})
                    </button>
                )}
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1200}
                height={800}
                className="border border-gray-400 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            />
        </div>
    );
}