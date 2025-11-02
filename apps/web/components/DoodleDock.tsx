"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Toolbar } from "./Toolbar";
import { DoodleMenu } from "./Menu";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

interface RemoteCursor {
    userId: string;
    userEmail: string;
    userName: string;
    x: number;
    y: number;
    color: string;
}

// const DEFAULT_ROOM = "public-canvas";

// Generate a consistent color for each user based on their ID
function getUserColor(userId: string): string {
    const colors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Turquoise
        '#45B7D1', // Blue
        '#FFA07A', // Light Salmon
        '#98D8C8', // Mint
        '#F7DC6F', // Yellow
        '#BB8FCE', // Purple
        '#85C1E2', // Sky Blue
        '#F8B739', // Orange
        '#52B788', // Green
        '#E76F51', // Burnt Orange
        '#2A9D8F', // Teal
        '#E9C46A', // Gold
        '#F4A261', // Sandy Brown
        '#8338EC', // Violet
    ];
    
    // Generate consistent index from userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    //@ts-ignore
    return colors[index];
}

export default function CanvasBoard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomNameParam = searchParams.get('room');
    const { data: session, status } = useSession();
    
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [tool, setTool] = useState("rect");
    const [shapes, setShapes] = useState<any[]>([]);
    const [drawing, setDrawing] = useState<any>(null);
    const [selectedShapes, setSelectedShapes] = useState<number[]>([]);
    const [selectionBox, setSelectionBox] = useState<any>(null);
    const [undoStack, setUndoStack] = useState<any[][]>([]);
    const [redoStack, setRedoStack] = useState<any[][]>([]);
    const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
    const [roomInfo, setRoomInfo] = useState<any>(null);
    const [userCount, setUserCount] = useState(0);
    const [roomName, setRoomName] = useState<string>(roomNameParam || "");
    const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
    const lastCursorSend = useRef<number>(0);
    
      const LOCAL_SHAPES_KEY = "localCanvasData";
      const LOCAL_UNDO_KEY = "localUndoStack";
      const LOCAL_REDO_KEY = "localRedoStack";
      const LOCAL_ROOM_KEY = "lastRoomName";
      const MAX_STACK_LENGTH = 20;
    

    // WebSocket message handler
    const handleWebSocketMessage = useCallback((data: any) => {
        switch (data.type) {
            case 'authenticated':
              console.log('Authenticated');
                break;

            case 'joined':
                setRoomInfo({
                    roomId: data.roomId,
                    roomName: data.roomName,
                    roomOwner: data.roomOwner,
                });
                setUserCount(data.userCount);
                setHasJoinedRoom(true);
                console.log('Successfully joined room:', data.roomName);
                localStorage.removeItem(LOCAL_SHAPES_KEY);
                localStorage.removeItem(LOCAL_UNDO_KEY);
                localStorage.removeItem(LOCAL_REDO_KEY);
                setUndoStack([]);
                setRedoStack([]);
                localStorage.setItem(LOCAL_ROOM_KEY, data.roomName);
                break;

            case 'canvas-state':
                setShapes(data.shapes || []);
                break;

            case 'canvas-draw':
                if (data.userId !== session?.user?.id) {
                    if (data.isComplete) {
                        setShapes(prev => [...prev, data.shape]);
                    }
                }
                break;

            case 'canvas-clear':
                if (data.userId !== session?.user?.id) {
                    setShapes([]);
                }
                break;

            case 'canvas-delete':
                if (data.userId !== session?.user?.id) {
                    setShapes(prev => prev.filter((_, index) => !data.shapeIndices.includes(index)));
                }
                break;

            case 'canvas-undo':
            case 'canvas-redo':
                if (data.userId !== session?.user?.id) {
                    setShapes(data.shapes);
                }
                break;

            case 'cursor-move':
                if (data.userId !== session?.user?.id) {
                    setRemoteCursors(prev => ({
                        ...prev,
                        [data.userId]: {
                            userId: data.userId,
                            userEmail: data.userEmail,
                            userName: data.userName || data.userEmail.split('@')[0],
                            x: data.x,
                            y: data.y,
                            color: getUserColor(data.userId),
                        }
                    }));
                }
                break;

            case 'user-joined':
                setUserCount(data.userCount);
                console.log('User joined:', data.userEmail);
                break;

            case 'user-left':
                setUserCount(data.userCount);
                setRemoteCursors(prev => {
                    const updated = { ...prev };
                    delete updated[data.userId];
                    return updated;
                });
                console.log('User left:', data.userEmail);
                break;

            case 'message':
                console.log('Chat message:', data.message);
                break;

            case 'error':
                console.error('WebSocket error:', data.message);
                if (data.message === "Room not found") {
                    console.log('Room not found, attempting to create...');
                    createRoomAndJoin(roomName);
                }
                break;
        }
    }, [session, roomName]);

    const {
        isConnected,
        joinRoom,
        sendCanvasDraw,
        sendCanvasClear,
        sendCanvasDelete,
        sendCanvasUndo,
        sendCanvasRedo,
        sendCursorMove,
    } = useWebSocket({
        onMessage: handleWebSocketMessage,
    });

    const createRoomAndJoin = async (roomNameToCreate: string) => {
        if (status !== 'authenticated' || !session?.user?.id) return;
        
        if(!roomNameToCreate){
            console.log('Room name is required');
            return;
        }

        try {
            const response = await fetch('/api/room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomName: roomNameToCreate }),
            });

            if (response.ok || response.status === 409) {
                setTimeout(() => {
                    if (isConnected) {
                        joinRoom(roomNameToCreate);
                    }
                }, 500);
            }
        } catch (error) {
            console.error('Error creating room:', error);
        }
    };

    useEffect(() => {
        const newRoomName = roomNameParam;
        if (newRoomName !== roomName) {
            if(newRoomName){
                setRoomName(newRoomName);
                setHasJoinedRoom(false);
            }
        }
    }, [roomNameParam]);

    useEffect(() => {
        if (isConnected && status === 'authenticated' && session?.user?.id && !hasJoinedRoom && roomName !== "") {
            const timer = setTimeout(() => {
                console.log(`Attempting to join room: ${roomName}`);
                joinRoom(roomName);
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isConnected, status, session?.user?.id, roomName, hasJoinedRoom]);

  const pushUndoStack = (newEntry: any[]) => { 
    setUndoStack(prev => { 
      const updated = [...prev, newEntry].slice(-MAX_STACK_LENGTH);
      localStorage.setItem(LOCAL_UNDO_KEY, JSON.stringify(updated));
      return updated;
    });
  }
  const pushRedoStack = (newEntry: any[]) => {
    setRedoStack(prev => {
      const updated = [...prev, newEntry].slice(-MAX_STACK_LENGTH);
      localStorage.setItem(LOCAL_REDO_KEY, JSON.stringify(updated));
      return updated;
    });
  };
  const persistShapes = (s: any[]) => {
    localStorage.setItem(LOCAL_SHAPES_KEY, JSON.stringify(s));
  };
  useEffect(() => {
    const savedShapes = localStorage.getItem(LOCAL_SHAPES_KEY);
    const savedUndo = localStorage.getItem(LOCAL_UNDO_KEY);
    const savedRedo = localStorage.getItem(LOCAL_REDO_KEY);
    if (savedShapes) setShapes(JSON.parse(savedShapes));
    if (savedUndo) setUndoStack(JSON.parse(savedUndo));
    if (savedRedo) setRedoStack(JSON.parse(savedRedo));
  }, []);
  
  useEffect(() => {
    if (!hasJoinedRoom) {
      persistShapes(shapes);
      localStorage.setItem(LOCAL_UNDO_KEY, JSON.stringify(undoStack));
      localStorage.setItem(LOCAL_REDO_KEY, JSON.stringify(redoStack));
    }
  }, [shapes, undoStack, redoStack, hasJoinedRoom]);

    // Drawing functions
    function drawShape(ctx: CanvasRenderingContext2D, shape: any, preview = false) {
        ctx.strokeStyle = preview ? "#888" : "#000";
        ctx.fillStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();

        if (shape.type === "rect") {
            ctx.rect(shape.x, shape.y, shape.w, shape.h);
            ctx.stroke();
        } else if (shape.type === "circle") {
            ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
            ctx.stroke();
        } else if (shape.type === "line" || shape.type === "arrow") {
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
            if (shape.type === "arrow") drawArrowHead(ctx, shape);
        } else if (shape.type === "pen") {
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            shape.points.forEach((p: any) => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }
    }

    function drawArrowHead(ctx: CanvasRenderingContext2D, shape: any) {
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

    // Draw custom cursor
    function drawCursor(ctx: CanvasRenderingContext2D, cursor: RemoteCursor) {
        // Draw cursor pointer
        ctx.save();
        ctx.fillStyle = cursor.color;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        // Cursor arrow path
        ctx.beginPath();
        ctx.moveTo(cursor.x, cursor.y);
        ctx.lineTo(cursor.x + 3, cursor.y + 15);
        ctx.lineTo(cursor.x + 8, cursor.y + 12);
        ctx.lineTo(cursor.x + 13, cursor.y + 20);
        ctx.lineTo(cursor.x + 16, cursor.y + 18);
        ctx.lineTo(cursor.x + 11, cursor.y + 10);
        ctx.lineTo(cursor.x + 18, cursor.y + 9);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // Draw user name label
        const label = cursor.userName;
        const padding = 6;
        const fontSize = 12;
        
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        
        // Label background
        const labelX = cursor.x + 20;
        const labelY = cursor.y + 8;
        const labelHeight = fontSize + padding * 2;
        
        ctx.fillStyle = cursor.color;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        // Rounded rectangle for label
        const radius = 4;
        ctx.beginPath();
        ctx.moveTo(labelX + radius, labelY);
        ctx.lineTo(labelX + textWidth + padding * 2 - radius, labelY);
        ctx.quadraticCurveTo(labelX + textWidth + padding * 2, labelY, labelX + textWidth + padding * 2, labelY + radius);
        ctx.lineTo(labelX + textWidth + padding * 2, labelY + labelHeight - radius);
        ctx.quadraticCurveTo(labelX + textWidth + padding * 2, labelY + labelHeight, labelX + textWidth + padding * 2 - radius, labelY + labelHeight);
        ctx.lineTo(labelX + radius, labelY + labelHeight);
        ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - radius);
        ctx.lineTo(labelX, labelY + radius);
        ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // Label text
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX + padding, labelY + labelHeight / 2);
        
        ctx.restore();
    }

    // Render main canvas
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
                ctx.lineWidth = 2;
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

        if (drawing && drawing.type !== "eraser") drawShape(ctx, drawing, true);

        if (selectionBox) {
            const { x, y, w, h } = selectionBox;
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        }
    }, [shapes, drawing, selectedShapes, selectionBox]);

    // Render cursor overlay canvas
    useEffect(() => {
        const cursorCanvas = cursorCanvasRef.current;
        if (!cursorCanvas) return;
        
        const ctx = cursorCanvas.getContext("2d");
        if (!ctx) return;
        
        ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        
        // Draw all remote cursors
        Object.values(remoteCursors).forEach((cursor) => {
            drawCursor(ctx, cursor);
        });
    }, [remoteCursors]);

    // Mouse handlers
    function handleMouseDown(e: React.MouseEvent) {
        if (status !== 'authenticated') {
            console.warn('Must be authenticated to draw');
            return;
        }

        const rect = canvasRef.current!.getBoundingClientRect();
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
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.clearRect(startX - 8, startY - 8, 16, 16);
            setDrawing({ type: "eraser" });
        } else if (tool === "select") {
            setDrawing({ type: "select", x: startX, y: startY });
        }
    }

    function handleMouseMove(e: React.MouseEvent) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

        // Throttle cursor updates to every 50ms
        const now = Date.now();
        if (isConnected && hasJoinedRoom && now - lastCursorSend.current > 50) {
            sendCursorMove(currX, currY);
            lastCursorSend.current = now;
        }

        if (!drawing) return;

        if (drawing.type === "rect") {
            setDrawing({ ...drawing, w: currX - drawing.x, h: currY - drawing.y });
        } else if (drawing.type === "circle") {
            const r = Math.sqrt(Math.pow(currX - drawing.x, 2) + Math.pow(currY - drawing.y, 2));
            setDrawing({ ...drawing, r });
        } else if (drawing.type === "line" || drawing.type === "arrow") {
            setDrawing({ ...drawing, x2: currX, y2: currY });
        } else if (drawing.type === "pen") {
            setDrawing({
                ...drawing,
                points: [...drawing.points, { x: currX, y: currY }],
            });
        } else if (drawing.type === "eraser") {
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.clearRect(currX - 8, currY - 8, 16, 16);
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
            setShapes((prev) => {
                const newShapes = [...prev, drawing];
                pushUndoStack(prev);
                setRedoStack([]);
                localStorage.removeItem(LOCAL_REDO_KEY);
                
                if (isConnected && hasJoinedRoom) {
                    sendCanvasDraw(drawing, true);
                }
                
                return newShapes;
            });
        } else if (drawing.type === "select" && selectionBox) {
            const box = {
                x1: Math.min(selectionBox.x, selectionBox.x + selectionBox.w),
                y1: Math.min(selectionBox.y, selectionBox.y + selectionBox.h),
                x2: Math.max(selectionBox.x, selectionBox.x + selectionBox.w),
                y2: Math.max(selectionBox.y, selectionBox.y + selectionBox.h),
            };

            const intersects = (b: any, s: any) =>
                !(s.x2 < b.x1 || s.x1 > b.x2 || s.y2 < b.y1 || s.y1 > b.y2);

            const selected = shapes
                .map((s, i) => {
                    let bounds;
                    if (s.type === "rect") {
                        bounds = { x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y + s.h };
                    } else if (s.type === "circle") {
                        bounds = { x1: s.x - s.r, y1: s.y - s.r, x2: s.x + s.r, y2: s.y + s.r };
                    } else if (s.type === "line" || s.type === "arrow") {
                        bounds = {
                            x1: Math.min(s.x1, s.x2),
                            y1: Math.min(s.y1, s.y2),
                            x2: Math.max(s.x1, s.x2),
                            y2: Math.max(s.y1, s.y2),
                        };
                    }
                    return bounds && intersects(box, bounds) ? i : null;
                })
                .filter((i) => i !== null) as number[];

            setSelectedShapes(selected);
            setSelectionBox(null);
        }

        setDrawing(null);
    }

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Backspace" && selectedShapes.length > 0) {
                setShapes((prev) => {
                    const newShapes = prev.filter((_, i) => !selectedShapes.includes(i));
                    pushUndoStack(prev);
                    setRedoStack([]);
                    localStorage.removeItem(LOCAL_REDO_KEY);
                    
                    if (isConnected && hasJoinedRoom) {
                        sendCanvasDelete(selectedShapes);
                    }
                    
                    return newShapes;
                });
                setSelectedShapes([]);
            } else if (e.ctrlKey && e.key === "z") {
                handleUndo();
            } else if (e.ctrlKey && e.shiftKey && e.key === "Z") {
                handleRedo();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedShapes, undoStack, redoStack, isConnected, hasJoinedRoom]);

    function handleUndo() {
        if (undoStack.length > 0) {
            const prevShapes = undoStack[undoStack.length - 1];
            pushRedoStack(shapes);
            if (prevShapes !== undefined) {
                setShapes(prevShapes);
                if (isConnected && hasJoinedRoom) {
                    sendCanvasUndo(prevShapes);
                }
            }
          setUndoStack(u => { 
            const updated = u.slice(0, -1);
            localStorage.setItem(LOCAL_UNDO_KEY, JSON.stringify(updated));
            return updated;
          });
        }
    }

    function handleRedo() {
        if (redoStack.length > 0) {
            const nextShapes = redoStack[redoStack.length - 1];
            pushUndoStack(shapes);
            if (nextShapes !== undefined) {
                setShapes(nextShapes);
                if (isConnected && hasJoinedRoom) {
                    sendCanvasRedo(nextShapes);
                }
            }
          setRedoStack(r => {
            const updated = r.slice(0, -1);
            localStorage.setItem(LOCAL_REDO_KEY, JSON.stringify(updated));
            return updated;
          });
        }
    }

    return (
        <div className="flex flex-col items-center h-screen bg-gray-50">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 fixed w-full z-10 bg-white/90 backdrop-blur-sm p-2 border-b shadow-sm">
                <div className="flex-none">
                    <DoodleMenu/>
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2">
                    <Toolbar tool={tool} setTool={setTool} />
                </div>
                <div className="ml-auto mr-4 flex items-center gap-4">
                    {status === 'authenticated' && (
                        <>
                            {roomInfo && (
                                <div className="text-sm flex items-center gap-2">
                                    <span className="font-semibold">{roomInfo.roomName}</span>
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {userCount}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
                                <div 
                                    className={`w-2 h-2 rounded-full ${hasJoinedRoom ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} 
                                />
                                <span className="text-xs font-medium text-gray-700">
                                    {hasJoinedRoom ? 'Live' : 'Offline'}
                                </span>
                            </div>
                        </>
                    )}
                    {status === 'unauthenticated' && (
                        <div className="text-sm text-amber-600 px-3 py-1.5 rounded-full bg-amber-50">
                            Sign in to collaborate
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas Container */}
            <div className="relative mt-16">
                {/* Main drawing canvas */}
                <canvas
                    ref={canvasRef}
                    width={1800}
                    height={1500}
                    className="cursor-crosshair border border-gray-200 rounded-lg shadow-lg bg-white"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                />
                
                {/* Cursor overlay canvas */}
                <canvas
                    ref={cursorCanvasRef}
                    width={1800}
                    height={1500}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ zIndex: 10 }}
                />
            </div>

            {/* Active users indicator */}
            {Object.keys(remoteCursors).length > 0 && (
                <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
                    <div className="text-xs font-semibold text-gray-600 mb-2">Active Users</div>
                    <div className="space-y-1">
                        {Object.values(remoteCursors).slice(0, 5).map((cursor) => (
                            <div key={cursor.userId} className="flex items-center gap-2 text-sm">
                                <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: cursor.color }}
                                />
                                <span className="text-gray-700 truncate">{cursor.userName}</span>
                            </div>
                        ))}
                        {Object.keys(remoteCursors).length > 5 && (
                            <div className="text-xs text-gray-500 pl-5">
                                +{Object.keys(remoteCursors).length - 5} more
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}