import { sum } from "myutils"
import { MetaSummary } from "./metaStats"
import { enumerate } from "myutils"
import { ItemUsageSummary } from "./itemUsageStats"
import { BaseHvEvent } from "../utils/eventParser"
import { LogEntries } from "../db/dbN"

export const DROP_CATEGORIES = {
    Artifacts: "Artifacts",
    Consumables: "Consumables",
    Credits: "Credits",
    Materials: "Materials",
    Shards: "Shards",
    Trophies: "Trophies",
    Crystals: "Crystals",
    Figurine: "Figurine",
    Equips: "Equips",
} as const
type DropCategory = keyof typeof DROP_CATEGORIES

type DropInfo = {
    key: string
    name: string
    priceKey: string
    isEquip: boolean
    isBonus: boolean
}
export type DropSummary = Record<
    string,
    DropInfo & {
        category: DropCategory | null
        events: {
            logIdx: number[]
            count: number[]
        }
    }
>

// Classify drops
export function summarizeItemDrops<T extends BaseHvEvent>(
    entries: LogEntries<T>,
    count: (ev: T) => Array<{
        key: string
        name?: string
        priceKey?: string
        count: number
        isEquip?: boolean
        isBonus?: boolean
    }>,
    groups: Record<DropCategory, Set<string> | ((info: DropInfo) => boolean)>,
): DropSummary {
    const drops: DropSummary = {}

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
            if (!(x.key in drops)) {
                drops[x.key] = {
                    key: x.key,
                    name: x.name ?? x.key,
                    priceKey: x.priceKey ?? x.key,
                    isEquip: x.isEquip ?? false,
                    isBonus: x.isBonus ?? false,
                    category: null,
                    events: {
                        logIdx: [],
                        count: [],
                    },
                }
                const info = drops[x.key]

                drops[x.key].category =
                    ((Object.entries(groups).find(([grpKey, cond]) =>
                        cond instanceof Set ? cond.has(info.name) : cond(info),
                    )?.[0] as DropCategory) ||
                        undefined) ??
                    null
            }

            drops[x.key].events.logIdx.push(logIdx)
            drops[x.key].events.count.push(x.count)
        }
    }

    return drops
}

export type FinanceSummary = ReturnType<typeof summarizeFinances>

export function summarizeFinances(
    summary: MetaSummary,
    drops: DropSummary,
    usage: ItemUsageSummary,
    prices: Record<string, number>,
) {
    let staminaUsage = (summary.round?.end ?? 1) / 50
    if (summary.battleType?.category === "Grindfest") {
        staminaUsage += 1
    }
    const staminaExpense = (staminaUsage * prices["Energy Drink"]) / 10

    const income = sum(
        Object.values(drops).map(
            ({ priceKey, events }) =>
                sum(events.count) * (prices[priceKey] ?? 0),
        ),
    )

    const expenses =
        staminaExpense +
        sum(
            Object.values(usage).map(
                ({ priceKey, events }) =>
                    sum(events.count) * (prices[priceKey] ?? 0),
            ),
        )

    const profit = income - expenses

    return { income, expenses, profit }
}
