import { CompleteLog } from "@/lib/logDb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { cn } from "@/lib/utils/shadcnUtils"
import React, { useEffect, useState } from "react"
import { LogSummaryColumn, S_COLS } from "./cols"

export function LogSummaryTable(props: {
    onClick?: (log: CompleteLog) => void

    selectionIdx: number
    logs: CompleteLog[]
    loading: boolean
}) {
    const cols = Object.values(S_COLS)

    const now = useNow()

    const headerRow = cols.map((col) => (
        <TableHead className={cn(col.align, col.header.className)}>
            {col.header.content}
        </TableHead>
    ))

    const bodyRows = props.logs.map((log, idx) => (
        <LogRow
            key={log.id}
            log={log}
            now={now}
            {...log}
            idx={idx}
            selectionIdx={props.selectionIdx}
            onClick={props.onClick}
            cols={cols}
        />
    ))

    const headerSelected =
        props.selectionIdx === 0 ? " selected-next" : ""

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
        cols: LogSummaryColumn[]
        log: CompleteLog
        now: Date
        idx: number
        selectionIdx: number
        onClick?: (log: CompleteLog) => void
    }) => {
        const isSelected = props.idx === props.selectionIdx
        const isNextSelected = props.idx === props.selectionIdx - 1
        // prettier-ignore
        const selectedClass = 
            isSelected ? " selected" :
            isNextSelected ? " selected-next" :
            ""

        const cells = props.cols.map((col, idx) => {
            const cell = col.cell(props.log, props.now)
            return (
                <TableCell
                    key={idx}
                    className={cn(col.align, cell.className)}
                    title={cell.title}
                >
                    {cell.content}
                </TableCell>
            )
        })

        return (
            <TableRow
                key={props.log.id}
                className={"py-2" + selectedClass}
                data-id={props.log.id}
                onClick={() => props.onClick?.(props.log)}
            >
                {...cells}
            </TableRow>
        )
    }
)

function useNow(refreshDelay = 3000) {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date())
        }, refreshDelay)

        return () => {
            clearInterval(timer)
        }
    }, [])

    return now
}
