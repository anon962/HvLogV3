import { HvEvent } from "../parsers"
import { AnyFunction, EventMapFor } from "../utils/typeUtils"
import { CustomChart } from "./customChart"

const STORAGE_KEY = "hvlog_charts"

export class ChartManager {
    containerEl: HTMLDivElement

    meta: ChartMgrMeta = {
        currentRound: 1,
        maxRound: 1,
    }

    charts: CustomChart[] = []

    private storageData: Partial<ChartMgrStorage>
    private eventHandlers: Record<string, AnyFunction> = {}

    public constructor(public enabled: boolean) {
        this.storageData = this.load()
        this.meta = { ...this.meta, ...(this.storageData.meta ?? {}) }

        this.containerEl = document.createElement("div")
    }

    public attach(): this {
        document.body.appendChild(this.containerEl)

        add(
            this,
            document,
            "DOMContentLoaded",
            this.handleDomLoad.bind(this)
        )
        add(this, window, "beforeunload", this.save.bind(this))

        return this

        function add<
            T extends Window | Document | HTMLElement,
            TKey extends keyof EventMapFor<T> & string
        >(
            self: ChartManager,
            el: T,
            ev: TKey,
            cb: (ev: EventMapFor<T>[TKey]) => any
        ) {
            self.eventHandlers[ev] = cb
            el.addEventListener(ev, cb as EventListener)
        }
    }

    public detach(): this {
        this.containerEl.remove()
        remove(this, document, "DOMContentLoaded")
        remove(this, window, "beforeunload")
        return this

        function remove<
            T extends Window | Document | HTMLElement,
            TKey extends keyof EventMapFor<T> & string
        >(self: ChartManager, el: T, ev: TKey) {
            el.removeEventListener(ev, self.eventHandlers[ev])
        }
    }

    public addChart(chart: CustomChart): this {
        this.charts.push(chart)
        chart.enabled = this.enabled

        const el = document.createElement("div")
        this.containerEl.appendChild(el)
        chart.load(this.storageData?.charts?.[chart.id]).attach(el)

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

    public setEnabled(enabled: boolean) {
        this.enabled = enabled

        for (const chart of this.charts) {
            chart.enabled = enabled
        }

        if (enabled) {
            this.attach()
        } else {
            this.detach()
        }
    }

    private handleDomLoad() {
        if (this.enabled) {
            document.body.appendChild(this.containerEl)
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
