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
import { CompleteLog, LogEntry } from "../logDb"
import { HvEventMap } from "../parsers"
import { EventSummary } from "../ui/hvlog/dropStats"
import { formatNumber } from "../ui/hvlog/tallyTable"
import { findNext } from "../utils/miscUtils"
import { DataSeries } from "./dataSeries"

export class IncomeChart {
    series: Record<
        string,
        DataSeries<{
            value: number
            roundIdx: number
        }>
    > = {}

    endRound: number

    constructor(
        public log: CompleteLog,
        public summary: EventSummary
    ) {
        let toPush: Record<
            string,
            Array<{ roundIdx: number; value: number }>
        > = {}
        for (const group of summary.groups) {
            toPush[group.label] = []
        }

        for (const [key, entries] of Object.entries(summary.data)) {
            for (const group of summary.groups) {
                if (group.keys.has(key)) {
                    if (group.label === "Other") {
                        break
                    }

                    for (const entry of entries) {
                        const value = entry.value

                        const [ev] = findNext(
                            log.entries,
                            isRoundStart,
                            { start: entry.logIdx, reverse: true }
                        )
                        const roundIdx = ev?.event.current ?? 1

                        toPush[group.label].push({
                            roundIdx,
                            value,
                        })
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
            )

        for (const [key, xs] of Object.entries(toPush)) {
            this.series[key] = newSeries()
            this.series[key].push(...xs)
        }

        // this.series["all"] = newSeries()
        // this.series["all"].push(
        //     ...Object.values(toPush).flatMap((xs) => xs)
        // )

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
    }

    public render() {
        const seriesEntries = sort(
            Object.entries(this.series).filter(
                ([_, series]) => series.mappedPoints.length > 0
            ),
            ([_, series]) => last(series.mappedPoints)!.y
        )

        const points = seriesEntries.flatMap(([label, series]) =>
            series.mappedPoints.map((pt) => ({
                ...pt,
                label,
            }))
        )

        const percs = this.toPercentages(points)

        const plotEl = Plot.plot({
            x: {
                label: "Round",
                grid: true,
            },
            y: {
                label: "Credits",
                grid: true,
            },
            color: {
                legend: true,
                range: [
                    "blue",
                    "yellow",
                    "purple",
                    "green",
                    "orange",
                    "cyan",
                    "white",
                ],
            },
            marginLeft: 50,
            marginRight: 0,
            marks: [
                Plot.ruleY([0]),
                Plot.areaY(points, {
                    x: "x",
                    y: "y",
                    fill: "label",
                    title: "label",
                    interval: 1,
                    fillOpacity: 0.85,
                }),
                Plot.ruleX(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: "total",
                        dx: 1,
                        stroke: "red",
                    })
                ),
                Plot.tip(
                    percs,
                    Plot.pointerX({
                        x: "x",
                        y: "total",
                        dx: 1,
                        title: "description",
                    })
                ),
            ],
        })

        return plotEl
    }

    private toPercentages(
        points: Array<{ x: number; y: number; label: string }>
    ) {
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

            const keys = alphabetical(Object.keys(relative), (x) => x)
            const descLines = keys.map(
                (k) => `${k}: ${Math.trunc(relative[k] * 100)}%`
            )
            const padLength = max(descLines, (s) => s.length)?.length
            const description = [
                `Round: ${x}`,
                `Total: ${formatNumber(total)}`,
                "",
                ...descLines,
            ]
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
