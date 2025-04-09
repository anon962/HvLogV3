import { LogId } from "@/lib/logDb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { cn } from "@/lib/utils/shadcnUtils"
import React, { ReactNode, useEffect, useMemo, useState } from "react"
import { LogSummaryColumn, S_COLS } from "./cols"

export function LogSummaryTable(props: {
    onClick?: (logId: LogId) => void

    selectionIdx: number
    logs: LogId[]
}) {
    const cols = useMemo(() => Object.values(S_COLS), [])

    const now = useNow()

    const headerRow = cols.map((col) => (
        <TableHead className={cn(col.align, col.header.className)}>
            {col.header.content}
        </TableHead>
    ))

    const bodyRows = props.logs.map((id, idx) => {
        const isSelected = idx === props.selectionIdx
        const isNextSelected = idx === props.selectionIdx - 1

        return (
            <LogRow
                key={id}
                logId={id}
                now={now}
                idx={idx}
                isSelected={isSelected}
                isNextSelected={isNextSelected}
                onClick={props.onClick}
                cols={cols}
            />
        )
    })

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
        logId: LogId
        now: Date
        idx: number
        isSelected: boolean
        isNextSelected: boolean
        onClick?: (logId: LogId) => void
    }) => {
        // prettier-ignore
        const selectedClass = 
            props.isSelected ? " selected" :
            props.isNextSelected ? " selected-next" :
            ""

        const cells = props.cols.map((col, idx) => {
            const cell = col.cell({
                logId: props.logId,
                now: props.now,
            })
            return (
                <LogCell
                    key={idx}
                    className={cn(col.align, cell.className)}
                    title={cell.title}
                    content={cell.content}
                />
            )
        })

        return (
            <TableRow
                key={props.logId}
                className={"py-2" + selectedClass}
                data-id={props.logId}
                onClick={() => props.onClick?.(props.logId)}
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
