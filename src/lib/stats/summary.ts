import { ISODate } from "myutils"
import { CombatSummary } from "./combatStats"
import { DropSummary, FinanceSummary, summarizeFinances } from "./dropStats"
import { ItemUsageSummary } from "./itemUsageStats"
import { MetaSummary } from "./metaStats"

export interface DetailsSummary {
    meta: MetaSummary
    drops: DropSummary
    usage: ItemUsageSummary
    combat: CombatSummary
}

export const EQUIP_SUMMARY_PATT = /^(?:Magnificent|Legendary|Peerless).*$/
export function summarizeSearchStats(
    details: DetailsSummary,
    prices: Record<string, number>,
): SearchSummary {
    const equips: SearchSummary["equips"] = []

    const finances = summarizeFinances(
        details.meta,
        details.drops,
        details.usage,
        prices,
    )

    for (const x of Object.values(details.drops)) {
        if (x.isEquip && EQUIP_SUMMARY_PATT.test(x.key)) {
            equips.push(x.key)
        }
    }

    return {
        meta: {
            ...details.meta,
            turnCount: details.meta.turnIndices.length,
            turnIndices: undefined,
            roundIndices: undefined,
        },
        finances,
        equips,
        style: details.combat.style,
    }
}
export interface SearchSummary {
    meta: Omit<MetaSummary, "turnIndices" | "roundIndices"> & {
        turnCount: number
        turnIndices: undefined
        roundIndices: undefined
    }
    finances: FinanceSummary
    equips: string[]
    style: CombatSummary["style"]
}

export type MonsterSummary = {
    roundCount: number
    mid: Array<number>
    name: Array<string>
    hp: Array<number>
    level: Array<number>
    appearances: Array<number>
    damage: Record<
        "taken" | "given",
        Record<
            "attack" | "skill" | "spell" | "other",
            {
                count: Array<number>
                total: Array<number>
            }
        >
    >
}

export type GlobalMonsterSummary = Array<{
    days: number | null
    round_count: number
    mid_to_idx: Record<string, number>
    expiry: Array<[string, ISODate]>
    monsters: {
        mid: Array<string>
        name: Array<string>
        hp: Array<number>
        level: Array<number>
        appearances: Array<number>
        damage: Record<
            "taken" | "given",
            Record<
                "attack" | "skill" | "spell" | "other",
                { count: Array<number>; total: Array<number> }
            >
        >
    }
}>
