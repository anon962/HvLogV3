import { CombatSummary } from "./stats/combatStats"
import {
    DropSummary,
    FinanceSummary,
    summarizeFinances,
} from "./stats/dropStats"
import { ItemUsageSummary } from "./stats/itemUsageStats"
import { MetaSummary } from "./stats/metaStats"

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

export interface MobSummary {}
