import { DetailsSummary } from "@/lib/summary"
import { formatNumber } from "@/lib/utils/miscUtils"
import { range, sort, sum, sortBy } from "myutils"
import { useEffect, useRef, useState } from "react"
import { TallyTable, TallyTableProps } from "../../tallyTable"
import { IncomeChart } from "./incomeChart"
import { DROP_CATEGORIES } from "@/lib/stats/dropStats"
import { ITEM_USAGE_CATEGORIES } from "@/lib/stats/itemUsageStats"

export function DropInfo({
    prices,
    stats,
}: {
    stats: DetailsSummary
    prices: Record<string, number>
}) {
    let staminaUsage = (stats.meta.round?.end ?? 1) / 50
    if (stats.meta.battleType?.category === "Grindfest") {
        staminaUsage += 1
    }

    return (
        <div className="drop-stats h-full overflow-auto flex flex-col">
            <div className="overview">
                <CalculationPreview stats={stats} />
                <EquipSummary stats={stats} />
            </div>

            <hr className="my-12" />

            <div className="income-expense">
                <IncomeSummaryTable prices={prices} stats={stats} />
                <UsageSummaryTable
                    prices={prices}
                    staminaUsage={staminaUsage}
                    stats={stats}
                />
            </div>

            <hr className="my-12" />

            <DropChart prices={prices} stats={stats} />
        </div>
    )
}

function CalculationPreview({ stats }: { stats: DetailsSummary }) {
    const { profit, income, expenses } = stats.finances

    const profitClass = profit > 0 ? "text-green-300" : "text-red-300"
    const profitStr = (profit > 0 ? "+" : "") + formatNumber(profit) + "c"

    const incomeStr = "+" + formatNumber(income) + "c"
    const expenseStr = "-" + formatNumber(expenses) + "c"
    const maxLength = Math.max(
        profitStr.length,
        incomeStr.length,
        expenseStr.length,
    )

    const divider =
        [...range(maxLength)].map(() => "=").join("") + "==========="

    return (
        <pre
            className="w-max px-2 grid gap-x-4 text-right"
            style={{
                gridTemplateColumns: "max-content max-content",
                gridTemplateRows: "repeat(4, max-content)",
            }}
        >
            <span className="">Income:</span>
            <span className="text-green-300">{incomeStr}</span>

            <span className="">Expenses:</span>
            <span className="text-red-300">{expenseStr}</span>

            {/* <span></span> */}
            <span className="col-span-2">{divider}</span>

            <span className="">Profit:</span>
            <span className={profitClass}>{profitStr}</span>
        </pre>
    )
}

type IncomeTable = TallyTableProps<
    { count: number; value: number },
    { count: number; value: number; label: string }
>

function IncomeSummaryTable({
    prices,
    stats: { drops },
}: {
    prices: Record<string, number>
    stats: DetailsSummary
}) {
    const excluded = new Set(["experience"])

    const rowMap = Object.values(drops).reduce(
        (acc, x) => {
            const count = sum(x.events.count)
            const value = prices[x.priceKey] ?? 0

            const category = x.category ?? "Other"

            if (!excluded.has(x.key)) {
                acc[category].value.count += count
                acc[category].value.value += count * value
            }
            acc[category].subValues!.push({
                label: x.name,
                count,
                value,
            })

            return acc
        },
        Object.fromEntries(
            Object.entries({ ...DROP_CATEGORIES, Other: "Other" }).map(
                ([k, v]) => [
                    k,
                    {
                        label: v,
                        value: {
                            count: 0,
                            value: 0,
                        },
                        subValues: [] as Array<{
                            label: string
                            count: number
                            value: number
                        }>,
                        disabled: true,
                        selectable: true,
                        excludeFromTotal: false,
                    },
                ],
            ),
        ),
    )

    const columns: IncomeTable["columns"] = [
        { label: "Value", get: (x) => x.value },
        { label: "Count", get: (x) => x.count },
    ]

    const subColumns: IncomeTable["subColumns"] = [
        { label: "Item", get: (x) => x.label, align: "left" },
        { label: "Value", get: (x) => x.value },
        { label: "Count", get: (x) => x.count },
    ]

    const rows = sortBy(Object.values(rowMap), [
        { fn: (x) => x.value.value },
        { fn: (x) => x.value.count },
        { fn: (x) => x.label, reverse: true },
    ]).reverse()

    for (const row of rows) {
        row.subValues = sortBy(row.subValues ?? [], [
            { fn: (x) => x.value },
            { fn: (x) => x.count },
            { fn: (x) => x.label, reverse: true },
        ]).reverse()

        row.disabled = row.value.count === 0
        row.selectable = row.value.count > 0
    }

    return (
        <TallyTable
            label="Income"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="income"
        />
    )
}

