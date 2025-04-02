import { DataSeries } from "@/lib/charts/dataSeries"
import { CombatSummary } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import * as Plot from "@observablehq/plot"
import {
    alphabetical,
    group,
    last,
    mapEntries,
    max,
    sort,
    sum,
} from "radash"
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
        public endRound: number
    ) {
        const toPush: Record<string, Array<PointData>> = {}

        for (const [label, castsForSpell] of Object.entries(
            combat.data
        )) {
            const activePoints = castsForSpell.flatMap(
                ({ logIdx, heal }) =>
                    heal?.health
                        ? [
                              {
                                  value: heal.health,
                                  roundIdx: indexMap.l2r(logIdx),
                              },
                          ]
                        : []
            )
            if (activePoints.length > 0) {
                toPush[label] = activePoints
            }

            const passivePoints = castsForSpell.flatMap(
                ({ logIdx, effectHeals }) =>
                    effectHeals?.health
                        ? [
                              {
                                  value: effectHeals.health,
                                  roundIdx: indexMap.l2r(logIdx),
                              },
                          ]
                        : []
            )
            if (passivePoints.length > 0) {
                toPush[label] = passivePoints
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

        this.sparks = (combat.data["SPARK_TRIGGER"] ?? []).flatMap(
            (cast) => (cast.spark ? [indexMap.l2r(cast.logIdx)] : [])
        )
        this.sparks = sort(this.sparks, (x) => x)
    }

    public render() {
        const seriesEntries = sort(
            Object.entries(this.series).filter(
                ([_, series]) => series.mappedPoints.length > 0
            ),
            ([_, series]) => last(series.mappedPoints)!.y
        )

        const allPoints = seriesEntries.flatMap(
            ([label, series], idx) =>
                series.mappedPoints.map((pt) => ({
                    ...pt,
                    label: label.padStart(idx + label.length, " "),
                }))
        )

        const percs = toPercentages(
            allPoints,
            this.endRound,
            this.sparks
        )

        const absoluteMax = max(allPoints.map(({ y }) => y)) ?? 0

        console.log(this)
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
                Plot.ruleX(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: absoluteMax,
                        dx: 1,
                        stroke: "var(--foreground)",
                        strokeWidth: 2,
                    })
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
                    })
                ),
            ],
            color: {
                legend: true,
                range: [
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
    sparks: number[]
) {
    const cumulativeSparks = [] as number[]
    let sparkIdx = 0
    let sparkCount = 0
    for (let idx = 0; idx < endRound; idx++) {
        if (idx === sparks[sparkIdx]) {
            sparkCount += 1
            sparkIdx += 1
        }
        cumulativeSparks.push(sparkCount)
    }

    const byX = group(points, (pt) => pt.x)
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

        const y = max(Object.values(summed))!

        const keys = alphabetical(Object.keys(relative), (x) => x)

        let descriptionLines = [
            `Round ${x}`,
            `Sparks: ${cumulativeSparks[x]}`,
            "",
            ...keys.map(
                (k) =>
                    `${k}: ${Math.trunc(relative[k] * 100)
                        .toString()
                        .padStart(2)}%`
            ),
        ]
        const padLength = max(descriptionLines.map((ln) => ln.length))
        const description = descriptionLines
            .map((ln) => ln.padStart(padLength ?? 1))
            .join("\n")

        return [x, { y, description, total }]
    })

    return Object.entries(byRelativeFrac).map(([x, d]) => ({
        x: parseInt(x),
        ...d,
    }))
}
