import {
    TooltipContentProps,
    TooltipTriggerProps,
} from "@radix-ui/react-tooltip"
import { ReactNode } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./shadcn/tooltip"

export function MyTooltip(props: {
    disabled?: boolean
    contentProps?: TooltipContentProps
    triggerProps?: TooltipTriggerProps
    trigger: ReactNode
    content: ReactNode
}) {
    if (!props.disabled) {
        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger
                        {...props.triggerProps}
                        type="button"
                    >
                        {props.trigger}
                    </TooltipTrigger>
                    <TooltipContent {...props.contentProps}>
                        {props.content}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    } else {
        return props.trigger
    }
}
