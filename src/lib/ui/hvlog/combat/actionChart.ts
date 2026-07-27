import { DataSeries } from "@/lib/dataSeries"
import { CombatSummary } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { MetaSummary } from "@/lib/stats/metaStats"
import * as Plot from "@observablehq/plot"
import { last, sort, sum, zip } from "myutils"
import { TAILWIND_COLORS, TAILWIND_SHADES } from "../../constants"

interface PointData {
    value: number
    roundIdx: number
}

type Series = DataSeries<PointData>

export class ActionChart {
    series: Record<string, Series> = {}
    sparks: number[]

    constructor(
        public combat: CombatSummary,
        public meta: MetaSummary,
        public endRound: number,
        public indexMap: IndexMap,
    ) {
        const toPush: Record<string, Array<PointData>> = {}

        for (const { label, data } of [
            { label: "Heals", data: combat.heal },
            { label: "Buffs", data: combat.buff },
            { label: "Debuffs", data: combat.debuff },
            { label: "Spells", data: combat.spell },
            { label: "Attacks", data: combat.attack },
            { label: "Skills", data: combat.skill },
        ]) {
            toPush[label] = Object.values(data)
                .flatMap((source) => source.events.logIdx)
                .map((logIdx) => ({
                    value: 1,
                    roundIdx: indexMap.l2r(logIdx),
                }))
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
                    {
                        type: "fill",
                        variant: "pad",
                        start: { x: 0, y: 0 },
                        stop: this.endRound ?? 1,
                    },
                    {
                        type: "average",
                        width: (this.meta.round?.end ?? 1) > 300 ? 30 : 10,
                    },
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
            true,
        )

        const palette = [
            ...TAILWIND_COLORS.slice(1)
                .map((row) => row.colors[TAILWIND_SHADES[600]])
                .filter((_, idx) => idx % 3 === 2),
            ...TAILWIND_COLORS.slice(1)
                .map((row) => row.colors[TAILWIND_SHADES[400]])
                .filter((_, idx) => idx % 3 === 2),
        ]
        const labelColors = Object.keys(this.series).reduce(
            (acc, k, idx) => {
                acc[k] = palette[idx]
                return acc
            },
            {} as Record<string, string>,
        )

        const allPoints = seriesEntries.flatMap(([label, series]) =>
            series.mappedPoints.map((pt) => ({
                ...pt,
                label,
            })),
        )

        const [percLabels, percPts] = zip(
            ...Object.entries(this.series).filter(
                (s) => s[1].mappedPoints.length > 0,
            ),
        )
        const percs = toPercentages(
            // @ts-ignore
            percPts,
            percLabels,
            this.endRound,
            this.sparks,
        )

        const absoluteMax = Math.max(1, ...allPoints.map(({ y }) => y)) ?? 0

        const plotEl = Plot.plot({
            x: {
                label: "Round",
                grid: true,
                domain: [1, (this.meta.round?.end ?? 1) * 1.02],
            },
            y: {
                label: "Turn Per Round",
                grid: true,
                domain: [0, absoluteMax],
            },
            marks: [
                Plot.ruleY([0]),
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
                Plot.lineY(allPoints, {
                    x: "x",
                    y: "y",
                    stroke: (d) => d["label"],
                    interval: 1,
                }),
                Plot.ruleX(this.sparks, {
                    y1: 0,
                    y2: absoluteMax / 20,
                    stroke: "red",
                    opacity: 0.75,
                }),
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
                domain: seriesEntries.map(([label]) => label),
                range: seriesEntries.map(([label]) => labelColors[label]),
            },
            marginLeft: 75,
            marginRight: 0,
            labelArrow: false,
        })

        return plotEl
    }
}

function toPercentages(
    series: Array<DataSeries>,
    labels: string[],
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

    return zip(...series.map((s) => s.mappedPoints)).map((ptsAtX, idx) => {
        const x = idx + 1

        const total = sum(ptsAtX.map((pt) => pt.y))
        const fracs = ptsAtX.map((pt) => pt.y / total)

        let descriptionLines = [
            `Round ${x}`,
            `Sparks: ${cumulativeSparks[idx]}`,
            "",
            ...zip(labels, fracs).map(
                ([k, x]) =>
                    `${k}: ${Math.trunc(x * 100)
                        .toString()
                        .padStart(2)}%`,
            ),
        ]
        const padLength = Math.max(...descriptionLines.map((ln) => ln.length))
        const description = descriptionLines
            .map((ln) => ln.padStart(padLength ?? 1))
            .join("\n")

        return {
            x,
            description,
        }
    })
}
