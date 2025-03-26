import { formatNumber, sortBy } from "@/lib/utils/miscUtils"
import { sort, sum } from "radash"
import { useEffect, useState } from "react"

export function TallyTable({
    label,
    rows,
    sectionClass,
    titleClass,
    layoutClass,
}: TallyTableProps) {
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

    useEffect(() => {
        setActive(new Set())
    }, rows)

    const sectionClasses = `tally-table w-max ${sectionClass ?? ""}`
    const titleClasses = `pb-4 ${
        titleClass?.length ? titleClass : ""
    }`
    const titleRowClasses = `row ${
        active.has(0) ? "next-active" : ""
    }`
    const layoutClasses = `w-auto rounded-md ${layoutClass ?? ""}`

    rows = sortBy(rows, [
        { fn: (r) => r.value },
        { fn: (r) => r.count },
        { fn: (r) => r.label, reverse: true },
    ]).reverse()

    const totalValue = sum(Object.values(rows).map((r) => r.value))
    const totalCount = sum(Object.values(rows).map((r) => r.count))

    const rowEls = rows.map((row, idx) => {
        const rowClass = `${
            idx === rows.length - 1 ? "before-total" : ""
        }`

        return (
            <Row
                className={rowClass}
                onClick={() => toggleActive(idx)}
                row={row}
                isActive={active.has(idx)}
                isNextActive={active.has(idx + 1)}
            />
        )
    })

    return (
        <section className={sectionClasses}>
            <h1 className={titleClasses}>{label}</h1>

            <div className={layoutClasses}>
                <div className={titleRowClasses}>
                    <span className="category header">Category</span>
                    <span className="value header text-right">
                        Value
                    </span>
                    <span className="count header text-right">
                        Count
                    </span>
                </div>

                {rowEls}

                <div className="row">
                    <span className="category footer">Total</span>
                    <span className="value footer text-right">
                        {formatNumber(totalValue)}
                    </span>
                    <span className="count footer text-right">
                        {totalCount >= 1000
                            ? formatNumber(totalCount)
                            : totalCount}
                    </span>
                </div>
            </div>
        </section>
    )
}

function Row({
    onClick,
    row,
    isActive,
    isNextActive,
    className,
}: TallyTableRowProps) {
    const hasSubtable = !!row.subRows?.length

    const rowClass = [
        "row",
        className ? className : "",
        isActive ? "active" : "",
        isNextActive ? "next-active" : "",
        row.count > 0 ? "selectable" : "",
    ].join(" ")

    let subTable
    if (isActive && hasSubtable) {
        const subRows = sortBy(row.subRows!, [
            { fn: (r) => r.value },
            { fn: (r) => r.count },
            { fn: (r) => r.label, reverse: true },
        ]).reverse()

        subTable = <SubTable rows={subRows} />
    }

    return (
        <div
            onClick={() => (hasSubtable ? onClick() : "")}
            className={rowClass}
        >
            <span className="category cell">{row.label}</span>
            <span className="value cell text-right">
                {formatNumber(row.value)}
            </span>
            <span className="count cell text-right">
                {row.count >= 1000
                    ? formatNumber(row.count)
                    : row.count}
            </span>

            {subTable}
        </div>
    )
}

function SubTable({ rows }: { rows: TallyTableSubRow[] }) {
    rows = sort(rows, (x) => x.value * 1_000_000 + x.count, true)

    const rowEls = rows.flatMap((r) => [
        <div className="subcategory subcell">{r.label}</div>,
        <div className="subvalue subcell">
            {formatNumber(r.value)}
        </div>,
        <div className="subcount subcell">{r.count}</div>,
    ])

    return (
        <div className="subtable">
            <div className="subcategory subheader">Item</div>
            <div className="subvalue subheader">Value</div>
            <div className="subcount subheader">Count</div>

            {rowEls}
        </div>
    )
}

export interface TallyTableProps {
    label: string
    rows: TallyTableRow[]
    sectionClass?: string
    titleClass?: string
    layoutClass?: string
}

export interface TallyTableRowProps {
    onClick: () => void
    row: TallyTableRow
    isActive: boolean
    isNextActive: boolean
    className?: string
}

export interface TallyTableRow {
    label: string
    count: number
    value: number
    subRows?: TallyTableSubRow[]
}

export interface TallyTableSubRow {
    label: string
    count: number
    value: number
}
