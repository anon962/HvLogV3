import { CompleteLog } from "../logDb/schema"
import { BaseHvEvent } from "../eventParser"
import { enumerate } from "myutils"

export const ITEM_USAGE_CATEGORIES = {
    "Gum & Vase": "Gum & Vase",
    Scrolls: "Scrolls",
    "Health Items": "Health Items",
    "Mana Items": "Mana Items",
    "Spirit Items": "Spirit Items",
    "Last Elixir": "Last Elixir",
} as const
type ItemUsageCategory = keyof typeof ITEM_USAGE_CATEGORIES

export type ItemUsageInfo = {
    key: string
    name: string
    priceKey: string
}

export type ItemUsageSummary = Record<
    string,
    ItemUsageInfo & {
        category: ItemUsageCategory | null
        events: {
            logIdx: number[]
            count: number[]
        }
    }
>

export function summarizeItemUsage<T extends BaseHvEvent>(
    entries: CompleteLog<T>["entries"],
    count: (ev: T) => Array<{
        key: string
        name?: string
        priceKey?: string
        count: number
    }>,
    groups: Record<
        ItemUsageCategory,
        Set<string> | ((info: ItemUsageInfo) => boolean)
    >,
): ItemUsageSummary {
    const summary: ItemUsageSummary = {}

    for (const [logIdx, entry] of enumerate(entries)) {
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event
        const countResult = count(ev)
        if (!countResult) {
            continue
        }

        for (const x of countResult) {
            if (!(x.key in summary)) {
                summary[x.key] = {
                    key: x.key,
                    name: x.name ?? x.key,
                    priceKey: x.priceKey ?? x.key,
                    category: null,
                    events: {
                        logIdx: [],
                        count: [],
                    },
                }
                const info = summary[x.key]

                summary[x.key].category =
                    ((Object.entries(groups).find(([grpKey, cond]) =>
                        cond instanceof Set ? cond.has(info.name) : cond(info),
                    )?.[0] as ItemUsageCategory) ||
                        undefined) ??
                    null
            }

            summary[x.key].events.logIdx.push(logIdx)
            summary[x.key].events.count.push(x.count)
        }
    }

    return summary
}
