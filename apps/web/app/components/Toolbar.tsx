import { Dock } from "./Dock"
import {
    Square,
    Circle,
    MoveUpRight,
    Slash,
    Eraser,
    Pen,
    MousePointer2
} from "lucide-react"

interface ToolbarProps{
    tool: string;
    setTool: (t:string)=>void;
}


function Toolbar({tool,setTool}:ToolbarProps) {
    const items = [
        { icon: MousePointer2, label: "select", onClick: () => setTool("select") },
        { icon: Square, label: "rectangle", onClick: () => setTool("rect") },
        { icon: Circle, label: "circle", onClick: () => setTool("circle") },
        { icon: MoveUpRight, label: "arrow", onClick: () => setTool("arrow") },
        { icon: Slash, label: "line", onClick: () => setTool("line") },
        { icon: Pen, label: "pen", onClick: () => setTool("pen") },
        { icon: Eraser, label: "eraser", onClick: () => setTool("eraser") },
    ]

    return <Dock items={items} />
}

export { Toolbar } 