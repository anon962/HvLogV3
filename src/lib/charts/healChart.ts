import * as Plot from "@observablehq/plot"
import { HvEvent } from "../parsers"
import { CustomChart } from "./customChart"
import { DataSeries } from "./dataSeries"

export class HealChart implements CustomChart {
    containerEl?: HTMLElement
    plotEl?: Element

    series = new DataSeries<{ health: number; round: number }>(
        ({ health, round }) => ({ x: round, y: health }),
        [{ type: "binByWidth", width: 50 }]
    )

    constructor(public id: string) {}

    public attach(el: HTMLElement): this {
        this.containerEl = el
        this.update()
        return this
    }

    public append(ev: HvEvent, round: number): this {
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
            return this
        }

        this.update()
        return this
    }

    public clear(): this {
        this.series.clear()
        this.update()
        return this
    }

    public load(data: any): this {
        this.series.clear()
        this.series.push(...(data ?? []))

        this.update()
        return this
    }

    public save(): any {
        return this.series.data
    }

    private update(): void {
        if (!this.containerEl) {
            return
        }

        this.plotEl?.remove()

        console.log(this.series.mappedPoints)
        this.plotEl = Plot.plot({
            marks: [
                Plot.lineY(this.series.mappedPoints, {
                    x: "x",
                    y: "y",
                    stroke: "rgb(0,155,0)",
                }),
            ],
        })
        this.containerEl.appendChild(this.plotEl)
    }
}
