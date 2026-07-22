import { FinanceSummary } from "./stats/dropStats"
import { MetaSummary } from "./stats/metaStats"
import { DetailsSummary } from "./summary"
import { CombatSummary } from "./stats/combatStats"

export interface SearchSummary {
    meta: MetaSummary
    finances: FinanceSummary
    equips: string[]
    style: CombatSummary["style"]
}

const EQUIP_SUMMARY_PATT = /^(?:Magnificent|Legendary|Peerless).*$/

export function summarizeSearchStats(
    summary: Omit<DetailsSummary, "indexMap">,
): SearchSummary {
    const equips: SearchSummary["equips"] = []

    for (const x of Object.values(summary.drops)) {
        if (x.isEquip && EQUIP_SUMMARY_PATT.test(x.key)) {
            equips.push(x.key)
        }
    }

    return {
        meta: summary.meta,
        finances: summary.finances,
        equips,
        style: summary.combat.style,
    }
}
