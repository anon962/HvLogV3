import {
    ChevronFirstIcon,
    ChevronLastIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MoreHorizontalIcon,
} from "lucide-react"
import * as React from "react"

import { Button, buttonVariants } from "@/lib/ui/shadcn/button"
import { cn } from "myutils"
import { RouteLink } from "../hvlog/router"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
    return (
        <nav
            role="navigation"
            aria-label="pagination"
            data-slot="pagination"
            className={cn("mx-auto flex w-full justify-center", className)}
            {...props}
        />
    )
}

function PaginationContent({
    className,
    ...props
}: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="pagination-content"
            className={cn("flex flex-row items-center gap-1", className)}
            {...props}
        />
    )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
    return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
    isActive?: boolean
    href: null | string
    ignorePrefix?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
    Omit<React.ComponentProps<"a">, "href">

function PaginationLink({
    className,
    isActive,
    ignorePrefix,
    size = "icon",
    ...props
}: PaginationLinkProps) {
    const propsResolved = {
        "aria-current": isActive ? "page" : undefined,
        "data-slot": "pagination-link",
        "data-active": isActive,
        className: cn(
            buttonVariants({
                variant: isActive ? "outline" : "ghost",
                size,
            }),
            isActive ? "active" : null,
            className,
        ),
        ...props,
    } as any

    return props.href ? (
        <RouteLink {...propsResolved} ignorePrefix={ignorePrefix ?? true} />
    ) : (
        <button {...propsResolved}> {props.children} </button>
    )
}

function PaginationPrevious({
    className,
    ...props
}: React.ComponentProps<typeof PaginationLink>) {
    return (
        <PaginationLink
            aria-label="Go to previous page"
            size="default"
            className={cn("previous gap-1 px-2.5 sm:pl-2.5", className)}
            {...props}
        >
            <ChevronLeftIcon />
            <span className="hidden sm:block">{/* Previous */}</span>
        </PaginationLink>
    )
}

function PaginationNext({
    className,
    ...props
}: React.ComponentProps<typeof PaginationLink>) {
    return (
        <PaginationLink
            aria-label="Go to next page"
            size="default"
            className={cn("next gap-1 px-2.5 sm:pr-2.5", className)}
            {...props}
        >
            <span className="hidden sm:block">{/* Next */}</span>
            <ChevronRightIcon />
        </PaginationLink>
    )
}

function PaginationEllipsis({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            aria-hidden
            data-slot="pagination-ellipsis"
            className={cn("flex size-9 items-center justify-center", className)}
            {...props}
        >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">More pages</span>
        </span>
    )
}

function PaginationFirst({
    className,
    ...props
}: React.ComponentProps<typeof PaginationLink>) {
    return (
        <PaginationLink
            size="default"
            className={cn("first gap-1 px-2.5 sm:pl-2.5", className)}
            {...props}
        >
            <ChevronFirstIcon />
            {/* <span className="hidden sm:block">First</span> */}
        </PaginationLink>
    )
}

function PaginationLast({
    className,
    ...props
}: React.ComponentProps<typeof PaginationLink>) {
    return (
        <PaginationLink
            size="default"
            className={cn("last gap-1 px-2.5 sm:pr-2.5", className)}
            {...props}
        >
            {/* <span className="hidden sm:block">Last</span> */}
            <ChevronLastIcon />
        </PaginationLink>
    )
}

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationFirst,
    PaginationItem,
    PaginationLast,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
}
