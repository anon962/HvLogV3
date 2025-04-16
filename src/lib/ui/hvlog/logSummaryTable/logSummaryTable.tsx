import { LogId } from "@/lib/logDb/logDb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { cn } from "@/lib/utils/shadcnUtils"
import { range } from "radash"
import React, { ReactNode, useEffect, useState } from "react"
import {
    ArrowLongDownIcon,
    ArrowLongUpIcon,
} from "../../icons/tailwind"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "../../shadcn/pagination"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../shadcn/select"
import { useLogContext } from "../logContext"
import { LogSummaryColumn, S_COLS } from "./cols"
import { useSummaryTableContext } from "./summaryTableContext"
import { SummaryView } from "./views"

export function LogSummaryTable(props: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
}) {
    const {
        ids,
        pageSize,
        setActiveViewId,
        pageIndex,
        setPageIndex,
        activeViewId,
        allViews,
    } = useSummaryTableContext()

    // useEffect(() => {
    //     const idx = filteredIds.findIndex((id) => id === idOverride)
    //     if (idx > -1) {
    //         setPageIndex(Math.floor(idx / pageSize))
    //     }
    // }, [filteredIds])

    if (!ids.length) {
        return <span>No battles found!</span>
    }

    return (
        <div className="log-table-container overflow-auto w-full pb-0! flex flex-col">
            <ViewPicker
                onSelect={(v) => {
                    setActiveViewId(v.id)
                    setPageIndex(0)
                }}
                current={activeViewId}
                views={allViews}
            />

            <hr className="border my-6" />

            <SummaryTable
                onClick={props.onClick}
                selectionId={props.selectionId}
            />

            <hr className="border" />

            <Paginator
                onSelect={(idx) => setPageIndex(idx)}
                total={ids.length}
                pageSize={pageSize}
                current={pageIndex}
            />
        </div>
    )
}

const SummaryTable = ({
    onClick,
    selectionId,
}: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
}) => {
    const {
        idsPaginated,
        dataPaginated,
        sortCriteria,
        setSortCriteria,
        activeView,
    } = useSummaryTableContext()

    const headerRow = activeView.colIds.map((cid) => {
        const col = S_COLS[cid]

        let icon = null as ReactNode
        let onClick = () => {}
        if (col.sort) {
            const isActive =
                col.id === sortCriteria.id &&
                sortCriteria.order !== null

            let component
            const className = ["sort-icon"]
            let nextOrder = "desc" as (typeof sortCriteria)["order"]
            if (isActive) {
                className.push("active")

                if (sortCriteria.order === "desc") {
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
                setSortCriteria({
                    id: col.id,
                    order: nextOrder,
                })
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
                        !!col.sort ? "cursor-pointer" : "",
                        flexJustify[col.align ?? "text-center"]
                    )}
                >
                    {col.header.content}
                    {icon}
                </div>
            </TableHead>
        )
    })

    const cols = activeView.colIds.map((cid) => S_COLS[cid])

    const bodyRows = idsPaginated.map((id, idx) => {
        const nextId = idsPaginated[idx + 1]

        const isSelected = id === selectionId
        const isNextSelected = nextId === selectionId

        const values = dataPaginated[idx]

        return (
            <LogRow
                key={id}
                logId={id}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={onClick}
                values={values}
                cols={cols}
            />
        )
    })

    const headerSelected =
        selectionId === idsPaginated[0] ? "selected-next" : ""

    return (
        <Table className="log-table w-auto min-h-0 mb-8 mx-auto">
            <TableHeader>
                <TableRow className={cn(headerSelected)}>
                    {...headerRow}
                </TableRow>
            </TableHeader>
            <TableBody>{...bodyRows}</TableBody>
        </Table>
    )
}

