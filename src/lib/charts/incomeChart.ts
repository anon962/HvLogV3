import * as Plot from "@observablehq/plot"
import {
    alphabetical,
    group,
    last,
    mapEntries,
    max,
    range,
    sort,
    sum,
} from "radash"
import { CompleteLog, LogEntry } from "../logDb"
import { HvEventMap } from "../parsers"
import {
    PRICES,
    TAILWIND_COLORS,
    TAILWIND_SHADES,
} from "../ui/constants"
import { DropEventSummary } from "../ui/hvlog/dropStats"
import { findNext, formatNumber } from "../utils/miscUtils"
import { DataSeries } from "./dataSeries"

type Series = DataSeries<{
    value: number
    roundIdx: number
}>

export class IncomeChart {
    series: Record<string, Series> = {}

    expenses: Series

    endRound: number

    constructor(
        public log: CompleteLog,
        public dropSummary: DropEventSummary,
        public usageSummary: DropEventSummary
    ) {
        let toPush: Record<
            string,
            Array<{ roundIdx: number; value: number }>
        > = {}
        for (const group of dropSummary.groups) {
            toPush[group.label] = []
        }

        for (const [key, entries] of Object.entries(
            dropSummary.data
        )) {
            for (const group of dropSummary.groups) {
                if (group.has(key)) {
                    if (group.label === "Other") {
                        break
                    }

                    for (const entry of entries) {
                        toPush[group.label].push(
                            summaryToPoint(entry, log)
                        )
                    }

                    break
                }
            }
        }

        this.endRound = Math.max(
            ...Object.values(toPush)
                .flatMap((xs) => xs)
                .map((x) => x.roundIdx),
            1
        )

        const newSeries = () =>
            new DataSeries(
                (d) => ({
                    x: d.roundIdx,
                    y: d.value,
                }),
                [
                    { type: "sort" },
                    { type: "binByWidth", width: 0 },
                    { type: "accumulate" },
                    {
                        type: "fill",
                        start: { x: 0, y: 0 },
                        stop: this.endRound ?? undefined,
                    },
                    // { type: "average", width: 5 },
                ]
            ) as Series

        for (const [key, xs] of Object.entries(toPush)) {
            this.series[key] = newSeries()
            this.series[key].push(...xs)
        }

        // this.series["all"] = newSeries()
        // this.series["all"].push(
        //     ...Object.values(toPush).flatMap((xs) => xs)
        // )

        const usageExpenses = Object.values(usageSummary.data)
            .flatMap((xs) => xs)
            .map((x) => summaryToPoint(x, log))
        const staminaExpenses = [...range(1, this.endRound)].map(
            (idx) => ({
                value: PRICES["Energy Drink"] / (10 * 50),
                roundIdx: idx,
            })
        )
        this.expenses = newSeries().push(
            ...usageExpenses,
            ...staminaExpenses
        )

        function isRoundStart(x: LogEntry): x is LogEntry<
            HvEventMap["ROUND_START"]
        > & {
            type: "event"
        } {
            return (
                x.type === "event" &&
                x.event.event_type === "ROUND_START"
            )
        }

        function summaryToPoint(
            entry: DropEventSummary["data"][string][number],
            log: CompleteLog
        ) {
            const [ev] = findNext(log.entries, isRoundStart, {
                start: entry.logIdx,
                reverse: true,
            })
            const roundIdx = ev?.event.current ?? 1

            return { roundIdx, value: entry.value }
        }
    }

    public render() {
        const seriesEntries = sort(
            Object.entries(this.series).filter(
                ([_, series]) => series.mappedPoints.length > 0
            ),
            ([_, series]) => last(series.mappedPoints)!.y
        )

        const incomePoints = seriesEntries.flatMap(
            ([label, series]) =>
                series.mappedPoints.map((pt) => ({
                    ...pt,
                    label,
                }))
        )

        const percs = this.toPercentages(
            incomePoints,
            this.expenses.mappedPoints
        )

        const total = sum(
            Object.values(this.series),
            (s) => last(s.mappedPoints)?.y ?? 0
        )

        const plotEl = Plot.plot({
            x: {
                label: "Round",
                grid: true,
            },
            y: {
                label: "Credits",
                grid: true,
            },
            marks: [
                Plot.ruleY([0]),
                Plot.areaY(incomePoints, {
                    x: "x",
                    y: "y",
                    fill: (d) => d["label"],
                    interval: 1,
                    fillOpacity: 0.85,
                }),
                Plot.lineY(this.expenses.mappedPoints, {
                    x: "x",
                    y: "y",
                    stroke: (d) => " Expenses",
                    strokeWidth: 3,
                }),
                Plot.ruleX(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: total,
                        dx: 1,
                        stroke: "var(--foreground)",
                        strokeWidth: 2,
                    })
                ),
                Plot.tip(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: total,
                        dx: 1,
                        title: "description",
                        frameAnchor: "top",
                        pointerSize: 0,
                        strokeWidth: 2,
                    })
                ),
            ],
            color: {
                legend: true,
                range: [
                    "red",
                    ...TAILWIND_COLORS.slice(1)
                        .map(
                            (row) => row.colors[TAILWIND_SHADES[600]]
                        )
                        .filter((_, idx) => idx % 3 === 2),
                    ...TAILWIND_COLORS.slice(1)
                        .map(
                            (row) => row.colors[TAILWIND_SHADES[400]]
                        )
                        .filter((_, idx) => idx % 3 === 2),
                ],
            },
            marginLeft: 50,
            marginRight: 0,
            labelArrow: false,
        })

        return plotEl
    }

    private toPercentages(
        points: Array<{ x: number; y: number; label: string }>,
        expensePoints: Array<{ x: number; y: number }>
    ) {
        const byX = group(points, (pt) => pt.x)
        const expenses = group(expensePoints, (pt) => pt.x)

        const byRelativeFrac = mapEntries(byX, (x, pts) => {
            const byLabel = group(pts!, (pt) => pt.label)
            const summed = mapEntries(byLabel, (label, pts) => [
                label,
                sum(pts as typeof points, (pt) => pt.y),
            ])

            const total = sum(Object.values(summed))
            const relative = mapEntries(summed, (label, value) => [
                label,
                value / total,
            ])

            const costs = expenses[x]![0].y
            const net = total - costs

            const keys = alphabetical(Object.keys(relative), (x) => x)

            let descriptionLines = [
                `Round ${x}`,
                "",
                `Income: ${formatNumber(total).padStart(7)}`,
                `Costs: ${formatNumber(costs).padStart(7)}`,
                `Net: ${formatNumber(net).padStart(8)}`,
                "",
                ...keys.map(
                    (k) =>
                        `${k}: ${Math.trunc(relative[k] * 100)
                            .toString()
                            .padStart(2)}%`
                ),
            ]
            const padLength = max(
                descriptionLines.map((ln) => ln.length)
            )
            const description = descriptionLines
                .map((ln) => ln.padStart(padLength ?? 1))
                .join("\n")

            return [x, { description, total }]
        })

        return Object.entries(byRelativeFrac).map(([x, d]) => ({
            x: parseInt(x),
            ...d,
        }))
    }
}
