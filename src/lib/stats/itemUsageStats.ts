import { App } from "../app/app"
import { CompleteLog } from "../logDb/logDb"
import {
    BUBBLE_VASE,
    HEALTH_ITEMS,
    MANA_ITEMS,
    SCROLLS,
    SPIRIT_ITEMS,
} from "../ui/constants"
import { EventSummary } from "../ui/hvlog/eventSummary"
import { enumerate } from "../utils/miscUtils"

// Map events to usage
function extractItemUsage(log: CompleteLog) {
    let usage: Record<string, number[]> = {}

    for (const [idx, entry] of enumerate(log.entries)) {
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event
        switch (ev.event_type) {
            case "PLAYER_ITEM":
                usage[ev.item] = usage[ev.item] ?? []
                usage[ev.item].push(idx)
                break
        }
    }

    return usage
}

export function summarizeItemUsage(
    app: App,
    log: CompleteLog
): ItemUsageSummary {
    const usage = extractItemUsage(log)

    const summary: ItemUsageSummary = {
        data: {},
        groups: [
            newDropEventGroup("Gum & Vase", BUBBLE_VASE),
            newDropEventGroup("Scrolls", SCROLLS),
            newDropEventGroup("Health Items", HEALTH_ITEMS),
            newDropEventGroup("Mana Items", MANA_ITEMS),
            newDropEventGroup("Spirit Items", SPIRIT_ITEMS),
            newDropEventGroup(
                "Last Elixir",
                new Set(["Last Elixir"])
            ),
        ],
    }

    const mapUses = (
        key: string,
        logIdxs: (typeof usage)[string],
        value: number
    ) =>
        logIdxs.map((logIdx) => ({
            key,
            count: 1,
            value: value,
            logIdx,
        }))

    for (let [item, logIdxs] of Object.entries(usage)) {
        const k = item as any
        const ps = app.config.prices

        if (BUBBLE_VASE.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (SCROLLS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (HEALTH_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (MANA_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (SPIRIT_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (item === "Last Elixir") {
            summary.data[k] = mapUses(k, logIdxs, ps["Last Elixir"])
        }
    }

    return summary
}

function newDropEventGroup<T extends string>(
    label: string,
    keys: Set<T>
): ItemUsageSummary["groups"][number] {
    return { label, has: (key) => keys.has(key as any) }
}

export type ItemUsageSummary = EventSummary<
    {
        count: number
        value: number
    },
    Array<{
        label: string
        has: (key: string) => boolean
    }>
>
