import { CompleteLog } from "@/lib/logDb"
import { UsageEventSummary } from "@/lib/stats/dropStats"
import { DropEventSummary } from "@/lib/stats/itemUsageStats"
import { filterEvents } from "@/lib/stats/summaryStats"
import { formatNumber } from "@/lib/utils/miscUtils"
import { alphabetical, max, range, sum } from "radash"
import { useEffect, useRef } from "react"
import { GOOD_EQUIPS, PRICES } from "../../constants"
import { useLog } from "../../logContext"
import { TallyTable, TallyTableRow } from "../tallyTable"
import { IncomeChart } from "./incomeChart"

export function DropStats(props: { log: CompleteLog }) {
    const {
        summary,
        itemDrops: drops,
        itemUsage: usage,
    } = useLog(props.log, {
        summary: true,
        itemDrops: true,
        itemUsage: true,
    })

    let staminaUsage = (summary.round?.end ?? 1) / 50
    if (summary.battleType?.name === "Grindfest") {
        staminaUsage += 1
    }

    return (
        <div className="drop-stats h-full overflow-auto flex flex-col">
            <div className="overview">
                {CalculationPreview(drops, usage, staminaUsage)}
                {EquipSummary(props.log)}
            </div>

            <hr className="my-12" />

            <div className="income-expense">
                {IncomeSummaryTable(drops)}
                {UsageSummaryTable(usage, staminaUsage)}
            </div>

            <hr className="my-12" />

            {DropChart(props.log, drops, usage)}
        </div>
    )
}

function CalculationPreview(
    drops: DropEventSummary,
    usage: UsageEventSummary,
    staminaUsage: number
) {
    const totalIncome = sum(
        Object.values(drops.data).flatMap((xs) => xs),
        (x) => x.value
    )
    let totalExpenses =
        sum(
            Object.values(usage.data).flatMap((xs) => xs),
            (x) => x.value
        ) +
        (staminaUsage * PRICES["Energy Drink"]) / 10

    const net = totalIncome - totalExpenses
    const netClass = net > 0 ? "text-green-300" : "text-red-300"
    const netStr = (net > 0 ? "+" : "") + formatNumber(net) + "c"

    const incomeStr = "+" + formatNumber(totalIncome) + "c"
    const expenseStr = "-" + formatNumber(totalExpenses) + "c"
    const maxLength = max([
        netStr.length,
        incomeStr.length,
        expenseStr.length,
    ])

    const divider =
        [...range(maxLength - 1)].map(() => "=").join("") +
        "==========="

    return (
        <pre
            className="w-max px-2 grid gap-x-4 text-right"
            style={{
                gridTemplateColumns: "max-content max-content",
            }}
        >
            <span className="">Income:</span>
            <span className="text-green-300">{incomeStr}</span>

            <span className="">Expenses:</span>
            <span className="text-red-300">{expenseStr}</span>

            {/* <span></span> */}
            <span className="col-span-2">{divider}</span>

            <span className="">Net:</span>
            <span className={netClass}>{netStr}</span>
        </pre>
    )
}

function IncomeSummaryTable(drops: DropEventSummary) {
    const acc = Object.fromEntries(
        drops.groups.map((grp) => [
            grp.label,
            {
                label: grp.label,
                count: 0,
                value: 0,
                subRows: [] as TallyTableRow[],
            },
        ])
    )

    const rows = Object.values(drops.data).reduce((acc, xs) => {
        const count = sum(xs, (x) => x.count)
        const value = sum(xs, (x) => x.value)

        const group = drops.groups.find((grp) => grp.has(xs[0].key))
        if (!group) {
            return acc
        }

        acc[group.label].count += count
        acc[group.label].value += value
        acc[group.label].subRows!.push({
            label: xs[0].key,
            count,
            value,
        })

        return acc
    }, acc)

    return (
        <TallyTable
            label="Income"
            rows={Object.values(rows)}
            sectionClass="income"
        />
    )
}

function UsageSummaryTable(
    usage: UsageEventSummary,
    staminaUsage: number
) {
    const acc = Object.fromEntries(
        usage.groups.map((grp) => [
            grp.label,
            {
                label: grp.label,
                count: 0,
                value: 0,
                subRows: [] as TallyTableRow[],
            },
        ])
    )

    const rows = Object.values(usage.data).reduce((acc, xs) => {
        const count = sum(xs, (x) => x.count)
        const value = sum(xs, (x) => x.value)

        const group = usage.groups.find((grp) => grp.has(xs[0].key))
        if (!group) {
            return acc
        }

        acc[group.label].count += count
        acc[group.label].value += value
        acc[group.label].subRows!.push({
            label: xs[0].key,
            count,
            value,
        })

        return acc
    }, acc)

    rows["stamina"] = {
        label: "Stamina",
        count: staminaUsage,
        value: (staminaUsage * PRICES["Energy Drink"]) / 10,
        subRows: [],
    }

    return (
        <TallyTable
            label="Expenses"
            rows={Object.values(rows)}
            sectionClass="expenses"
        />
    )
}

function DropChart(
    log: CompleteLog,
    dropSummary: DropEventSummary,
    usageSummary: DropEventSummary
) {
    const chart = new IncomeChart(log, dropSummary, usageSummary)
    const el = chart.render()

    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        el.remove()
        container?.current?.appendChild(el)
        return () => el.remove()
    }, [el, container.current])

    return <div ref={container} className="w-full flex"></div>
}

function EquipSummary(log: CompleteLog) {
    const evs = alphabetical(
        filterEvents(log, ["DROP"]).filter((ev) =>
            GOOD_EQUIPS.some((patt) => ev.item.match(patt))
        ),
        (ev) => ev.item
    )

    const els = evs.map((ev) => (
        <li className="list-disc">{ev.item}</li>
    ))

    return (
        <div className="equips">
            <h1 className="font-bold">Notable Equips:</h1>

            <ul className="pl-6 font-mono">
                {els.length ? (
                    els
                ) : (
                    <li className="list-disc">(none)</li>
                )}
            </ul>
        </div>
    )
}
