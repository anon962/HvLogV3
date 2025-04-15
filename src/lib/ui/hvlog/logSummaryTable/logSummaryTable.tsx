import { LogId } from "@/lib/logDb/logDb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { indexes } from "@/lib/utils/miscUtils"
import { cn } from "@/lib/utils/shadcnUtils"
import { readUrl } from "@/lib/utils/userscriptUtils"
import { mapEntries, range } from "radash"
import React, { ReactNode, useEffect, useMemo, useState } from "react"
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
import { useLocalJsonState } from "../hooks"
import { useLogContext } from "../logContext"
import { useStatsMaybe } from "../logStatsContext"
import { ARENA_ALIASES, LogSummaryColumn, S_COLS } from "./cols"
import {
    DEFAULT_VIEWS as DEFAULT_SUMMARY_VIEWS,
    SummaryView,
} from "./views"

// @todo: less hacky way of reading id override from url

export function LogSummaryTable(props: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
    logIds: LogId[]
}) {
    const idOverride = readUrl().params.get("id")

    const [activeViewId, setActiveViewId] = useLocalJsonState(
        DEFAULT_SUMMARY_VIEWS[0].id,
        "hvlog_summary_view",
        idOverride ? DEFAULT_SUMMARY_VIEWS[0].id : undefined
    )

    let allViews = DEFAULT_SUMMARY_VIEWS
    const { isIsekai } = readUrl()
    if (!isIsekai) {
        allViews = allViews.filter((v) => v.id !== "tower")
    }

    const view =
        allViews.find((v) => v.id === activeViewId) ?? allViews[0]

    const viewFilterMap = new Map(
        view.filters.map((f) => [f.type, f])
    )

    const { stats } = useStatsMaybe(props.logIds, { summary: true })
    const filteredIds = useMemo(() => {
        if (!view.filters.length) {
            return props.logIds
        }

        return stats.flatMap((s) => {
            const { summary } = s ?? {}
            if (!summary) {
                return []
            }

            const id = summary.id

            let filter
            switch (summary.battleType?.name) {
                case "Arena":
                    const isRob =
                        !!ARENA_ALIASES[
                            summary.battleType.id
                        ]?.startsWith("RoB")
                    filter = viewFilterMap.get(
                        isRob ? "rob" : "arena"
                    )
                    return filter ? [id] : []
                case "Grindfest":
                    filter = viewFilterMap.get("gf")
                    return filter ? [id] : []
                case "Item World":
                    filter = viewFilterMap.get("iw")
                    return filter ? [id] : []
                case "Tower":
                    filter = viewFilterMap.get("tower")
                    return filter ? [id] : []
                case "random encounter":
                    filter = viewFilterMap.get("arena")
                    return filter ? [id] : []
            }

            return []
        })
    }, [stats, view, props.logIds])

    const pageSize = 200
    const [pageIndex, setPageIndex] = useState(0)

    useEffect(() => {
        const idx = filteredIds.findIndex((id) => id === idOverride)
        if (idx > -1) {
            setPageIndex(Math.floor(idx / pageSize))
        }
    }, [filteredIds])

    const pageIds = useMemo(() => {
        const start = pageIndex * pageSize
        const end = (pageIndex + 1) * pageSize
        return filteredIds.slice(start, end)
    }, [filteredIds, pageIndex])

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
                logIds={pageIds}
                view={view}
            />

            <hr className="border" />

            <Paginator
                onSelect={(idx) => setPageIndex(idx)}
                total={filteredIds.length}
                pageSize={pageSize}
                current={pageIndex}
            />
        </div>
    )
}

const SummaryTable = ({
    onClick,
    selectionId,
    logIds,
    view,
}: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
    logIds: LogId[]
    view: SummaryView
}) => {
    const [sortCriteria, setSortCriteria] = useState({
        id: view.defaultSort.id,
        order: view.defaultSort.order as "asc" | "desc" | null,
    })

    const headerRow = view.colIds.map((cid) => {
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

    const colData = mapEntries(S_COLS, (cid, col) => {
        const isEnabled = !!view.colIds.find((id) => id === cid)
        const d = col.preprocess(isEnabled ? logIds : [])
        return [cid, d]
    })

    // Sort by user choice
    // Otherwise select default (by date or first column)
    const sortedIndexes = useMemo(() => {
        let result = indexes(logIds)

        const col = S_COLS[sortCriteria.id]
        const crit =
            sortCriteria.order !== null
                ? sortCriteria
                : view.defaultSort

        if (col?.sort) {
            const sortData = colData[crit.id]
            result = col?.sort(sortData)

            if (crit.order === "desc") {
                result.reverse()
            }
        }

        return result
    }, [sortCriteria, logIds])

    const cols = view.colIds.map((cid) => S_COLS[cid])

    const bodyRows = sortedIndexes.map((sortIdx, idx) => {
        const currentId = logIds[sortIdx]

        const nextSortIdx = sortedIndexes[idx + 1]
        const nextId = logIds[nextSortIdx]

        const isSelected = currentId === selectionId
        const isNextSelected = nextId === selectionId

        const values = view.colIds.map((cid) => colData[cid][sortIdx])

        return (
            <LogRow
                key={currentId}
                logId={currentId}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={onClick}
                values={values}
                cols={cols}
            />
        )
    })

    const headerSelected =
        selectionId === logIds[sortedIndexes[0]]
            ? "selected-next"
            : ""

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
