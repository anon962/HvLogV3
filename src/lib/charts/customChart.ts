import { Chart } from "chart.js"
import { HvEvent } from "../parsers"
import { DataSeries } from "./dataSeries"

export interface CustomChart {
    chart: Chart
    id: string

    append(ev: HvEvent, round: number): void
    clear(): void

    load(data: any): void
    save(): any
}

export class HealChart implements CustomChart {
    chart: Chart

    series = new DataSeries<{ health: number; round: number }>(
        ({ health, round }) => ({ x: round, y: health }),
        [{ type: "binByWidth", width: 50 }]
    )

    constructor(public id: string, containerEl: HTMLCanvasElement) {
        this.chart = new Chart(containerEl, {
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
    }

    public append(ev: HvEvent, round: number): void {
        if (ev.event_type === "RIDDLE_RESTORE") {
            this.series.push({
                health: ev.hp,
                round,
            })
        } else if (
            ev.event_type === "ITEM_RESTORE" &&
            ev.type === "health"
        ) {
            this.series.push({
                health: ev.value,
                round,
            })
        } else if (ev.event_type === "CURE_RESTORE") {
            this.series.push({
                health: ev.value,
                round,
            })
        } else {
            return
        }

        this.update()
    }

    public clear(): void {
        this.series.clear()
        this.update()
    }

    public load(data: any): void {
        this.series.data = data ?? []
        this.update()
    }

    public save(): any {
        return this.series.data
    }

    private update(): void {
        this.chart.data.labels = this.series.mappedPoints.map((pt) =>
            String(pt.x)
        )
        this.chart.data.datasets[0].data =
            this.series.mappedPoints.map((pt) => pt.y)
        this.chart.update()
    }
}
