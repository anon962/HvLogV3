import { formatNumber } from "@/lib/utils/miscUtils"
import { enumerate } from "myutils"
import {
    CSSProperties,
    Fragment,
    ReactElement,
    ReactNode,
    useState,
} from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./shadcn/tooltip"
import { range, zip } from "myutils"

export interface TallyTableProps<TItem = any, TSubItem = any> {
    label: string
    categoryLabel?: string
    rows: Array<TallyTableRow<TItem, TSubItem>>
    columns: Array<TallyTableColumn<TItem>>
    subColumns?: Array<TallyTableSubColumn<TSubItem>>
    className?: string
    hideTotal?: boolean
    rowStyle?: CSSProperties
}

export interface TallyTableColumn<TItem = any> {
    label: string
    tooltip?: ReactNode
    get: (x: TItem) => number
    format?: (value: number, x: TItem) => string
    formatTotal?: (value: number) => string
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
    TValue extends number | string = number | string,
> {
    label: string
    get: (x: TSubItem) => TValue
    format?: (x: TValue) => string
    align?: "left" | "right"
    tooltip?: ReactElement | string
    smol?: boolean
}

export function TallyTable({
    label,
    categoryLabel,
    rows,
    columns,
    subColumns,
    className,
    hideTotal,
    rowStyle,
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
    const titleRowClasses = `row ${active.has(0) ? "next-active" : ""}`
    const layoutClasses = `min-w-min rounded-md`

    // Col widths
    const colWidths = range(columns.length + 1).map(() => 0)
    const setColWidth = (idx: number, charLength: number) => {
        colWidths[idx] = Math.max(charLength, colWidths[idx])
    }
    setColWidth(0, (categoryLabel ?? "Category").length)

    // Headers
    const columnHeaderEls = columns.map((col, idx) => {
        const className = `header text-right ${col.tooltip ? "tooltip" : ""}`

        const { labelEl, maxWidth } = formatLabel(col.label)

        setColWidth(idx + 1, maxWidth)

        return (
            <span key={idx} className={className}>
                {col.tooltip ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger style={{ textAlign: "inherit" }}>
                                {labelEl}
                            </TooltipTrigger>
                            <TooltipContent>{col.tooltip}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    labelEl
                )}
            </span>
        )
    })

    const cells: string[][] = []
    for (const row of rows) {
        setColWidth(0, row.label.length)

        const cs = []
        for (let idx = 0; idx < columns.length; idx++) {
            const col = columns[idx]
            const value = col.get(row.value)

            let valueStr
            if (col.format) {
                valueStr = col.format?.(value, row.value)
            } else if (value >= 1_000_000_000) {
                valueStr = (value / 1_000_000_000).toFixed(1) + "b"
            } else if (value >= 1_000_000) {
                valueStr = (value / 1_000_000).toFixed(1) + "m"
            } else if (value >= 1000) {
                valueStr = formatNumber(value)
            } else {
                valueStr = Number.isInteger(value)
                    ? value.toFixed(0)
                    : value.toFixed(1)
            }

            cs.push(valueStr)
            setColWidth(idx + 1, valueStr.length)
        }
        cells.push(cs)
    }

    const colStyles = []
    for (const w of colWidths) {
        colStyles.push(`minmax(${(w * 1.0).toFixed(1)}ch, 1fr)`)
        // colStyles.push(`${(w * 1.0).toFixed(1)}ch`)
    }
    const gridStyles = {
        gridTemplateColumns: `${colStyles.join(" ")}`,
    }

    // Rows
    const { rowEls, totals } = zip(rows, cells).reduce(
        (acc, [row, cs], idx) => {
            acc.rowEls.push(
                <Row
                    key={idx}
                    onClick={() => toggleActive(idx)}
                    cells={cs}
                    row={row}
                    columns={columns}
                    subColumns={subColumns ?? []}
                    isActive={active.has(idx)}
                    isNextActive={active.has(idx + 1)}
                    style={{ ...gridStyles, ...rowStyle }}
                />,
            )

            for (const [colIdx, col] of enumerate(columns)) {
                acc.totals[colIdx] += col.get(row.value)
            }

            return acc
        },
        {
            rowEls: [] as ReactElement[],
            totals: columns.map((col) => 0),
        },
    )

    // @todo: to util function + more config options
    // Column totals
    let totalRow: ReactElement | null = null
    if (!hideTotal) {
        const totalEls = totals.map((x, idx) => {
            let label
            if (columns[idx].formatTotal) {
                label = columns[idx].formatTotal(x)
            } else if (x >= 1_000_000_000) {
                label = (x / 1_000_000_000).toFixed(1) + "b"
            } else if (x >= 1_000_000) {
                label = (x / 1_000_000).toFixed(1) + "m"
            } else if (x >= 1000) {
                label = formatNumber(x)
            } else if (x < 1) {
                label = x.toFixed(2)
            } else {
                label = formatNumber(x)
            }

            return (
                <span key={idx} className="count footer text-right">
                    {label}
                </span>
            )
        })

        const footerClass = `row footer-row ${
            active.has(rows.length - 1) ? "prev-active" : ""
        }`

        totalRow = (
            <div className={footerClass} style={{ ...gridStyles, ...rowStyle }}>
                <span className="category footer">Total</span>
                {...totalEls}
            </div>
        )
    }

    return (
        <section className={sectionClasses}>
            <h1 className={titleClasses}>{label}</h1>

            <div className={layoutClasses}>
                <div
                    className={titleRowClasses}
                    style={{ ...gridStyles, ...rowStyle }}
                >
                    <span key={-1} className="category header">
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
    cells: string[]
    columns: TallyTableColumn<TItem>[]
    subColumns: TallyTableSubColumn<TSubItem>[]

    isActive: boolean
    isNextActive: boolean

    style?: CSSProperties
}

function Row({
    onClick,
    row,
    cells,
    columns,
    subColumns,
    isActive,
    isNextActive,
    style,
}: RowProps) {
    const hasSubtable = !!row.subValues?.length

    const rowClass = [
        "row",
        isActive && hasSubtable ? "active" : "",
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

    const cellEls = cells.map((cell, idx) => {
        return (
            <div
                key={idx}
                className="cell"
                style={
                    {
                        // width: "100%",
                    }
                }
            >
                {cell}
            </div>
        )
    })

    return (
        <div
            onClick={() => (hasSubtable ? onClick() : "")}
            className={rowClass}
            style={{
                // gridTemplateColumns: `minmax(10rem, 1fr) repeat(${columns.length}, minmax(min-content, 1fr))`,
                ...style,
            }}
        >
            <span className="category cell">{row.label}</span>

            {...cellEls}

            {subTable}
        </div>
    )
}

interface SubRowProps<TSubItem = any> {
    subValues: TSubItem[]
    subColumns: Array<TallyTableSubColumn<TSubItem>>
    span: number
}

function SubTable({ subValues, subColumns, span }: SubRowProps) {
    const alignClass = subColumns.map((col) =>
        col.align === "left" ? "text-left" : "text-right",
    )

    const headers = subColumns.map((subCol, idx) => {
        const cls = `subheader ${alignClass[idx]} ${subCol.tooltip ? "tooltip" : ""}`

        return (
            <div key={"header" + idx} className={cls}>
                {subCol.tooltip ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger style={{ textAlign: "inherit" }}>
                                {subCol.label}
                            </TooltipTrigger>
                            <TooltipContent>{subCol.tooltip}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <>{subCol.label}</>
                )}
            </div>
        )
    })

    const cells = subValues.flatMap((subValue, rowIdx) =>
        subColumns.map((subCol, idx) => {
            const value = subCol.get(subValue)

            let valueStr
            if (subCol.format) {
                valueStr = subCol.format(value)
            } else if (typeof value === "number" && value >= 1000) {
                valueStr = formatNumber(value)
            } else {
                valueStr = Number.isInteger(value)
                    ? Number(value).toFixed(0)
                    : Number.isNaN(Number(value))
                      ? String(value)
                      : Number(value).toFixed(1)

                if (subCol.smol && /^0+\.0+$/.test(valueStr)) {
                    valueStr = Number(value).toFixed(3)
                }
            }

            const cls = `subcell ${alignClass[idx]}`

            return (
                <div key={`${subCol.label}_${rowIdx}`} className={cls}>
                    {valueStr}
                </div>
            )
        }),
    )

    return (
        <div
            className="subtable"
            style={{
                gridColumn: `auto / span ${span}`,
                gridTemplateColumns: `repeat(${subColumns.length}, max-content)`,
            }}
        >
            {...headers}

            {...cells}
        </div>
    )
}

function formatLabel(x: string) {
    const lines = x.trim().split("\n")

    const parts = []
    let maxWidth = 0
    for (let idx = 0; idx < lines.length; idx++) {
        const ln = lines[idx]

        maxWidth = Math.max(ln.length, maxWidth)

        parts.push(<Fragment key={"text_" + idx}>{ln}</Fragment>)
        if (idx !== lines.length - 1) {
            parts.push(<br key={"br_" + idx} />)
        }
    }

    return {
        labelEl: <span>{...parts}</span>,
        maxWidth,
    }
}
