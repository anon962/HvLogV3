import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { ReactMemo } from "@/lib/utils/miscUtils"
import { cn } from "@/lib/utils/shadcnUtils"
import { clamp, range, sort } from "myutils"
import React, {
    ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import { ArrowLongDownIcon, ArrowLongUpIcon } from "./icons/tailwind"
import { Input } from "./shadcn/input"
import {
    Pagination,
    PaginationContent,
    PaginationFirst,
    PaginationItem,
    PaginationLast,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "./shadcn/pagination"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./shadcn/select"
import * as lucide from "lucide-react"
import { RouteLink } from "./routeLink"

export namespace ListTable {
    export interface Column<TValue = unknown, TImpureValue = null> {
        id: string
        align?: "text-left" | "text-right" | "text-center"
        header: {
            content: string
            className?: string
        }
        preprocess?: (xs: Array<TValue>) => Array<TImpureValue>
        // cell() should be pure, hooks go in preprocess
        cell: (
            x: TValue,
            y: TImpureValue | null,
        ) => {
            content: ReactNode
            className?: string
            title?: string
        }
        sort?: (xs: Array<TValue>) => Array<TValue>
    }

    export interface SortCriteria {
        cid: Column["id"]
        order: "asc" | "desc"
    }
}

export function ListTable<T>(props: {
    data: Array<T>
    cols: Array<ListTable.Column<T, any>>
    sortCriteria: ListTable.SortCriteria | null
    setSortCriteria: (crit: ListTable.SortCriteria | null) => void
    selectedId: string
    setSelectedId: (id: string) => void
    getId: (d: T) => string
    sortCols?: Set<string>
    count: number
    onHover?: {
        delay: number
        fn: (id: string) => void
    }
    pageSize: number
    setPageSize: {
        options: number[]
        handler: (x: number) => void
    }
    pageIndex: number
    setPageIndex: (pg: number) => void
    rowUrl?: (d: T) => string
    isLoading?: boolean
    className?: {
        root?: string
    }
    pageUrl?: (pageIdx: number) => Record<string, string>
}) {
    return (
        <div
            className={cn(
                "list-table-container overflow-auto w-full pb-0! flex flex-col",
                props.className?.root,
            )}
        >
            <Paginator {...props} />

            <hr className="border my-2!" />

            <TableInner {...props} />

            <hr className="border my-2!" />

            <Paginator {...props} />
        </div>
    )
}

const TableInner = <T,>(props: {
    data: Array<T>
    cols: Array<ListTable.Column<T, any>>
    sortCriteria: ListTable.SortCriteria | null
    setSortCriteria: (crit: ListTable.SortCriteria | null) => void
    selectedId: string
    setSelectedId: (id: string) => void
    getId: (d: T) => string
    rowUrl?: (d: T) => string
    sortCols?: Set<string>
    onHover?: {
        delay: number
        fn: (id: string) => void
    }
}) => {
    const headerRow = props.cols.map((col) => {
        let icon: ReactNode = null
        let onClick = () => {}
        if (props.sortCols?.has(col.id)) {
            const isActive =
                col.id === props.sortCriteria?.cid &&
                props.sortCriteria?.order !== null

            let component
            const className = ["sort-icon"]
            let nextOrder: ListTable.SortCriteria["order"] | null = "desc"
            if (isActive) {
                className.push("active")

                if (props.sortCriteria?.order === "desc") {
                    component = ArrowLongDownIcon
                    nextOrder = "asc"
                } else {
                    component = ArrowLongUpIcon
                    nextOrder = null
                }
            } else {
                component = ArrowLongDownIcon
                nextOrder = "desc"
            }

            icon = React.createElement(component, {
                className: className.join(" "),
            })
            onClick = () =>
                props.setSortCriteria(
                    nextOrder
                        ? {
                              cid: col.id,
                              order: nextOrder,
                          }
                        : null,
                )
        }

        const flexJustify = {
            "text-center": "justify-center",
            "text-left": "justify-start",
            "text-right": "justify-end",
        }

        return (
            <TableHead className={cn(col.header.className)}>
                <div
                    onClick={onClick}
                    className={cn(
                        "flex items-center",
                        props.sortCols?.has(col.id) ? "cursor-pointer" : "",
                        flexJustify[col.align ?? "text-center"],
                    )}
                >
                    {col.header.content}
                    {icon}
                </div>
            </TableHead>
        )
    })

    const [extras, setExtras] = useState<any[]>(props.cols.map(() => null))
    const preprocs = props.cols.map((col, idx) => (
        <Preprocessor
            key={col.id}
            col={col}
            data={props.data}
            setExtras={(xs) => {
                extras[idx] = xs
                setExtras(extras)
            }}
        />
    ))

    const bodyRows = props.data.map((d, idx) => {
        const id = props.getId(d)
        const nextId =
            idx < props.data.length - 1
                ? props.getId(props.data[idx + 1])
                : null

        const isSelected = id === props.selectedId
        const isNextSelected = nextId === props.selectedId
        const rowExtras = props.cols.map((_, colIdx) => extras[colIdx][idx])

        return (
            <Row<T>
                key={id}
                d={d}
                extras={rowExtras}
                cols={props.cols}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={(d) => props.setSelectedId(props.getId(d))}
                getId={props.getId}
                rowUrl={props.rowUrl}
                onHover={props.onHover}
            />
        )
    })

    const headerSelected =
        props.data.length > 0 && props.selectedId === props.getId(props.data[0])
            ? "selected-next"
            : ""

    return (
        <Table className="list-table w-auto min-h-0 mx-auto text-[length:inherit]">
            <TableHeader>
                <TableRow className={cn(headerSelected)}>
                    {...preprocs}
                    {...headerRow}
                </TableRow>
            </TableHeader>
            <TableBody>{...bodyRows}</TableBody>
        </Table>
    )
}

const Row = ReactMemo(
    <T,>(props: {
        d: T
        extras: Array<any>
        cols: Array<ListTable.Column<T, any>>
        isSelected: boolean
        isNextSelected: boolean
        onClick?: (d: T) => void
        onHover?: {
            delay: number
            fn: (id: string) => void
        }
        getId: (d: T) => string
        rowUrl?: (d: T) => string
    }) => {
        const id = props.getId(props.d)

        // prettier-ignore
        const selectedClass = 
            props.isSelected ? " selected" :
            props.isNextSelected ? " selected-next" :
                    ""

        let href = props.rowUrl?.(props.d)

        const cells = props.cols.map((col, idx) => {
            const cell = col.cell(props.d, props.extras[idx])
            return (
                <Cell
                    key={idx}
                    className={cn(col.align, cell.className)}
                    title={cell.title}
                    content={cell.content}
                    href={href}
                />
            )
        })

        const hoverTimer = useRef(null as number | null)

        return (
            <TableRow
                key={id}
                className={"py-2" + selectedClass}
                data-id={id}
                onClick={() => props.onClick?.(props.d)}
                onMouseEnter={() => {
                    if (props.onHover) {
                        if (hoverTimer.current !== null) {
                            clearTimeout(hoverTimer.current)
                        }

                        const fn = props.onHover.fn
                        const newTimer = setTimeout(() => {
                            fn(id)
                            hoverTimer.current = null
                        }, props.onHover.delay)
                        hoverTimer.current = newTimer as any as number
                    }
                }}
                onMouseLeave={() => {
                    if (hoverTimer.current !== null) {
                        clearTimeout(hoverTimer.current)
                    }
                }}
            >
                {...cells}
            </TableRow>
        )
    },
)
const Cell = ReactMemo(
    (props: {
        className: string
        title?: string
        content: ReactNode
        href?: string
    }) => {
        let child
        if (props.href) {
            child = <RouteLink href={props.href}>{props.content}</RouteLink>
        } else {
            child = <span>{props.content}</span>
        }

        return (
            <TableCell className={props.className} title={props.title}>
                {child}
            </TableCell>
        )
    },
)

const Paginator = React.memo(
    (props: {
        count: number
        pageSize: number
        setPageSize: {
            options: number[]
            handler: (x: number) => void
        }
        pageIndex: number
        setPageIndex: (x: number) => void
        isLoading?: boolean
        pageUrl?: (pageIdx: number) => Record<string, string>
    }) => {
        const pageCount = Math.ceil(props.count / props.pageSize) || 1

        const targetCount = 5
        const edgeWidth = Math.floor(targetCount / 2)

        const pages: Array<number> = []

        if (pageCount <= targetCount) {
            pages.push(...range(0, pageCount))
        } else if (props.pageIndex < edgeWidth) {
            pages.push(...range(0, targetCount))
        } else if (props.pageIndex >= pageCount - edgeWidth) {
            pages.push(...range(pageCount - targetCount, pageCount))
        } else {
            pages.push(...range(props.pageIndex - edgeWidth, props.pageIndex))
            pages.push(props.pageIndex)
            pages.push(
                ...range(props.pageIndex + 1, props.pageIndex + edgeWidth + 1),
            )
        }

        const onSelect = useCallback(
            (idx: number) => {
                props.setPageIndex(idx)

                const href = getHref(idx)
                if (href) {
                    history.pushState(null, "", href)
                }
            },
            [props.setPageIndex],
        )

        const getHref = (idx: number) => {
            const url = new URL(window.location.href)
            const params = props.pageUrl ? props.pageUrl(idx) : {}
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v)
            }
            return url.href
        }

        const pageEls = pages.map((idx, j) => {
            return (
                <PaginationItem key={j} className="cursor-pointer">
                    <PaginationLink
                        href={getHref(idx)}
                        isActive={idx === props.pageIndex}
                    >
                        {idx + 1}
                    </PaginationLink>
                </PaginationItem>
            )
        })

        const disablePrev = props.pageIndex <= 0
        const disableNext = props.pageIndex >= pageCount - 1

        return (
            <Pagination className="p-4! pl-12!">
                <PaginationContent>
                    <PaginationItem
                        className={
                            disablePrev
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationFirst href={getHref(0)} />
                    </PaginationItem>
                    <PaginationItem
                        className={
                            disablePrev
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationPrevious
                            href={getHref(props.pageIndex - 1)}
                        />
                    </PaginationItem>

                    {...pageEls}

                    <PaginationItem
                        className={
                            disableNext
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationNext href={getHref(props.pageIndex + 1)} />
                    </PaginationItem>
                    <PaginationItem
                        className={
                            disableNext
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationLast href={getHref(pageCount - 1)} />
                    </PaginationItem>
                </PaginationContent>

                <div className="pl-6 flex items-center gap-6">
                    <PageSizeSelect
                        pageSize={props.pageSize}
                        options={props.setPageSize.options}
                        onSelect={props.setPageSize.handler}
                    />

                    <PageJump
                        onJump={(idx) => onSelect(idx)}
                        pageCount={pageCount}
                    />

                    <Loader show={!!props.isLoading} />
                </div>
            </Pagination>
        )
    },
)

function PageJump(props: { onJump: (idx: number) => void; pageCount: number }) {
    return (
        <div className="flex gap-2 w-max items-center text-sm">
            {/* <span className="text-xs">Jump to</span> */}
            <Input
                type="number"
                placeholder={String(props.pageCount)}
                className="w-[12ch]"
                min="1"
                max={props.pageCount}
                onChange={(ev) => {
                    const value = parseInt(ev.target.value)
                    const idx = !isNaN(value)
                        ? clamp(value - 1, 0, props.pageCount - 1)
                        : 0
                    props.onJump(idx)
                }}
            ></Input>
        </div>
    )
}

function PageSizeSelect(props: {
    pageSize: number
    options: number[]
    onSelect: (pageSize: number) => void
}) {
    const options = sort(props.options, (x) => x)

    return (
        <Select
            onValueChange={(x) => props.onSelect(parseInt(x))}
            value={String(props.pageSize)}
        >
            <SelectTrigger className="w-[12ch] text-xs cursor-pointer">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((x) => (
                    <SelectItem
                        key={x}
                        value={String(x)}
                        className="cursor-pointer text-xs"
                    >
                        {x}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function Loader(props: { show: boolean; delay?: number }) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        if (!props.show) {
            setShow(false)
            return
        }
        const timeout = setTimeout(() => setShow(true), props.delay ?? 200)
        return () => clearTimeout(timeout)
    }, [props.show, props.delay])

    return (
        <lucide.LoaderCircle
            className={cn(
                show ? "" : "invisible",
                "animate-spin text-blue-500 size-6",
            )}
        />
    )
}

// Workaround for calling preprocess (which involve hooks) for dynamic col array
const Preprocessor = ReactMemo(
    <T, T2>(props: {
        col: ListTable.Column<T, T2>
        data: Array<T>
        setExtras: (extras: Array<T2>) => void
    }) => {
        // useEffect(() => {
        if (!props.col.preprocess) {
            props.setExtras(props.data.map((d) => null as T2))
        } else {
            props.setExtras(props.col.preprocess(props.data))
        }
        // }, [props.data])

        return <></>
    },
)
