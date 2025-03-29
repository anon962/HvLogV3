import { CompleteLog } from "../logDb"
import {
    ARTIFACTS,
    CONSUMABLES,
    MATERIALS,
    PRICES,
    SHARDS,
    TROPHIES,
} from "../ui/constants"
import { EventSummary } from "../ui/hvlog/eventSummary"
import { enumerate } from "../utils/miscUtils"

// Map events to items
function extractDrops(log: CompleteLog) {
    const drops: Record<
        string,
        {
            name: string
            entries: Array<{ logIdx: number; count: number }>
        }
    > = {}

    const add = (k: string, count: number, logIdx: number) => {
        drops[k] = drops[k] ?? { name: k, entries: [] }
        drops[k].entries.push({ logIdx, count })
    }

    for (const [idx, entry] of enumerate(log.entries)) {
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event
        switch (ev.event_type) {
            case "AUTO_SALVAGE":
                add(ev.item, ev.value, idx)
                if (ev.item2) add(ev.item2, ev.value2!, idx)
                break
            case "AUTO_SELL":
                add("autosell", ev.value, idx)
                break
            case "CLEAR_BONUS":
                add(ev.item, 1, idx)
                break
            case "CREDITS":
                add("Credits", ev.value, idx)
                break
            case "DROP":
                {
                    const [name, count] = extractNameCount(ev.item)
                    add(name, count, idx)
                }
                break
            case "EVENT_ITEM":
                {
                    const [name, count] = extractNameCount(ev.item)
                    add(name, count, idx)
                }
                break
            case "EXPERIENCE":
                add("experience", ev.value, idx)
                break
            case "PROFICIENCY":
                add("proficiency", ev.value, idx)
                break
            case "SOUL_FRAG_DROP":
                add("Soul Fragment", ev.count, idx)
                break
            case "TOKEN_BONUS":
                add(ev.item, 1, idx)
                break
        }
    }

    return drops

    function extractNameCount(text: string) {
        let name, count

        const m = text.match(/(\d+)x? (.*)/)
        if (m) {
            count = parseInt(m[1])
            name = m[2]
        } else {
            count = 1
            name = text
        }

        return [name, count] as [string, number]
    }
}

// Classify drops
export function summarizeItemDrops(
    log: CompleteLog
): UsageEventSummary {
    const drops = extractDrops(log)

    const summary: UsageEventSummary = {
        data: {},
        groups: [
            newDropEventGroup(
                "Artifacts",
                new Set(["Precursor Artifact"])
            ),
            newDropEventGroup("Consumables", CONSUMABLES),
            newDropEventGroup(
                "Credits",
                new Set(["credits", "Credits", "autosell"])
            ),
            newDropEventGroup("Materials", MATERIALS),
            newDropEventGroup("Shards", SHARDS),
            newDropEventGroup("Trophies", TROPHIES),
        ],
    }

    const crystalKeys = new Set<string>()
    const figurineKeys = new Set<string>()
    const otherKeys = new Set<string>()

    const classifyDrops = (
        key: string,
        x: (typeof drops)[string],
        mult: number,
        asSingle?: boolean
    ) =>
        x.entries.map((entry) => {
            if (!asSingle) {
                return {
                    key,
                    count: entry.count,
                    value: mult * entry.count,
                    logIdx: entry.logIdx,
                }
            } else {
                return {
                    key,
                    count: 1,
                    value: mult * entry.count,
                    logIdx: entry.logIdx,
                }
            }
        })

    for (let [key, xs] of Object.entries(drops)) {
        const k = key as any
        const ps = PRICES as any

        if (ARTIFACTS.has(k)) {
            summary.data[k] = classifyDrops(k, xs, ps[k])
        } else if (CONSUMABLES.has(k)) {
            summary.data[k] = classifyDrops(k, xs, ps[k])
        } else if (
            k === "autosell" ||
            k === "credits" ||
            k === "Credits"
        ) {
            summary.data[k] = classifyDrops(k, xs, 1, true)
        } else if (key.startsWith("Crystal of ")) {
            summary.data[k] = classifyDrops(k, xs, PRICES["Crystal"])
            crystalKeys.add(k)
        } else if (k.includes("Figurine")) {
            summary.data[k] = classifyDrops(k, xs, PRICES["Figurine"])
            figurineKeys.add(k)
        } else if (MATERIALS.has(k)) {
            summary.data[k] = classifyDrops(k, xs, ps[k])
        } else if (SHARDS.has(k)) {
            summary.data[k] = classifyDrops(k, xs, ps[k])
        } else if (TROPHIES.has(k)) {
            summary.data[k] = classifyDrops(k, xs, ps[k])
        } else if (["experience", "proficiency"].includes(k)) {
        } else {
            summary.data[k] = classifyDrops(k, xs, ps[k] ?? 0)
            otherKeys.add(k)
        }
    }

    summary.groups.push(newDropEventGroup("Crystals", crystalKeys))
    summary.groups.push(newDropEventGroup("Figurines", figurineKeys))
    summary.groups.push(newDropEventGroup("Other", otherKeys))

    return summary
}

function newDropEventGroup<T extends string>(
    label: string,
    keys: Set<T>
): UsageEventSummary["groups"][number] {
    return { label, has: (key) => keys.has(key as any) }
}

export type UsageEventSummary = EventSummary<
    {
        count: number
        value: number
    },
    (key: string) => boolean,
    string
>
