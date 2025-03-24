import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils/shadcnUtils"
import { range } from "radash"

function ResizablePanelGroup({
    className,
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
    return (
        <ResizablePrimitive.PanelGroup
            data-slot="resizable-panel-group"
            className={cn(
                "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
                className
            )}
            {...props}
        />
    )
}

function ResizablePanel({
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
    return (
        <ResizablePrimitive.Panel
            data-slot="resizable-panel"
            {...props}
        />
    )
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: React.ComponentProps<
    typeof ResizablePrimitive.PanelResizeHandle
> & {
    withHandle?: boolean
}) {
    return (
        <ResizablePrimitive.PanelResizeHandle
            data-slot="resizable-handle"
            className={cn(
                "w-2 border border-muted-foreground/25 bg-muted-foreground/25 focus-visible:ring-ring relative flex items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
                className
            )}
            {...props}
        >
            {withHandle && (
                <div
                    className="bg-muted-foreground/75 z-10 grid items-center justify-center rounded-xs border"
                    style={{
                        gridTemplateColumns: "1fr 1fr",
                        backgroundColor: `color-mix(
                            in oklab,
                            var(--muted-foreground) 75%,
                            var(--muted)
                        )`,
                        gap: "0.2rem",
                        padding: "0.3rem 0.2rem",
                    }}
                >
                    {range(5).map((_) => (
                        <div className="size-0.75 rounded-full bg-foreground/80"></div>
                    ))}
                </div>
            )}
        </ResizablePrimitive.PanelResizeHandle>
    )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