const LogRow = React.memo(
    (props: {
        values: any[]
        cols: LogSummaryColumn[]
        logId: LogId
        isSelected: boolean
        isNextSelected: boolean
        onClick?: (logId: LogId) => void
    }) => {
        // prettier-ignore
        const selectedClass = 
            props.isSelected ? " selected" :
            props.isNextSelected ? " selected-next" :
            ""

        const cells = props.values.map((value, idx) => {
            const col = props.cols[idx]
            const cell = col.cell({ logId: props.logId, value })
            return (
                <LogCell
                    key={idx}
                    className={cn(col.align, cell.className)}
                    title={cell.title}
                    content={cell.content}
                />
            )
        })

        const [enter, setEnter] = useState(0)
        const [exit, setExit] = useState(0)
        const [needsPrefetch, setNeedsPrefetch] = useState(false)
        const { useLogFetch } = useLogContext()
        useLogFetch(needsPrefetch ? [props.logId] : [])
        useEffect(() => setNeedsPrefetch(enter - exit > 100))

        return (
            <TableRow
                key={props.logId}
                className={"py-2" + selectedClass}
                data-id={props.logId}
                onClick={() => props.onClick?.(props.logId)}
                onMouseEnter={() => setEnter(new Date().getTime())}
                onMouseLeave={() => setExit(new Date().getTime())}
            >
                {...cells}
            </TableRow>
        )
    }
)

const LogCell = React.memo(
    ({
        className,
        title,
        content,
    }: {
        className: string
        title?: string
        content: ReactNode
    }) => (
        <TableCell className={cn(className)} title={title}>
            {content}
        </TableCell>
    )
)

const ViewPicker = React.memo(
    ({
        views,
        current,
        onSelect,
    }: {
        views: SummaryView[]
        current: string
        onSelect: (view: SummaryView) => void
    }) => {
        const items = views.map((v) => {
            return (
                <SelectItem
                    key={v.id}
                    value={v.id}
                    className="cursor-pointer text-xs"
                >
                    {v.label}
                </SelectItem>
            )
        })

        return (
            <div className="flex items-center justify-end">
                <span className="pr-2 text-sm font-medium">
                    Filter:
                </span>

                <Select
                    onValueChange={(id) =>
                        onSelect(views.find((v) => v.id === id)!)
                    }
                    value={current}
                >
                    <SelectTrigger className="w-[180px] text-xs cursor-pointer">
                        <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>{...items}</SelectContent>
                </Select>
            </div>
        )
    }
)

const Paginator = React.memo(
    ({
        current,
        onSelect,
        total,
        pageSize,
    }: {
        current: number
        onSelect: (idx: number) => void
        total: number
        pageSize: number
    }) => {
        const numPages = Math.ceil(total / pageSize) || 1

        const width = 1

        const pages: Array<number | null> = []

        // First page
        if (current - width > 0) {
            pages.push(0)
        }
        // First page ellipsis
        if (current - width > 1) {
            pages.push(null)
        }

        // Current page and near-current-page
        for (const idx of range(current - width, current + width)) {
            if (idx < 0 || idx >= numPages) {
                continue
            }
            pages.push(idx)
        }

        // Last page ellipsis
        const lastPage = numPages - 1
        if (current + width < lastPage - 1) {
            pages.push(null)
        }
        // Last page
        if (current + width < lastPage) {
            pages.push(lastPage)
        }

        const pageEls = pages.map((idx, j) =>
            idx === null ? (
                <PaginationItem key={j}>
                    <PaginationEllipsis />
                </PaginationItem>
            ) : (
                <PaginationItem
                    key={j}
                    onClick={() => onSelect(idx)}
                    className="cursor-pointer"
                >
                    <PaginationLink isActive={idx === current}>
                        {idx + 1}
                    </PaginationLink>
                </PaginationItem>
            )
        )

        const disablePrev = current === 0
        const disableNext = current === lastPage

        return (
            <Pagination className="p-4">
                <PaginationContent>
                    <PaginationItem
                        onClick={() => onSelect(current - 1)}
                        className={
                            disablePrev
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationPrevious />
                    </PaginationItem>

                    {...pageEls}

                    <PaginationItem
                        onClick={() => onSelect(current + 1)}
                        className={
                            disableNext
                                ? "opacity-50 pointer-events-none"
                                : cn("cursor-pointer")
                        }
                    >
                        <PaginationNext />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        )
    }
)
