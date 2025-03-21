import {
    CategoryScale,
    Chart,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
} from "chart.js"
import { HvEvent } from "../parsers"
import { CustomChart } from "./customChart"

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale
)

const STORAGE_KEY = "hvlog_stats"

export class ChartManager {
    containerEl: HTMLCanvasElement

    meta: ChartMgrMeta = {
        currentRound: 1,
        maxRound: 1,
    }

    charts: CustomChart[] = []

    private storageData: Partial<ChartMgrStorage>

    public constructor() {
        this.storageData = this.load()
        this.meta = { ...this.meta, ...(this.storageData.meta ?? {}) }

        this.containerEl = document.createElement("canvas")
        document.body.appendChild(this.containerEl)
        document.addEventListener("DOMContentLoaded", () => {
            document.body.appendChild(this.containerEl)
        })
    }

    public addChart(chart: CustomChart): this {
        this.charts.push(chart)
        chart.load(this.storageData?.charts?.[chart.id])
        return this
    }

    public append(ev: HvEvent) {
        if (ev.event_type === "ROUND_START") {
            this.meta.currentRound = ev.current
            this.meta.maxRound = ev.max
            this.save()
        }

        for (const chart of this.charts) {
            chart.append(ev, this.meta.currentRound)
        }
    }

    public save() {
        const data: ChartMgrStorage = {
            meta: this.meta,
            charts: {},
        }

        for (const chart of this.charts) {
            data.charts[chart.id] = chart.save()
        }

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data, null, 2)
        )
    }

    public clear() {
        for (const chart of this.charts) {
            chart.clear()
        }
    }

    private load() {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return {}
        }

        try {
            return JSON.parse(raw) ?? {}
        } catch (e) {
            console.error(e)
            return {}
        }
    }
}

interface ChartMgrMeta {
    currentRound: number
    maxRound: number
}

interface ChartMgrStorage {
    meta: ChartMgrMeta
    charts: Record<string, any>
}
