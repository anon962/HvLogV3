import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { CommonProps } from "@/lib/utils/miscUtils"
import { clamp, cn, L, range, ReactMemo, sort } from "myutils"
import React, {
    ReactNode,
    RefObject,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { RouteLink } from "./hvlog/router"
import { ArrowLongDownIcon, ArrowLongUpIcon } from "./icons/tailwind"
import { Loader } from "./loader"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./shadcn/tooltip"

export namespace ListTableN {
    export interface Column<TValue = unknown, TImpureValue = null> {
        id: string
        align?: "text-left" | "text-right" | "text-center"
        header: {
            content: ReactNode
            className?: string
            tooltip?: ReactNode
        }
        // cell() should be pure, hooks go in preprocess
        cell: (
            x: TValue,
            y: TImpureValue | null,
        ) => {
            content: ReactNode
            className?: string
            title?: string
        }
        // generates the y arg for each cell() in this col
        preprocess?: (xs: Array<TValue>) => Array<TImpureValue>
        sort?: (xs: Array<TValue>) => Array<TValue>
    }

    export interface SortCriteria {
        cid: Column["id"]
        order: "asc" | "desc"
    }
}

export function ListTable<T>(
    props: {
        data: Array<T>
        cols: Array<ListTableN.Column<T, any>>
        sortCriteria: ListTableN.SortCriteria | null
        setSortCriteria: (crit: ListTableN.SortCriteria | null) => void
        selectedId?: string
        setSelectedId?: (id: string) => void
        getId: (d: T) => string
        sortCols?: Set<string>
        count: number
        onHover?: {
            delay: number
            fn: (d: T) => void
        }
        pageSize: number
        setPageSize: {
            options: number[]
            handler: (x: number) => void
        }
        pageIndex: number
        setPageIndex?: (pg: number) => void
        pageUrl?: (pageIdx: number) => Record<string, string | null>
        rowUrl?: (d: T) => string
        isLoading?: boolean
        filter?: {
            trigger: ReactNode
            content: ReactNode
            active: boolean
        }
        tableProps?: CommonProps
    } & CommonProps,
) {
    const [showFilter, setShowFilter] = useState(false)

    const { data, className, style, ...rest } = props

    const data2 = useDeferredValue(data)

    return (
        <div
            className={cn(
                "list-table-container w-full pb-0! flex flex-col",
                className,
            )}
            style={style}
        >
            <Paginator
                {...props}
                allowFilter={true}
                showFilter={showFilter}
                setShowFilter={() => setShowFilter(!showFilter)}
            />

            {showFilter && props.filter?.content ? (
                <div className="mx-auto p-4 pt-0 filter-body">
                    {props.filter.content}
                </div>
            ) : (
                <div className="h-0"></div>
            )}

            <hr className="border my-2!" />

            <TableInner data={data2} {...rest} {...props.tableProps} />

            <hr className="border my-2!" />

            <Paginator {...rest} />
        </div>
    )
}

const TableInner = <T,>(
    props: {
        data: Array<T>
        cols: Array<ListTableN.Column<T, any>>
        sortCriteria: ListTableN.SortCriteria | null
        setSortCriteria: (crit: ListTableN.SortCriteria | null) => void
        selectedId?: string
        setSelectedId?: (id: string) => void
        getId: (d: T) => string
        rowUrl?: (d: T) => string
        sortCols?: Set<string>
        onHover?: {
            delay: number
            fn: (d: T) => void
        }
    } & CommonProps,
) => {
    const headerRow = useMemo(() => {
        return props.cols.map((col) => {
            let icon: ReactNode = null
            let onClick = () => {}
            if (props.sortCols?.has(col.id)) {
                const isActive =
                    col.id === props.sortCriteria?.cid &&
                    props.sortCriteria?.order !== null

                let component
                const className = ["sort-icon"]
                let nextOrder: ListTableN.SortCriteria["order"] | null = "desc"
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
            const flexAlign = {
                "text-center": "items-center",
                "text-left": "items-start",
                "text-right": "items-end",
            }

            return (
                <TableHead
                    key={"col" + col.id}
                    className={cn(col.header.className)}
                >
                    <TooltipProvider>
                        <Tooltip open={col.header.tooltip ? undefined : false}>
                            <TooltipTrigger
                                style={{ textAlign: "inherit" }}
                                className="w-full"
                            >
                                <div
                                    onClick={onClick}
                                    className={cn(
                                        "flex items-center",
                                        props.sortCols?.has(col.id)
                                            ? "cursor-pointer"
                                            : "",
                                        flexJustify[col.align ?? "text-center"],
                                        // flexAlign[col.align ?? "text-center"],
                                        col.header.tooltip
                                            ? "tooltip pb-[0.2em]"
                                            : "",
                                        `col-${col.id}`,
                                    )}
                                >
                                    <span className="font-bold text-muted-foreground">
                                        {col.header.content}
                                    </span>
                                    {icon}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {col.header.tooltip}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableHead>
            )
        })
    }, [props.cols, props.sortCols, props.sortCriteria])

    const [extras, setExtras] = useState<any[]>(props.cols.map(() => null))
    const preprocs = useMemo(() => {
        return props.cols.map((col, idx) => (
            <Preprocessor
                key={col.id}
                col={col}
                data={props.data}
                setExtras={(xs) => {
                    setExtras((curr) => {
                        const next = [...curr]
                        next[idx] = xs
                        return next
                    })
                }}
            />
        ))
    }, [props.cols, props.data])

    const prefetchTimer = useRef(0)

    const bodyRows = props.data.map((d, idx) => {
        const id = props.getId(d)
        const nextId =
            idx < props.data.length - 1
                ? props.getId(props.data[idx + 1])
                : null

        const isSelected = id === props.selectedId
        const isNextSelected = nextId === props.selectedId
        const rowExtras = props.cols.map(
            (_, colIdx) => extras[colIdx][idx] ?? null,
        )

        return (
            <Row<T>
                key={id}
                d={d}
                extras={rowExtras}
                cols={props.cols}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={(d) => props.setSelectedId?.(props.getId(d))}
                getId={props.getId}
                rowUrl={props.rowUrl}
                onHover={props.onHover}
                prefetchTimer={prefetchTimer}
            />
        )
    })

    const headerSelected =
        props.data.length > 0 && props.selectedId === props.getId(props.data[0])
            ? "selected-next"
            : ""

    return (
        <Table
            className={cn(
                "list-table w-auto min-h-0 mx-auto text-[length:inherit]",
                props.className,
            )}
        >
            <TableHeader>
                <TableRow className={cn(headerSelected)}>
                    {preprocs}
                    {headerRow}
                </TableRow>
            </TableHeader>
            <TableBody>{bodyRows}</TableBody>
        </Table>
    )
}

const Row = ReactMemo(
    <T,>(props: {
        d: T
        extras: Array<any>
        cols: Array<ListTableN.Column<T, any>>
        isSelected: boolean
        isNextSelected: boolean
        prefetchTimer: RefObject<number>
        onClick?: (d: T) => void
        onHover?: {
            delay: number
            fn: (d: T) => void
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
                    className={cn(col.align, cell.className, `col-${col.id}`)}
                    title={cell.title}
                    content={cell.content}
                    href={href}
                />
            )
        })

        return (
            <TableRow
                key={id}
                className={"py-2" + selectedClass}
                data-id={id}
                onClick={() => props.onClick?.(props.d)}
                onMouseEnter={useCallback(() => {
                    if (props.onHover && props.onHover.delay > 0) {
                        clearTimeout(props.prefetchTimer.current)

                        const fn = props.onHover.fn
                        const newTimer = setTimeout(() => {
                            // L.debug("Prefetching", id, props.d)
                            fn(props.d)
                            props.prefetchTimer.current = 0
                        }, props.onHover.delay)
                        props.prefetchTimer.current = newTimer as any as number
                    }
                }, [props.onHover, props.prefetchTimer, props.d])}
                onMouseLeave={useCallback(() => {
                    if (props.prefetchTimer.current !== null) {
                        clearTimeout(props.prefetchTimer.current)
                    }
                }, [props.prefetchTimer])}
            >
                {cells}
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
            child = <div>{props.content}</div>
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
        setPageIndex?: (x: number) => void
        isLoading?: boolean
        pageUrl?: (pageIdx: number) => Record<string, string | null>
        filter?: {
            trigger: ReactNode
            content: ReactNode
            active: boolean
        }
        allowFilter?: boolean
        showFilter?: boolean
        setShowFilter?: () => void
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
                props.setPageIndex?.(idx)

                const href = getHref(idx)
                if (href) {
                    history.pushState(null, "", href)
                }
            },
            [props.setPageIndex],
        )

        const getHref = (idx: number) => {
            if (!props.pageUrl) {
                return null
            }

            const url = new URL(window.location.href)
            const params = props.pageUrl(idx)
            for (const [k, v] of Object.entries(params)) {
                if (v !== null) {
                    url.searchParams.set(k, v)
                }
            }
            return url.pathname + url.search + url.hash
        }

        const pageEls = pages.map((idx, j) => {
            return (
                <PaginationItem key={j} className="cursor-pointer">
                    <PaginationLink
                        href={getHref(idx)}
                        isActive={idx === props.pageIndex}
                        onClick={() => props.setPageIndex?.(idx)}
                    >
                        {idx + 1}
                    </PaginationLink>
                </PaginationItem>
            )
        })

        const disablePrev = props.pageIndex <= 0
        const disableNext = props.pageIndex >= pageCount - 1

        return (
            <div className="flex mx-auto items-center p-4">
                <div className="w-10 flex justify-center filter-container">
                    {props.allowFilter && props.filter?.trigger ? (
                        <button
                            className={cn("filter", {
                                active: props.showFilter,
                            })}
                            onClick={() => props.setShowFilter?.()}
                        >
                            {props.filter.trigger}

                            {props.filter.active ? (
                                <span className="absolute top-0.25 right-0.25 h-2 w-2 rounded-full bg-red-500 ring-1 ring-gray-300"></span>
                            ) : null}
                        </button>
                    ) : (
                        <></>
                    )}
                </div>

                <Pagination className="mx-0!">
                    <PaginationContent>
                        <PaginationItem
                            className={
                                disablePrev
                                    ? "opacity-50 pointer-events-none"
                                    : cn("cursor-pointer")
                            }
                        >
                            <PaginationFirst
                                href={getHref(0)}
                                onClick={() => props.setPageIndex?.(0)}
                            />
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
                                onClick={() =>
                                    props.setPageIndex?.(props.pageIndex - 1)
                                }
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
                            <PaginationNext
                                href={getHref(props.pageIndex + 1)}
                                onClick={() =>
                                    props.setPageIndex?.(props.pageIndex + 1)
                                }
                            />
                        </PaginationItem>
                        <PaginationItem
                            className={
                                disableNext
                                    ? "opacity-50 pointer-events-none"
                                    : cn("cursor-pointer")
                            }
                        >
                            <PaginationLast
                                href={getHref(pageCount - 1)}
                                onClick={() =>
                                    props.setPageIndex?.(pageCount - 1)
                                }
                            />
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
                    </div>
                </Pagination>

                <Loader show={!!props.isLoading} delay={200} className="ml-4" />
            </div>
        )
    },
)

function PageJump(props: { onJump: (idx: number) => void; pageCount: number }) {
    return (
        <div className="flex gap-2 w-max items-center text-sm">
            {/* <span className="text-xs">Jump to</span> */}
            <Input
                type="number"
                placeholder={String(props.pageCount) + " pgs"}
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

// Workaround for calling preprocess (which involve hooks) for dynamic col array
const Preprocessor = ReactMemo(
    <T, T2>(props: {
        col: ListTableN.Column<T, T2>
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