type UsageTable = TallyTableProps<
    { count: number; value: number },
    { count: number; value: number; label: string }
>

function UsageSummaryTable({
    staminaUsage,
    prices,
    stats: { usage },
}: {
    staminaUsage: number
    prices: Record<string, number>
    stats: DetailsSummary
}) {
    const rowMap = Object.values(usage).reduce(
        (acc, x) => {
            const count = sum(x.events.count)
            const value = prices[x.priceKey] ?? 0

            const category = x.category ?? "Other"

            acc[category].value.count += count
            acc[category].value.value += count * value
            acc[category].subValues!.push({
                label: x.name,
                count,
                value,
            })

            return acc
        },
        Object.fromEntries(
            Object.entries({ ...ITEM_USAGE_CATEGORIES, Other: "Other" }).map(
                ([k, v]) => [
                    k,
                    {
                        label: v,
                        value: {
                            count: 0,
                            value: 0,
                        },
                        subValues: [] as Array<{
                            label: string
                            count: number
                            value: number
                        }>,
                        disabled: true,
                        selectable: true,
                    },
                ],
            ),
        ),
    )

    rowMap["stamina"] = {
        label: "Stamina",
        value: {
            count: staminaUsage,
            value: (staminaUsage * prices["Energy Drink"]) / 10,
        },
        subValues: [],
        selectable: false,
        disabled: true,
    }

    const columns: UsageTable["columns"] = [
        { label: "Value", get: (x) => x.value },
        { label: "Count", get: (x) => x.count },
    ]

    const subColumns: UsageTable["subColumns"] = [
        { label: "Item", get: (x) => x.label, align: "left" },
        { label: "Value", get: (x) => x.value },
        { label: "Count", get: (x) => x.count },
    ]

    const rows = sortBy(Object.values(rowMap), [
        { fn: (x) => x.value.value },
        { fn: (x) => x.value.count },
        { fn: (x) => x.label, reverse: true },
    ]).reverse()

    for (const row of rows) {
        row.subValues = sortBy(row.subValues ?? [], [
            { fn: (x) => x.value },
            { fn: (x) => x.count },
            { fn: (x) => x.label, reverse: true },
        ]).reverse()

        row.disabled = row.value.count === 0
        row.selectable = row.value.count > 0
    }

    return (
        <TallyTable
            label="Expenses"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="expenses"
        />
    )
}

function DropChart({
    prices,
    stats: { meta, drops, usage, indexMap },
}: {
    prices: Record<string, number>
    stats: DetailsSummary
}) {
    const [el, setEl] = useState<Element | null>(null)
    useEffect(() => {
        setEl(
            new IncomeChart(
                prices,
                drops,
                usage,
                meta.battleType?.category === "Grindfest",
                sort(Object.entries(meta.roundIndices), (x) =>
                    parseInt(x[0]),
                ).map((x) => ({ logIdx: x[1], roundIdx: parseInt(x[0]) })),
                indexMap,
            ).render(),
        )
    }, [])

    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!el) return

        el.remove()
        container?.current?.appendChild(el)
        return () => el.remove()
    }, [el, container.current])

    return <div ref={container} className="w-full flex"></div>
}

function EquipSummary({ stats: { drops } }: { stats: DetailsSummary }) {
    const patts = ["(?:magnificent|legendary|peerless)"].map(
        (patt) => new RegExp(patt, "i"),
    )

    const equips = sort(
        Object.values(drops)
            .filter((x) => x.isEquip)
            .map((eq) => eq.name)
            .filter((name) => patts.some((patt) => patt.test(name))),
        (name) =>
            ["Magnificent", "Legendary", "Peerless"].findIndex((tier) =>
                new RegExp(tier, "i").test(name),
            ),
        true,
    )

    const els = equips.map((name, idx) => (
        <li key={idx} className="list-disc">
            {name}
        </li>
    ))

    return (
        <div className="equips">
            <h1 className="font-bold">Notable Equips:</h1>

            <ul className="pl-6 font-mono">
                {equips.length ? (
                    <>{...els}</>
                ) : (
                    <li className="list-disc">(none)</li>
                )}
            </ul>
        </div>
    )
}
