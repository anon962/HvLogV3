import * as lucide from "lucide-react"
import React, { useState, useEffect } from "react"
import { cn } from "../utils/shadcnUtils"
import { CommonProps } from "../utils/miscUtils"

export function Loader(props: { show: boolean; delay?: number } & CommonProps) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        if (!props.show) {
            setShow(false)
            return
        }

        if (props.delay) {
            const timeout = setTimeout(() => setShow(true), props.delay)
            return () => clearTimeout(timeout)
        } else {
            setShow(true)
        }
    }, [props.show, props.delay])

    return (
        <lucide.LoaderCircle
            className={cn(
                show ? "" : "invisible pointer-none:",
                "animate-spin text-blue-500 size-6",
                props.className,
            )}
        />
    )
}
