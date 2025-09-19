"use client"


import React, { useRef, useState, useEffect } from "react";

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

// =====================
// COMPONENT
// =====================
export default function CanvasBoard() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [tool, setTool] = useState<Tool>("rect");
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [drawing, setDrawing] = useState<Shape | SelectShape | null>(null);
    const [selectedShapes, setSelectedShapes] = useState<number[]>([]);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [undoStack, setUndoStack] = useState<Shape[][]>([]);
    const [redoStack, setRedoStack] = useState<Shape[][]>([]);

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
    }, [shapes, drawing, selectedShapes, selectionBox]);

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
        if (!drawing) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

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
            setShapes((prev) => [...prev, { ...drawing, x: currX, y: currY }]);
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
                const newShapes = [...prev, drawing as Shape];
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
            setShapes(prevShapes ?? []);
            setUndoStack(undoStack.slice(0, -1));
        }
    }

    function handleRedo() {
        if (redoStack.length > 0) {
            const nextShapes = redoStack[redoStack.length - 1];
            setUndoStack([...undoStack, shapes]);
            setShapes(nextShapes ?? []);
            setRedoStack(redoStack.slice(0, -1));
        }
    }

    // =====================
    // UI
    // =====================
    return (
        <div className="flex flex-col items-center p-4">
            {/* Toolbar */}
            <div className="flex gap-2 mb-4">
                {["rect", "circle", "line", "arrow", "pen", "eraser", "select"].map(
                    (t) => (
                        <button
                            key={t}
                            onClick={() => setTool(t as Tool)}
                            className={`px-3 py-1 rounded ${tool === t ? "bg-blue-500 text-white" : "bg-gray-200"
                                }`}
                        >
                            {t}
                        </button>
                    )
                )}
                {/* Undo / Redo buttons */}
                <button
                    onClick={handleUndo}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                >
                    Undo
                </button>
                <button
                    onClick={handleRedo}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                >
                    Redo
                </button>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1800}
                height={1500}
                className="border border-gray-400"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            />
        </div>
    );
}
