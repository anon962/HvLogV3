import { enumerate, formatNumber } from "@/lib/utils/miscUtils"
import { ReactElement, useState } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../shadcn/tooltip"

export interface TallyTableProps<TItem = any, TSubItem = any> {
    label: string
    categoryLabel?: string
    rows: TallyTableRow<TItem, TSubItem>[]
    columns: TallyTableColumn<TItem>[]
    subColumns?: TallyTableSubColumn<TSubItem>[]
    className?: string
    hideTotal?: boolean
}

export interface TallyTableColumn<TItem = any> {
    label: string
    tooltip?: ReactElement | string
    get: (x: TItem) => number
    format?: (x: number) => string
}

export interface TallyTableRow<TItem = any, TSubItem = any> {
    label: string
    value: TItem
    subValues?: TSubItem[]
    selectable?: boolean
    disabled?: boolean
}

export interface TallyTableSubColumn<
    TSubItem = any,
    TValue extends number | string = number | string
> {
    label: string
    get: (x: TSubItem) => TValue
    format?: (x: TValue) => string
    align?: "left" | "right"
}

export function TallyTable({
    label,
    categoryLabel,
    rows,
    columns,
    subColumns,
    className,
    hideTotal,
}: TallyTableProps) {
    // Handle row selection
    const [active, setActive] = useState(new Set<number>())
    const toggleActive = (idx: number) => {
        let update = new Set(active)
        if (update.has(idx)) {
            update.delete(idx)
        } else {
            update.add(idx)
        }
        setActive(update)
    }

    // useEffect(() => {
    //     setActive(new Set())
    // }, rows)

    // CSS
    const sectionClasses = `tally-table ${className ?? ""}`
    const titleClasses = `pb-4`
    const titleRowClasses = `row ${
        active.has(0) ? "next-active" : ""
    }`
    const layoutClasses = `min-w-min rounded-md`

    // Headers
    const columnHeaderEls = columns.map((col) => {
        const className = `header text-right ${
            col.tooltip ? "tooltip" : ""
        }`

        return (
            <span className={className}>
                {col.tooltip ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger
                                style={{ textAlign: "inherit" }}
                            >
                                {col.label}
                            </TooltipTrigger>
                            <TooltipContent>
                                {col.tooltip}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    col.label
                )}
            </span>
        )
    })

    // Rows
    const { rowEls, totals } = rows.reduce(
        (acc, row, idx) => {
            const rowClass = `${
                idx === rows.length - 1 ? "before-total" : ""
            }`

            acc.rowEls.push(
                <Row
                    className={rowClass}
                    onClick={() => toggleActive(idx)}
                    row={row}
                    columns={columns}
                    subColumns={subColumns ?? []}
                    isActive={active.has(idx)}
                    isNextActive={active.has(idx + 1)}
                />
            )

            for (const [colIdx, col] of enumerate(columns)) {
                acc.totals[colIdx] += col.get(row.value)
            }

            return acc
        },
        {
            rowEls: [] as ReactElement[],
            totals: columns.map((col) => 0),
        }
    )

    const gridCss = {
        gridTemplateColumns: `minmax(125px, 1fr) repeat(${columns.length}, minmax(min-content, 1fr))`,
    }

    // Column totals
    let totalRow: ReactElement | null = null
    if (!hideTotal) {
        const totalEls = totals.map((x, idx) => {
            let label
            if (columns[idx].format) {
                label = columns[idx].format(x)
            } else if (x >= 1000) {
                label = formatNumber(x)
            } else if (x < 1) {
                label = Math.trunc(x * 100) / 100
            } else {
                label = Math.trunc(x * 10) / 10
            }

            return (
                <span className="count footer text-right">
                    {label}
                </span>
            )
        })

        totalRow = (
            <div className="row" style={gridCss}>
                <span className="category footer">Total</span>
                {...totalEls}
            </div>
        )
    }

    return (
        <section className={sectionClasses}>
            <h1 className={titleClasses}>{label}</h1>

            <div className={layoutClasses}>
                <div className={titleRowClasses} style={gridCss}>
                    <span className="category header">
                        {categoryLabel ?? "Category"}
                    </span>
                    {...columnHeaderEls}
                </div>

                {...rowEls}
            </div>

            {totalRow}
        </section>
    )
}

interface RowProps<TItem = any, TSubItem = any> {
    onClick: () => void

    row: TallyTableRow
    columns: TallyTableColumn<TItem>[]
    subColumns: TallyTableSubColumn<TSubItem>[]

    isActive: boolean
    isNextActive: boolean
    className: string
}

function Row({
    onClick,
    row,
    columns,
    subColumns,
    isActive,
    isNextActive,
    className,
}: RowProps) {
    const hasSubtable = !!row.subValues?.length

    const rowClass = [
        "row",
        className ? className : "",
        isActive ? "active" : "",
        isNextActive ? "next-active" : "",
        row.selectable ? "selectable" : "",
        row.disabled ? "disabled" : "",
    ].join(" ")

    let subTable
    if (isActive && row.subValues) {
        subTable = (
            <SubTable
                subValues={row.subValues}
                subColumns={subColumns}
                span={columns.length + 1}
            />
        )
    }

    const cells = columns.map((col) => {
        const value = col.get(row.value)

        let valueStr
        if (col.format) {
            valueStr = col.format?.(value)
        } else if (value >= 1000) {
            valueStr = formatNumber(value)
        } else {
            valueStr = String(value)
        }

        return <div className="cell">{valueStr}</div>
    })

    return (
        <div
            onClick={() => (hasSubtable ? onClick() : "")}
            className={rowClass}
            style={{
                gridTemplateColumns: `minmax(125px, 1fr) repeat(${columns.length}, minmax(min-content, 1fr))`,
            }}
        >
            <span className="category cell">{row.label}</span>

            {...cells}

            {subTable}
        </div>
    )
}

interface SubRowProps<TSubItem = any> {
    subValues: TSubItem[]
    subColumns: TallyTableSubColumn<TSubItem>[]
    span: number
}

function SubTable({ subValues, subColumns, span }: SubRowProps) {
    const alignClass = subColumns.map((col) =>
        col.align === "left" ? "text-left" : "text-right"
    )

    const headers = subColumns.map((subCol, idx) => {
        const cls = `subheader ${alignClass[idx]}`
        return <div className={cls}>{subCol.label}</div>
    })

    const cells = subValues.flatMap((subValue) =>
        subColumns.map((subCol, idx) => {
            const value = subCol.get(subValue)

            let valueStr
            if (subCol.format) {
                valueStr = subCol.format(value)
            } else if (typeof value === "number" && value >= 1000) {
                valueStr = formatNumber(value)
            } else {
                valueStr = String(value)
            }

            const cls = `subcell ${alignClass[idx]}`

            return <div className={cls}>{valueStr}</div>
        })
    )

    return (
        <div
            className="subtable"
            style={{
                gridColumn: `auto / span ${span}`,
                gridTemplateColumns: `repeat(${span}, max-content)`,
            }}
        >
            {...headers}

            {...cells}
        </div>
    )
}
