import { LogId } from "@/lib/logDb"
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
import { useLogContext } from "../logContext"
import { LogSummaryColumn, S_COLS } from "./cols"

export function LogSummaryTable(props: {
    onClick?: (logId: LogId) => void
    selectionId: LogId
    logIds: LogId[]
}) {
    const colIds = useMemo(() => [...Object.keys(S_COLS)], [])

    const headerRow = colIds.map((cid) => {
        const col = S_COLS[cid]
        return (
            <TableHead
                className={cn(col.align, col.header.className)}
            >
                {col.header.content}
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

    const [sortCriteria, setSortCriteria] = useState({
        colId: "date",
        order: "desc" as "desc" | "desc",
    })

    const sortOn = S_COLS[sortCriteria.colId]
    let sortOrder = indexes(props.logIds)
    if (sortOn?.sort) {
        const sortData = colData[sortCriteria.colId]
        sortOrder = sortOn?.sort(sortData)
        if (sortCriteria.order === "desc") {
            sortOrder.reverse()
        }
    }

    const cols = colIds.map((cid) => S_COLS[cid])

    const bodyRows = sortOrder.map((sortIdx, idx) => {
        const currentId = props.logIds[sortIdx]

        const nextSortIdx = sortOrder[idx + 1]
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
        props.selectionId === props.logIds[sortOrder[0]]
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
