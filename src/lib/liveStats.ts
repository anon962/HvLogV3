import {
    CategoryScale,
    Chart,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
} from "chart.js"
import { DataSeries } from "./charts/dataSeries"
import { HvEvent } from "./parsers"

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale
)

const STORAGE_KEY = "hvlog_stats"

export class LiveStats {
    containerEl: HTMLCanvasElement

    meta = {
        currentRound: 1,
        maxRound: 1,
    }

    series = {
        heals: new DataSeries<{ health: number; round: number }>(
            ({ health, round }) => ({ x: round, y: health }),
            [{ type: "binByWidth", width: 50 }]
        ),
    }

    charts: {
        heals: Chart
    }

    public constructor() {
        this.load()

        this.containerEl = document.createElement("canvas")
        document.body.appendChild(this.containerEl)
        document.addEventListener("DOMContentLoaded", () => {
            document.body.appendChild(this.containerEl)
        })

        this.charts = this.initCharts()

        this.updateAllCharts()
    }

    public save() {
        const data: any = {
            meta: this.meta,
            series: {},
        }
        for (const [name, series] of Object.entries(this.series)) {
            data.series[name] = series.data
        }

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data, null, 2)
        )
    }

    public append(ev: HvEvent) {
        if (ev.event_type === "ROUND_START") {
            this.meta.currentRound = ev.current
            this.meta.maxRound = ev.max
            this.save()
        } else if (ev.event_type === "RIDDLE_RESTORE") {
            this.series.heals.push({
                health: ev.hp,
                round: this.meta.currentRound,
            })
            this.updateChart("heals")
        } else if (
            ev.event_type === "ITEM_RESTORE" &&
            ev.type === "health"
        ) {
            this.series.heals.push({
                health: ev.value,
                round: this.meta.currentRound,
            })
            this.updateChart("heals")
        } else if (ev.event_type === "CURE_RESTORE") {
            this.series.heals.push({
                health: ev.value,
                round: this.meta.currentRound,
            })
            this.updateChart("heals")
        } else {
            return
        }
    }

    public clear() {
        for (const series of Object.values(this.series)) {
            series.clear()
        }

        this.updateAllCharts()
    }

    private load() {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return
        }

        let data
        try {
            data = JSON.parse(raw)

            this.meta = { ...this.meta, ...data.meta }

            for (const [name, series] of Object.entries(
                this.series
            )) {
                series.push(...(data?.series?.[name] ?? []))
            }
        } catch (e) {
            console.error(e)
            return
        }
    }

    private initCharts() {
        const heals = new Chart(this.containerEl, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Health",
                        data: [],
                        borderColor: "rgb(0,155,0)",
                    },
                ],
            },
        })

        return { heals }
    }

    private updateChart(key: keyof LiveStats["charts"]) {
        const chart = this.charts[key]

        if (key === "heals") {
            const series = this.series.heals
            chart.data.labels = series.mappedPoints.map((pt) =>
                String(pt.x)
            )
            chart.data.datasets[0].data = series.mappedPoints.map(
                (pt) => pt.y
            )
            chart.update()
        }
    }

    private updateAllCharts() {
        for (const key of Object.keys(this.charts)) {
            this.updateChart(key as any)
        }
    }
}

export interface LiveStatsData {
    currentRound?: number
    maxRounds?: number
    heals: number[]
}
