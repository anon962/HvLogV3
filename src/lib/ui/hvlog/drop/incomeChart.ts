import { DataSeries } from "@/lib/dataSeries"
import { DROP_CATEGORIES, DropSummary } from "@/lib/stats/dropStats"
import { ItemUsageSummary } from "@/lib/stats/itemUsageStats"
import { formatNumber } from "@/lib/utils/miscUtils"
import * as Plot from "@observablehq/plot"
import { TAILWIND_COLORS, TAILWIND_SHADES } from "../../../ui/constants"
import {
    alphabeticalBy,
    groupBy,
    last,
    mapEntries,
    range,
    sort,
    sum,
    zip,
} from "myutils"
import { IndexMap } from "@/lib/stats/indexMap"

type Series = DataSeries<{
    value: number
    roundIdx: number
}>

export class IncomeChart {
    series: Record<string, Series> = {}
    expenses: Series
    endRound: number
    roundToTotalTurns: Record<number, number>

    constructor(
        public prices: Record<string, number>,
        public dropSummary: DropSummary,
        public usageSummary: ItemUsageSummary,
        public isGrindfest: boolean,
        public roundIdxs: Array<{ logIdx: number; roundIdx: number }>,
        public indexMap: IndexMap,
    ) {
        let toPush: Record<
            string,
            Array<{ roundIdx: number; value: number }>
        > = {}
        for (const cat of Object.keys(DROP_CATEGORIES)) {
            toPush[cat] = []
        }
        toPush["Other"] = []

        for (const x of Object.values(dropSummary)) {
            const category = x.category ?? "Other"
            toPush[category].push(
                ...zip(x.events.logIdx, x.events.count).map(
                    ([logIdx, count]) => ({
                        roundIdx: this.indexMap.l2r(logIdx),
                        value: count * (this.prices[x.priceKey] ?? 0),
                    }),
                ),
            )
        }

        this.endRound = Math.max(
            ...Object.values(toPush)
                .flatMap((xs) => xs)
                .map((x) => x.roundIdx),
            0,
        )
        this.roundToTotalTurns = range(this.endRound).reduce(
            ({ byRound: map, total }, roundIdx) => {
                const start = this.indexMap.r2t(roundIdx + 1)!
                let end = this.indexMap.r2t(roundIdx + 2) ?? 0
                end = end || start // @todo: last round is 0 for some reason

                total += end - start
                map[roundIdx + 1] = total

                return {
                    byRound: map,
                    total,
                }
            },
            {
                byRound: {} as Record<number, number>,
                total: 0,
            },
        ).byRound

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
                        variant: "hold",
                        start: { x: 0, y: 0 },
                        stop: this.endRound ?? 1,
                    },
                    // { type: "average", width: 5 },
                ],
            ) as Series

        for (const [key, xs] of Object.entries(toPush)) {
            this.series[key] = newSeries()
            this.series[key].push(...xs)
        }

        // this.series["all"] = newSeries()
        // this.series["all"].push(
        //     ...Object.values(toPush).flatMap((xs) => xs)
        // )

        const usageExpenses = []
        for (const x of Object.values(usageSummary)) {
            const category = x.category ?? "Other"
            usageExpenses.push(
                ...zip(x.events.logIdx, x.events.count).map(
                    ([logIdx, count]) => ({
                        roundIdx: this.indexMap.l2r(logIdx),
                        value: count * (this.prices[x.priceKey] ?? 0),
                    }),
                ),
            )
        }

        const entryCost = this.isGrindfest
            ? this.prices["Energy Drink"] / 10
            : 0
        const roundCost = this.prices["Energy Drink"] / (10 * 50)
        const staminaExpenses = [...range(1, this.endRound + 1)].map((idx) => ({
            value: idx === 1 ? entryCost + roundCost : roundCost,
            roundIdx: idx,
        }))
        this.expenses = newSeries().push(...usageExpenses, ...staminaExpenses)
    }

    public render() {
        const seriesEntries = sort(
            Object.entries(this.series).filter(
                ([_, series]) => series.mappedPoints.length > 0,
            ),
            ([_, series]) => last(series.mappedPoints)!.y,
        )

        const incomePoints = seriesEntries.flatMap(([label, series], idx) =>
            series.mappedPoints.map((pt) => ({
                ...pt,
                label: label.padStart(idx + label.length, " "),
            })),
        )

        const percs = this.toPercentages(
            incomePoints,
            this.expenses.mappedPoints,
            this.roundToTotalTurns,
        )

        const total = sum(
            Object.values(this.series).map((s) => last(s.mappedPoints)?.y ?? 0),
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
                    stroke: (d) => "Expenses".padStart(99, " "),
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
                    }),
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
                    }),
                ),
            ],
            color: {
                legend: true,
                range: [
                    "red",
                    ...TAILWIND_COLORS.slice(1)
                        .map((row) => row.colors[TAILWIND_SHADES[600]])
                        .filter((_, idx) => idx % 3 === 2),
                    ...TAILWIND_COLORS.slice(1)
                        .map((row) => row.colors[TAILWIND_SHADES[400]])
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
        expensePoints: Array<{ x: number; y: number }>,
        roundToTotalTurns: Record<number, number>,
    ) {
        const byX = groupBy(points, (pt) => pt.x)
        const expenses = groupBy(expensePoints, (pt) => pt.x)

        const byRelativeFrac: Record<
            string,
            { description: string; total: number }
        > = mapEntries(byX, (x, pts) => {
            const byLabel = groupBy(pts!, (pt) => pt.label)
            const summed: Record<string, number> = mapEntries(
                byLabel,
                (label, pts) => ({
                    [label]: sum(pts.map((pt) => pt.y)),
                }),
            )

            const total = sum(Object.values(summed))
            const relative = mapEntries(summed, (label, value) => ({
                [label]: value / total,
            }))

            const costs = expenses.get(x)![0].y
            const net = total - costs

            const keys = alphabeticalBy(Object.keys(relative), (x) => x)

            let descriptionLines = [
                `Round ${x}`,
                "",
                `Income: ${formatNumber(total).padStart(7)}`,
                `Costs: ${formatNumber(costs).padStart(7)}`,
                `Net: ${formatNumber(net).padStart(7)}`,
                `Net/R: ${(net / x).toFixed(1).padStart(7)}`,
                `Net/T: ${(net / roundToTotalTurns[x]).toFixed(1).padStart(7)}`,
                "",
                ...keys.map(
                    (k) =>
                        `${k}: ${Math.trunc(relative[k] * 100)
                            .toString()
                            .padStart(2)}%`,
                ),
            ]
            const padLength = Math.max(
                ...descriptionLines.map((ln) => ln.length),
            )
            const description = descriptionLines
                .map((ln) => ln.padStart(padLength ?? 1))
                .join("\n")

            return {
                [x]: { description, total },
            }
        })

        return Object.entries(byRelativeFrac).map(([x, d]) => ({
            x: parseInt(x),
            ...d,
        }))
    }
}
