import { ComponentPropsWithoutRef, ReactNode } from "react"
import { Button } from "./shadcn/button"
import { mergeProps } from "myutils"

export function IconButton(
    props: { children: ReactNode } & ComponentPropsWithoutRef<"button">,
) {
    const { children, ...rest } = props
    return (
        <Button
            {...mergeProps(
                {
                    className: "icon-button",
                    variant: "ghost",
                    size: "sm",
                },
                rest,
            )}
        >
            {children}
        </Button>
    )
}
