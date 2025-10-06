"use client";

import React, { useRef, useState, useEffect } from "react";
import { Toolbar } from "./Toolbar";
import { DoodleMenu } from "./Menu";


export default function CanvasBoard() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [tool, setTool] = useState("rect");
    const [shapes, setShapes] = useState<any[]>([]);
    const [drawing, setDrawing] = useState<any>(null);
    const [selectedShapes, setSelectedShapes] = useState<number[]>([]);
    const [selectionBox, setSelectionBox] = useState<any>(null);
    const [undoStack, setUndoStack] = useState<any[][]>([]);
    const [redoStack, setRedoStack] = useState<any[][]>([]);

    // =====================
    // DRAWING SHAPES
    // =====================
    function drawShape(ctx: CanvasRenderingContext2D, shape: any, preview = false) {
        ctx.strokeStyle = preview ? "#888" : "#000";
        ctx.fillStyle = "#000";
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

    // =====================
    // RENDER CANVAS
    // =====================
    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
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

        if (drawing && drawing.type !== "eraser") drawShape(ctx, drawing, true);

        if (selectionBox) {
            const { x, y, w, h } = selectionBox;
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "blue";
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        }
    }, [shapes, drawing, selectedShapes, selectionBox]);

    // =====================
    // MOUSE HANDLERS
    // =====================
    function handleMouseDown(e: React.MouseEvent) {
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
            setDrawing({ type: "eraser" }); // keep erasing while moving
        } else if (tool === "select") {
            setDrawing({ type: "select", x: startX, y: startY });
        }
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (!drawing) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

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
                setUndoStack([...undoStack, prev]);
                setRedoStack([]);
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

    // =====================
    // KEYBOARD SHORTCUTS
    // =====================
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Backspace") {
                setShapes((prev) => {
                    const newShapes = prev.filter((_, i) => !selectedShapes.includes(i));
                    setUndoStack([...undoStack, prev]);
                    setRedoStack([]);
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
    }, [selectedShapes, undoStack, redoStack]);

    // =====================
    // UNDO & REDO
    // =====================
    function handleUndo() {
        if (undoStack.length > 0) {
            const prevShapes = undoStack[undoStack.length - 1];
            setRedoStack([...redoStack, shapes]);
            if(prevShapes !== undefined){
                setShapes(prevShapes);
            }
            setUndoStack(undoStack.slice(0, -1));
        }
    }

    function handleRedo() {
        if (redoStack.length > 0) {
            const nextShapes = redoStack[redoStack.length - 1];
            setUndoStack([...undoStack, shapes]);
            if(nextShapes !== undefined){
                setShapes(nextShapes);
            }
            setRedoStack(redoStack.slice(0, -1));
        }
    }

    // =====================
    // UI
    // =====================
    return (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4 fixed w-full z-10">
                <div className="flex-none">
                    <DoodleMenu/>
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2">
                    <Toolbar tool={tool} setTool={setTool} />
                </div>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1800}
                height={1500}
                className="cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            />
        </div>
    );
}
