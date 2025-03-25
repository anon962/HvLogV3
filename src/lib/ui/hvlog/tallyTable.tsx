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
    const titleClasses = `pb-2 ${
        titleClass?.length ? titleClass : ""
    }`
    const titleRowClasses = `row ${
        active.has(0) ? "next-active" : ""
    }`
    const layoutClasses = `w-auto rounded-md ${layoutClass ?? ""}`

    rows = sort(rows, (x) => x.value * 1_000_000 + x.count, true)
    const totalValue = sum(Object.values(rows).map((r) => r.value))
    const totalCount = sum(Object.values(rows).map((r) => r.count))

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

                {rows.map((row, idx) => (
                    <Row
                        onClick={() => toggleActive(idx)}
                        row={row}
                        isActive={active.has(idx)}
                        isNextActive={active.has(idx + 1)}
                    />
                ))}

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
}: TallyTableRowProps) {
    const hasSubtable = !!row.subRows?.length

    const rowClass = [
        "row",
        isActive ? "active" : "",
        isNextActive ? "next-active" : "",
        row.count > 0 ? "selectable" : "",
    ].join(" ")

    let subTable
    if (isActive && hasSubtable) {
        subTable = <SubTable rows={row.subRows!} />
    }

    return (
        <div
            onClick={() => (hasSubtable ? onClick() : "")}
            className={rowClass}
        >
            <span className="category cell" title={row.title}>
                {row.label}
            </span>
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
}

export interface TallyTableRow {
    label: string
    title: string
    count: number
    value: number
    subRows?: TallyTableSubRow[]
}

export interface TallyTableSubRow {
    label: string
    count: number
    value: number
}

function formatNumber(x: number) {
    const digits = [...Math.trunc(x).toString()]
        .reverse()
        .reduce((acc, digit, idx) => {
            if (idx % 3 === 0 && idx > 0) {
                acc.push(",")
            }

            acc.push(digit)

            return acc
        }, [] as string[])

    return digits.reverse().join("")
}
