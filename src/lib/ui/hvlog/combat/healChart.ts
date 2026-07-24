import { DataSeries } from "@/lib/charts/dataSeries"
import { CombatSummary } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import * as Plot from "@observablehq/plot"
import {
    alphabetical,
    groupBy,
    last,
    mapEntries,
    sort,
    sum,
    zip,
} from "myutils"
import { TAILWIND_COLORS, TAILWIND_SHADES } from "../../constants"

interface PointData {
    value: number
    roundIdx: number
}

type Series = DataSeries<PointData>

export class HealChart {
    series: Record<string, Series> = {}
    sparks: number[]

    constructor(
        public combat: CombatSummary,
        public indexMap: IndexMap,
        public endRound: number,
    ) {
        const toPush: Record<string, Array<PointData>> = {}

        for (const [type, key, data] of [
            ["active", "health", combat.heal],
            // ["active", "magic", combat.heal],
            // ["active", "spirit", combat.heal],
            ["passive", "health", combat.passiveHeal],
            // ["passive", "magic", combat.passiveHeal],
            // ["passive", "spirit", combat.passiveHeal],
        ] as const) {
            for (const source of Object.values(data)) {
                if (source.events[key].some((v) => v > 0)) {
                    const heals = zip(source.events.logIdx, source.events[key])
                        .filter(([logIdx, v]) => v > 0)
                        .map(([logIdx, v]) => ({
                            value: v,
                            roundIdx: indexMap.l2r(logIdx),
                        }))
                    if (heals.length > 0) {
                        toPush[source.key] = heals
                    }
                }
            }
        }

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
                        stop: this.endRound ?? undefined,
                    },
                    // { type: "average", width: 5 },
                ],
            ) as Series

        for (const [key, xs] of Object.entries(toPush)) {
            this.series[key] = newSeries()
            this.series[key].push(...xs)
        }

        this.sparks =
            combat.spark["Spark of Life"]?.events.logIdx.map((logIdx) =>
                indexMap.l2r(logIdx),
            ) ?? []
        this.sparks = sort(this.sparks, (x) => x)
    }

    public render() {
        const seriesEntries = sort(
            Object.entries(this.series).filter(
                ([_, series]) => series.mappedPoints.length > 0,
            ),
            ([_, series]) => last(series.mappedPoints)!.y,
        )

        const allPoints = seriesEntries.flatMap(([label, series], idx) =>
            series.mappedPoints.map((pt) => ({
                ...pt,
                label: label.padStart(idx + label.length, " "),
            })),
        )

        const percs = toPercentages(allPoints, this.endRound, this.sparks)

        const absoluteMax = Math.max(...allPoints.map(({ y }) => y)) ?? 0

        const plotEl = Plot.plot({
            x: {
                label: "Round",
                grid: true,
            },
            y: {
                label: "HP Healed",
                grid: true,
            },
            marks: [
                Plot.ruleY([0]),
                Plot.ruleX(this.sparks, {
                    y1: 0,
                    y2: absoluteMax / 20,
                    stroke: "red",
                    opacity: 0.75,
                }),
                Plot.lineY(allPoints, {
                    x: "x",
                    y: "y",
                    stroke: (d) => d["label"],
                    interval: 1,
                }),
                Plot.ruleX(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: absoluteMax,
                        dx: 1,
                        stroke: "var(--foreground)",
                        strokeWidth: 2,
                    }),
                ),
                Plot.tip(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: absoluteMax,
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
                    ...TAILWIND_COLORS.slice(1)
                        .map((row) => row.colors[TAILWIND_SHADES[600]])
                        .filter((_, idx) => idx % 3 === 2),
                    ...TAILWIND_COLORS.slice(1)
                        .map((row) => row.colors[TAILWIND_SHADES[400]])
                        .filter((_, idx) => idx % 3 === 2),
                ],
            },
            marginLeft: 75,
            marginRight: 0,
            labelArrow: false,
        })

        return plotEl
    }
}

function toPercentages(
    points: Array<{ x: number; y: number; label: string }>,
    endRound: number,
    sparks: number[],
) {
    const cumulativeSparks = [] as number[]
    let sparkIdx = 0
    let sparkCount = 0
    for (let idx = 0; idx < endRound; idx++) {
        if (idx >= sparks[sparkIdx]) {
            sparkCount += 1
            sparkIdx += 1
        }
        cumulativeSparks.push(sparkCount)
    }

    const byX = groupBy(points, (pt) => pt.x)
    const byRelativeFrac: Record<
        string,
        { y: number; description: string; total: number }
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

        const y = Math.max(...Object.values(summed))!

        const keys = alphabetical(Object.keys(relative))

        let descriptionLines = [
            `Round ${x}`,
            `Sparks: ${cumulativeSparks[x]}`,
            "",
            ...keys.map(
                (k) =>
                    `${k}: ${Math.trunc(relative[k] * 100)
                        .toString()
                        .padStart(2)}%`,
            ),
        ]
        const padLength = Math.max(...descriptionLines.map((ln) => ln.length))
        const description = descriptionLines
            .map((ln) => ln.padStart(padLength ?? 1))
            .join("\n")

        return { [x]: { y, description, total } }
    })

    return Object.entries(byRelativeFrac).map(([x, d]) => ({
        x: parseInt(x),
        ...d,
    }))
}
