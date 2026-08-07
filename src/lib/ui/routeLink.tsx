import { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react"

export function RouteLink({
    children,
    onClick,
    ...props
}: ComponentPropsWithoutRef<"a">) {
    return (
        <a onClick={onClickHijack} {...props}>
            {children}
        </a>
    )

    function onClickHijack(ev: MouseEvent<HTMLAnchorElement>) {
        onClick?.(ev)
        if (ev.defaultPrevented) return

        const isModified =
            ev.metaKey ||
            ev.ctrlKey ||
            ev.shiftKey ||
            ev.altKey ||
            ev.button !== 0

        if (!isModified && props.target !== "_blank" && props.href) {
            ev.preventDefault()
            history.pushState(null, "", props.href)
        }
    }
}
