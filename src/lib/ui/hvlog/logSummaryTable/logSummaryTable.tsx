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
import { mapEntries } from "radash"
import React, { ReactNode, useEffect, useMemo, useState } from "react"
import {
    ArrowLongDownIcon,
    ArrowLongUpIcon,
} from "../../icons/tailwind"
import { useLogContext } from "../logContext"
import { LogSummaryColumn, S_COLS } from "./cols"

export function LogSummaryTable(props: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
    logIds: LogId[]
}) {
    const colIds = useMemo(() => [...Object.keys(S_COLS)], [])

    const [sortCriteria, setSortCriteria] = useState({
        colId: "date",
        order: null as "asc" | "desc" | null,
    })

    const defaultSortCriteria: typeof sortCriteria = useMemo(
        () =>
            colIds.includes("date")
                ? {
                      colId: "date",
                      order: "desc",
                  }
                : {
                      colId: colIds[0],
                      order: "desc",
                  },
        [colIds]
    )

    const headerRow = colIds.map((cid) => {
        const col = S_COLS[cid]

        let icon = null as ReactNode
        let onClick = () => {}
        if (col.sort) {
            const isActive =
                col.id === sortCriteria.colId &&
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
                    colId: col.id,
                    order: nextOrder,
                })
        }

        return (
            <TableHead
                className={cn(col.align, col.header.className)}
            >
                <div
                    onClick={onClick}
                    className="flex items-center cursor-pointer"
                >
                    {col.header.content}
                    {icon}
                </div>
            </TableHead>
        )
    })

    const colData = mapEntries(S_COLS, (cid, col) => {
        // const d = useMemo(() => {
        //     const isEnabled = !!colIds.find((id) => id === cid)
        //     return col.preprocess(isEnabled ? props.logIds : [])
        // }, [props.logIds, colIds])
        const isEnabled = !!colIds.find((id) => id === cid)
        const d = col.preprocess(isEnabled ? props.logIds : [])
        return [cid, d]
    })

    // Sort by user choice
    // Otherwise select default (by date or first column)
    const sortedIndexes = useMemo(() => {
        let result = indexes(props.logIds)

        const col = S_COLS[sortCriteria.colId]
        const crit =
            sortCriteria.order !== null
                ? sortCriteria
                : defaultSortCriteria

        if (col?.sort) {
            const sortData = colData[crit.colId]
            result = col?.sort(sortData)

            if (crit.order === "desc") {
                result.reverse()
            }
        }

        return result
    }, [sortCriteria, props.logIds])

    const cols = colIds.map((cid) => S_COLS[cid])

    const bodyRows = sortedIndexes.map((sortIdx, idx) => {
        const currentId = props.logIds[sortIdx]

        const nextSortIdx = sortedIndexes[idx + 1]
        const nextId = props.logIds[nextSortIdx]

        const isSelected = currentId === props.selectionId
        const isNextSelected = nextId === props.selectionId

        const values = colIds.map((cid) => colData[cid][sortIdx])

        return (
            <LogRow
                key={currentId}
                logId={currentId}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={props.onClick}
                values={values}
                cols={cols}
            />
        )
    })

    const headerSelected =
        props.selectionId === props.logIds[sortedIndexes[0]]
            ? " selected-next"
            : ""

    return (
        <div className="log-table-container overflow-auto pb-0!">
            <Table className="log-table w-auto min-h-0 mb-8">
                <TableHeader>
                    <TableRow className={cn(headerSelected)}>
                        {...headerRow}
                    </TableRow>
                </TableHeader>
                <TableBody>{...bodyRows}</TableBody>
            </Table>
        </div>
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
        <TableCell className={className} title={title}>
            {content}
        </TableCell>
    )
)
